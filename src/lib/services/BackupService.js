// @ts-check
/**
 * ==========================================================================
 * BOARDGAME COMPANION - BACKUP SERVICE (Szenario 5)
 * ==========================================================================
 * Cloud-Backup der lokalen IndexedDB-Daten. Ermöglicht Wiederherstellung
 * bei Browser-Wechsel oder Geräteverlust.
 *
 * Flow:
 *  1. exportIndexedDB()         — alle relevanten IndexedDB-Keys exportieren
 *  2. Zod-Validierung           — Integrität sicherstellen (Fail-Fast)
 *  3. SHA-256 Checksum          — Fingerprint vor Kompression berechnen
 *  4. CompressionStream (gzip)  — Payload komprimieren
 *  5. SubtleCrypto (AES-GCM)    — Payload verschlüsseln
 *  6. Push → PocketBase         — als Base64-JSON speichern
 *
 * Restore-Flow:
 *  1. pullLatestBackup()        — jüngsten Backup-Record holen
 *  2. Entschlüsseln + Dekomprimieren
 *  3. Checksum verifizieren
 *  4. restoreToIndexedDB()
 *
 * Retention: Max. 5 Backups pro User (älteste werden clientseitig bevorzugt
 * gelöscht; serverseitig via PocketBase-Hook empfohlen).
 *
 * DSGVO: Kein PII im Payload — nur Match-Daten und Spieler-Pseudonyme.
 * SECURITY: Token ausschließlich aus AuthService (RAM).
 */

import { db } from './DbService.js';
import { fetchWithTimeout } from '../utils/timeout.js';
import { DEFAULT_POCKETBASE_HOST } from '../stores/app.js';

const MAX_BACKUPS_PER_USER = 5;

/** Alle IndexedDB-Keys, die ins Backup aufgenommen werden */
const BACKUP_KEYS = [
    'bg_matches',
    'bg_custom_games',
    'bg_player_profiles',
    'bg_achievements',
    'bg_sync_queue',
    'bg_offline_sync_queue'
];

export class BackupService {
    /**
     * @param {string} host PocketBase Base-URL
     */
    constructor(host) {
        /** @type {string} */
        this.host = host;
    }

    // ── Öffentliche API ────────────────────────────────────────────────────────

    /**
     * Erstellt ein vollständiges Cloud-Backup der lokalen IndexedDB-Daten.
     * Trigger: nach einem abgeschlossenen Match (wenn online) oder manuell.
     *
     * @returns {Promise<{id: string, size_bytes: number}>} PocketBase-Record-ID und Größe
     * @throws {Error} Bei Validierungsfehler, Netzwerkproblem oder fehlender Auth
     */
    async createBackup() {
        const { getAuthService } = await import('./AuthService.js');
        const authSvc = getAuthService();
        const token = authSvc.getToken();
        if (!token) throw new Error('BackupService.createBackup: Nicht authentifiziert.');

        const cachedUser = await db.get('bg_user');
        const userId = cachedUser?.id;
        if (!userId) throw new Error('BackupService.createBackup: Keine User-ID.');

        console.log('📦 BackupService: Starte Backup-Erstellung...');

        // 1. Export
        const rawPayload = await this.exportIndexedDB();

        // 2. Validierung (Fail-Fast)
        this._validatePayload(rawPayload);

        // 3. SHA-256 Checksum des Klartext-Payloads
        const jsonString    = JSON.stringify(rawPayload);
        const encoder       = new TextEncoder();
        const rawBytes      = encoder.encode(jsonString);
        const checksum      = await this._sha256Hex(rawBytes);
        const sizeBytes     = rawBytes.byteLength;

        // 4. Kompression (gzip)
        const compressed = await this._compress(rawBytes);

        // 5. Verschlüsselung (AES-GCM mit nutzerspezifischem Salt)
        const encrypted = await this._encrypt(compressed, userId);

        // 6. Base64-Serialisierung für JSON-Transport
        const payloadBase64 = this._arrayBufferToBase64(encrypted.ciphertext);
        const ivBase64      = this._arrayBufferToBase64(encrypted.iv);
        const saltBase64    = this._arrayBufferToBase64(encrypted.salt);

        // 7. Retention: älteste Backups löschen wenn Limit erreicht
        await this._enforceRetention(userId, token);

        // 8. Push nach PocketBase
        const deviceHint = await this._deviceHint();

        const body = {
            user:        userId,
            payload:     { data: payloadBase64, iv: ivBase64, salt: saltBase64 },
            checksum,
            size_bytes:  sizeBytes,
            device_hint: deviceHint
        };

        const resp = await fetchWithTimeout(
            `${this.host}/api/collections/backups/records`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            },
            60000 // 60s Timeout für Uploads
        );

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(`BackupService.createBackup: Upload fehlgeschlagen – ${err.message || resp.status}`);
        }

        const record = await resp.json();
        console.log(`✅ BackupService: Backup erstellt (ID: ${record.id}, ${sizeBytes} Bytes)`);
        return { id: record.id, size_bytes: sizeBytes };
    }

    /**
     * Stellt das jüngste Cloud-Backup in der lokalen IndexedDB wieder her.
     * @returns {Promise<void>}
     * @throws {Error} Bei Integritätsfehler (Checksum-Mismatch) oder Netzwerkproblem
     */
    async restoreLatestBackup() {
        const { getAuthService } = await import('./AuthService.js');
        const token = getAuthService().getToken();
        if (!token) throw new Error('BackupService.restoreLatestBackup: Nicht authentifiziert.');

        const cachedUser = await db.get('bg_user');
        const userId = cachedUser?.id;
        if (!userId) throw new Error('BackupService.restoreLatestBackup: Keine User-ID.');

        // Jüngstes Backup laden
        const backupRecord = await this.pullLatestBackup(userId, token);
        if (!backupRecord) throw new Error('Kein Backup gefunden.');

        // Entschlüsseln + Dekomprimieren
        const ciphertext = this._base64ToArrayBuffer(backupRecord.payload.data);
        const iv         = this._base64ToArrayBuffer(backupRecord.payload.iv);
        const salt       = this._base64ToArrayBuffer(backupRecord.payload.salt);

        const decrypted    = await this._decrypt(ciphertext, iv, salt, userId);
        const decompressed = await this._decompress(decrypted);

        // Checksum verifizieren
        const restoredChecksum = await this._sha256Hex(decompressed);
        if (restoredChecksum !== backupRecord.checksum) {
            throw new Error(`BackupService: Checksum-Mismatch! Backup ist korrumpiert. (erwartet: ${backupRecord.checksum}, berechnet: ${restoredChecksum})`);
        }

        // JSON parsen
        const jsonString    = new TextDecoder().decode(decompressed);
        const restoredData  = JSON.parse(jsonString);

        // In IndexedDB schreiben
        await this.restoreToIndexedDB(restoredData);
        console.log('✅ BackupService: Wiederherstellung abgeschlossen.');
    }

    /**
     * Holt alle Backup-Metadaten (ohne Payload) des Nutzers.
     * @param {string} userId
     * @param {string} [token]
     * @returns {Promise<any[]>}
     */
    async listBackups(userId, token) {
        const { getAuthService } = await import('./AuthService.js');
        const t = token || getAuthService().getToken();
        if (!t) throw new Error('listBackups: Nicht authentifiziert.');

        const filter = encodeURIComponent(`user = "${userId}"`);
        const url = `${this.host}/api/collections/backups/records?filter=${filter}&sort=-created&fields=id,size_bytes,created,device_hint,checksum`;

        const resp = await fetchWithTimeout(url, {
            headers: { 'Authorization': `Bearer ${t}` }
        }, 15000);

        if (!resp.ok) throw new Error(`listBackups: ${resp.status}`);
        const data = await resp.json();
        return data.items ?? [];
    }

    /**
     * Löscht alle Backups des Nutzers (DSGVO-Löschrecht).
     * @param {string} userId
     * @returns {Promise<number>} Anzahl gelöschter Backups
     */
    async deleteAllBackups(userId) {
        const { getAuthService } = await import('./AuthService.js');
        const token = getAuthService().getToken();
        if (!token) throw new Error('deleteAllBackups: Nicht authentifiziert.');

        const backups = await this.listBackups(userId, token);
        let deleted = 0;

        for (const b of backups) {
            try {
                const resp = await fetchWithTimeout(
                    `${this.host}/api/collections/backups/records/${b.id}`,
                    { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } },
                    15000
                );
                if (resp.ok || resp.status === 404) deleted++;
            } catch (e) {
                console.warn(`⚠️ BackupService.deleteAllBackups: Fehler beim Löschen von ${b.id}:`, e);
            }
        }

        console.log(`🗑️ BackupService: ${deleted} Backups gelöscht.`);
        return deleted;
    }

    // ── Export / Import ────────────────────────────────────────────────────────

    /**
     * Exportiert alle relevanten IndexedDB-Keys in ein einzelnes Objekt.
     * Kein PII: enthält nur Match-Daten und Spieler-Pseudonyme.
     *
     * @returns {Promise<Record<string, any>>}
     */
    async exportIndexedDB() {
        /** @type {Record<string, any>} */
        const snapshot = {};
        for (const key of BACKUP_KEYS) {
            try {
                const val = await db.get(key);
                if (val !== undefined && val !== null) {
                    snapshot[key] = val;
                }
            } catch (err) {
                console.warn(`⚠️ BackupService.exportIndexedDB: Key "${key}" nicht lesbar:`, err);
            }
        }
        snapshot.__exported_at = new Date().toISOString();
        snapshot.__version     = 1;
        return snapshot;
    }

    /**
     * Schreibt einen exportierten Snapshot zurück in IndexedDB.
     * Überschreibt bestehende Daten!
     * @param {Record<string, any>} snapshot
     * @returns {Promise<void>}
     */
    async restoreToIndexedDB(snapshot) {
        for (const key of BACKUP_KEYS) {
            if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
                await db.set(key, snapshot[key]);
            }
        }
        console.log('✅ BackupService.restoreToIndexedDB: Daten wiederhergestellt.');
    }

    // ── Hilfsmethoden ──────────────────────────────────────────────────────────

    /**
     * Ruft das jüngste Backup vom Server ab (inklusive Payload).
     * @param {string} userId
     * @param {string} token
     * @returns {Promise<any|null>}
     */
    async pullLatestBackup(userId, token) {
        const filter = encodeURIComponent(`user = "${userId}"`);
        const url = `${this.host}/api/collections/backups/records?filter=${filter}&sort=-created&perPage=1`;

        const resp = await fetchWithTimeout(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }, 30000);

        if (!resp.ok) throw new Error(`pullLatestBackup: ${resp.status}`);
        const data = await resp.json();
        return data.items?.[0] ?? null;
    }

    /**
     * Basis-Validierung des Payload-Snapshots (Fail-Fast).
     * @private
     * @param {any} payload
     */
    _validatePayload(payload) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('BackupService: Ungültiger Payload (kein Objekt).');
        }
        if (!payload.__version) {
            throw new Error('BackupService: Payload ohne __version-Marker.');
        }
        // Matches müssen Array oder undefined sein
        if (payload.bg_matches !== undefined && !Array.isArray(payload.bg_matches)) {
            throw new Error('BackupService: bg_matches ist kein Array.');
        }
    }

    /**
     * Berechnet den SHA-256-Hash als Hex-String.
     * @private
     * @param {Uint8Array|ArrayBuffer} data
     * @returns {Promise<string>} Lowercase Hex
     */
    async _sha256Hex(data) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', /** @type {any} */ (data));
        const hashArray  = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Komprimiert Bytes mit CompressionStream (gzip).
     * @private
     * @param {Uint8Array} data
     * @returns {Promise<Uint8Array>}
     */
    async _compress(data) {
        if (typeof CompressionStream === 'undefined') {
            // Fallback: unkomprimiert zurückgeben (ältere Browser)
            console.warn('⚠️ BackupService: CompressionStream nicht verfügbar — Backup unkomprimiert.');
            return data;
        }
        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        writer.write(/** @type {any} */ (data));
        writer.close();
        return new Uint8Array(await new Response(cs.readable).arrayBuffer());
    }

    /**
     * Dekomprimiert Bytes mit DecompressionStream (gzip).
     * @private
     * @param {Uint8Array} data
     * @returns {Promise<Uint8Array>}
     */
    async _decompress(data) {
        if (typeof DecompressionStream === 'undefined') {
            return data;
        }
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(/** @type {any} */ (data));
        writer.close();
        return new Uint8Array(await new Response(ds.readable).arrayBuffer());
    }

    /**
     * Verschlüsselt Bytes mit AES-GCM (256-bit).
     * Schlüssel wird aus userId + Salt via PBKDF2 abgeleitet.
     * @private
     * @param {Uint8Array} data
     * @param {string} userId
     * @returns {Promise<{ciphertext: ArrayBuffer, iv: Uint8Array, salt: Uint8Array}>}
     */
    async _encrypt(data, userId) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv   = crypto.getRandomValues(new Uint8Array(12));
        const key  = await this._deriveKey(userId, salt);

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            /** @type {any} */ (data)
        );

        return { ciphertext, iv, salt };
    }

    /**
     * Entschlüsselt AES-GCM-verschlüsselte Bytes.
     * @private
     * @param {ArrayBuffer} ciphertext
     * @param {ArrayBuffer} iv
     * @param {ArrayBuffer} salt
     * @param {string} userId
     * @returns {Promise<Uint8Array>}
     */
    async _decrypt(ciphertext, iv, salt, userId) {
        const key = await this._deriveKey(userId, new Uint8Array(salt));
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            key,
            ciphertext
        );
        return new Uint8Array(plaintext);
    }

    /**
     * Leitet einen AES-GCM-Schlüssel via PBKDF2 aus userId + Salt ab.
     * @private
     * @param {string} userId
     * @param {Uint8Array} salt
     * @returns {Promise<CryptoKey>}
     */
    async _deriveKey(userId, salt) {
        const encoder  = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            /** @type {any} */ (encoder.encode(userId)),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: /** @type {any} */ (salt), iterations: 100_000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Löscht überzählige Backups um unter MAX_BACKUPS_PER_USER zu bleiben.
     * @private
     * @param {string} userId
     * @param {string} token
     */
    async _enforceRetention(userId, token) {
        const backups = await this.listBackups(userId, token);
        if (backups.length < MAX_BACKUPS_PER_USER) return;

        // Älteste zuerst löschen (sort=-created → letzter Eintrag ist ältestes)
        const toDelete = backups.slice(MAX_BACKUPS_PER_USER - 1);
        for (const b of toDelete) {
            try {
                await fetchWithTimeout(
                    `${this.host}/api/collections/backups/records/${b.id}`,
                    { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } },
                    15000
                );
                console.log(`🗑️ BackupService.retention: Backup ${b.id} gelöscht.`);
            } catch (e) {
                console.warn('⚠️ BackupService.retention: Löschen fehlgeschlagen:', e);
            }
        }
    }

    /**
     * Erzeugt einen anonymen Geräte-Hint (SHA-256 des User-Agents, kein PII).
     * @private
     * @returns {Promise<string>}
     */
    async _deviceHint() {
        const ua  = navigator.userAgent || 'unknown';
        const enc = new TextEncoder();
        return this._sha256Hex(enc.encode(ua)).then(h => h.slice(0, 16));
    }

    /**
     * Konvertiert ArrayBuffer → Base64-String.
     * @private
     * @param {ArrayBuffer|Uint8Array} buffer
     * @returns {string}
     */
    _arrayBufferToBase64(buffer) {
        const bytes  = new Uint8Array(buffer);
        let binary   = '';
        for (const b of bytes) binary += String.fromCharCode(b);
        return btoa(binary);
    }

    /**
     * Konvertiert Base64-String → ArrayBuffer.
     * @private
     * @param {string} base64
     * @returns {ArrayBuffer}
     */
    _base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

/** @type {BackupService|null} */
let _instance = null;

/**
 * Gibt die globale BackupService-Instanz zurück.
 * @param {string} [host]
 * @returns {BackupService}
 */
export function getBackupService(host) {
    if (!_instance) {
        const h = host || import.meta.env?.VITE_POCKETBASE_URL || DEFAULT_POCKETBASE_HOST;
        _instance = new BackupService(h);
    }
    return _instance;
}
