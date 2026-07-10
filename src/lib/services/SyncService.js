// @ts-check
/**
 * ==========================================================================
 * BOARDGAME COMPANION - SYNC SERVICE (Szenario 1)
 * ==========================================================================
 * Verwaltet die Offline-Queue in IndexedDB und synchronisiert Matches
 * nach PocketBase, sobald Netzwerkverbindung besteht.
 *
 * Konflikt-Strategie:
 *  - Matches: Last-Write-Wins basierend auf `synced_at` bzw. `version`
 *  - Custom Games: `version`-Feld für Optimistic Locking
 *
 * Trigger:
 *  - App-Start (wenn online)
 *  - Nach AuthService.login()
 *  - Manuell via triggerSync()
 *
 * SECURITY: Token wird ausschließlich aus AuthService (RAM) gelesen.
 * Alle Netzwerk-Requests laufen über fetchWithTimeout.
 */

import { db, pullFromRemote, pushToRemote } from './DbService.js';
import { fetchWithTimeout } from '../utils/timeout.js';

/** @typedef {{ id: string, type: 'match'|'custom_game', payload: any, timestamp: number, retries: number, status?: 'pending'|'failed' }} SyncQueueEntry */

const OFFLINE_QUEUE_KEY = 'bg_offline_sync_queue';
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 2000;

export class SyncService {
    constructor() {
        /** @type {SyncQueueEntry[]} */
        this._queue = [];
        this._initialized = false;
        /** @type {Promise<void>|null} */
        this._initPromise = null;
        this._isSyncing = false;
    }

    // ── Initialisierung ────────────────────────────────────────────────────────

    /**
     * Garantiert, dass die Queue aus IndexedDB geladen wurde.
     * @returns {Promise<void>}
     */
    async ensureInitialized() {
        if (this._initialized) return;
        if (this._initPromise) return this._initPromise;
        this._initPromise = this._loadQueue().then(() => {
            this._initialized = true;
            this._initPromise = null;
        });
        return this._initPromise;
    }

    // ── Öffentliche API ────────────────────────────────────────────────────────

    /**
     * Fügt ein Match in die Offline-Queue ein und löst einen Sync-Versuch aus.
     * @param {any} matchData Validiertes Match-Objekt
     * @returns {Promise<void>}
     */
    async enqueueMatch(matchData) {
        await this.ensureInitialized();
        const entry = /** @type {SyncQueueEntry} */ ({
            id:        `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            type:      'match',
            payload:   matchData,
            timestamp: Date.now(),
            retries:   0
        });
        this._queue.push(entry);
        await this._saveQueue();
        console.log(`📥 SyncService: Match in Offline-Queue eingereiht [Größe: ${this._queue.length}]`);
        this._trySync();
    }

    /**
     * Fügt ein Custom Game in die Offline-Queue ein.
     * @param {any} gameData Validiertes Custom-Game-Objekt
     * @returns {Promise<void>}
     */
    async enqueueCustomGame(gameData) {
        await this.ensureInitialized();
        const entry = /** @type {SyncQueueEntry} */ ({
            id:        `sync_cg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            type:      'custom_game',
            payload:   gameData,
            timestamp: Date.now(),
            retries:   0
        });
        this._queue.push(entry);
        await this._saveQueue();
        console.log(`📥 SyncService: Custom Game in Offline-Queue eingereiht`);
        this._trySync();
    }

    /**
     * Gibt alle aktuell ausstehenden Queue-Einträge zurück.
     * @returns {Promise<SyncQueueEntry[]>}
     */
    async getPendingEntries() {
        await this.ensureInitialized();
        return [...this._queue];
    }

    /**
     * Gibt die Anzahl der aktuell ausstehenden Einträge zurück.
     * @returns {Promise<number>}
     */
    async getQueueSize() {
        await this.ensureInitialized();
        return this._queue.length;
    }

    /**
     * Gibt die Anzahl der endgültig fehlgeschlagenen (Dead-Letter-)Einträge zurück.
     * Diese bleiben in der Queue erhalten und werden erst nach retryPending()
     * wieder synchronisiert.
     * @returns {Promise<number>}
     */
    async getFailedCount() {
        await this.ensureInitialized();
        return this._queue.filter(e => e.status === 'failed').length;
    }

    /**
     * Entfernt ein Match aus der Offline-Queue.
     * @param {string} localId
     * @returns {Promise<void>}
     */
    async removePendingMatch(localId) {
        await this.ensureInitialized();
        const initialSize = this._queue.length;
        this._queue = this._queue.filter(e => e.type !== 'match' || (e.payload.local_id !== localId && e.payload.id !== localId));
        if (this._queue.length !== initialSize) {
            await this._saveQueue();
            console.log(`🗑️ SyncService: Match [${localId}] aus Offline-Queue entfernt`);
        }
    }

    /**
     * Setzt die Retry-Zähler aller anstehenden Einträge zurück und löst einen Sync aus.
     * @returns {Promise<boolean>}
     */
    async retryPending() {
        await this.ensureInitialized();
        let changed = false;
        for (const entry of this._queue) {
            if (entry.retries > 0 || entry.status === 'failed') {
                entry.retries = 0;
                entry.status = 'pending';
                changed = true;
            }
        }
        if (changed) {
            await this._saveQueue();
        }
        return this.triggerSync();
    }

    /**
     * Löst manuell einen vollständigen Sync-Durchlauf aus.
     * Noop, wenn offline oder bereits ein Sync läuft.
     * @returns {Promise<boolean>} true = alle Einträge erfolgreich synchronisiert
     */
    async triggerSync() {
        return this._runSyncLoop();
    }

    /**
     * Migriert alle lokal-only/fehlgeschlagenen Matches in die Offline-Queue
     * und zieht anschließend Remote-Matches herein. Wird nach Login/Registrierung
     * aufgerufen, damit Gast- bzw. Offline-Spielstände dem neuen Konto zugeordnet
     * und hochgeladen werden.
     * @param {string} userId PocketBase User-ID
     * @returns {Promise<void>}
     */
    async migrateLocalMatchesAfterLogin(userId) {
        try {
            const { getMatchRepository } = await import('./MatchRepository.js');
            const repo = getMatchRepository();
            const unsynced = await repo.listUnsynced();
            for (const match of unsynced) {
                await repo.markPending(match.local_id ?? match.id);
                await this.enqueueMatch({ ...match, sync_status: 'pending' });
            }
            if (unsynced.length > 0) {
                console.log(`📤 SyncService: ${unsynced.length} lokale Matches nach Login eingereiht.`);
            }
            await this.triggerSync();
        } catch (err) {
            console.warn('⚠️ SyncService.migrateLocalMatchesAfterLogin fehlgeschlagen:', err);
        }
        // Remote-Bestand hereinziehen (eigene + von anderen Geräten)
        await this.pullAndMerge(userId).catch(err =>
            console.warn('⚠️ SyncService.migrateLocalMatchesAfterLogin pullAndMerge:', err)
        );
    }

    /**
     * Lädt alle Remote-Matches eines Nutzers und merged sie in die lokale IndexedDB.
     * Anwendung: Nach Login oder manuellem Pull-Button.
     * @param {string} userId PocketBase User-ID
     * @returns {Promise<void>}
     */
    async pullAndMerge(userId) {
        if (!navigator.onLine) {
            console.warn('⚠️ SyncService.pullAndMerge: Offline – übersprungen.');
            return;
        }
        try {
            const remoteMatches = await pullFromRemote(userId);

            const localKey = 'bg_matches';
            const localMatches = /** @type {any[]} */ ((await db.get(localKey)) ?? []);

            // Merge: Remote-Einträge, die lokal noch nicht vorhanden sind (via local_id oder pb_id)
            let mergeCount = 0;
            for (const remote of remoteMatches) {
                const alreadyLocal = localMatches.some(
                    lm => lm.pb_id === remote.id || (remote.local_id && lm.id === remote.local_id)
                );
                if (!alreadyLocal) {
                    localMatches.push({
                        ...remote,
                        pb_id: remote.id,
                        synced: true,
                        sync_status: 'synced'
                    });
                    mergeCount++;
                } else {
                    // Konflikt-Auflösung: Last-Write-Wins (synced_at)
                    const idx = localMatches.findIndex(
                        lm => lm.pb_id === remote.id || (remote.local_id && lm.id === remote.local_id)
                    );
                    if (idx !== -1) {
                        const localTs  = new Date(localMatches[idx].synced_at ?? 0).getTime();
                        const remoteTs = new Date(remote.synced_at ?? 0).getTime();
                        if (remoteTs > localTs) {
                            localMatches[idx] = { ...localMatches[idx], ...remote, pb_id: remote.id, synced: true, sync_status: 'synced' };
                        }
                    }
                }
            }

            await db.set(localKey, localMatches);
            console.log(`✅ SyncService.pullAndMerge: ${mergeCount} neue Matches von Remote gemerged.`);
        } catch (err) {
            console.error('❌ SyncService.pullAndMerge:', err);
            throw err;
        }
    }

    // ── Private Methoden ───────────────────────────────────────────────────────

    /**
     * Löst einen Sync-Durchlauf aus, wenn Verbindung besteht und kein Sync läuft.
     * @private
     */
    _trySync() {
        if (navigator.onLine && !this._isSyncing && this._queue.some(e => e.status !== 'failed')) {
            this._runSyncLoop().catch(e => {
                console.warn('⚠️ SyncService._trySync: Hintergrundfehler:', e);
            });
        }
    }

    /**
     * Hauptschleife: Verarbeitet die Queue FIFO bis leer oder Fehler.
     * @private
     * @returns {Promise<boolean>}
     */
    async _runSyncLoop() {
        await this.ensureInitialized();

        if (!navigator.onLine) {
            console.log('📡 SyncService: Offline – Sync-Schleife übersprungen.');
            return false;
        }
        if (this._isSyncing) {
            console.log('⏳ SyncService: Sync läuft bereits.');
            return false;
        }
        if (this._queue.length === 0) return true;

        this._isSyncing = true;
        console.log(`🚀 SyncService: Starte Sync (${this._queue.length} Einträge)...`);

        let allSuccess = true;
        let syncedCount = 0;

        // FIFO über alle aktiven Einträge; Dead-Letter-Einträge (status 'failed')
        // bleiben erhalten und werden übersprungen, bis retryPending() sie zurücksetzt.
        while (true) {
            const entry = this._queue.find(e => e.status !== 'failed');
            if (!entry) break;
            try {
                await this._syncEntry(entry);
                this._queue = this._queue.filter(e => e !== entry);
                syncedCount++;
                await this._saveQueue();
                console.log(`✅ SyncService: Eintrag synchronisiert [${entry.id}]`);
            } catch (err) {
                entry.retries++;
                allSuccess = false;

                if (entry.retries >= MAX_RETRIES) {
                    // Kein Drop (P0.2): Eintrag als Dead-Letter behalten, damit keine
                    // Spielstände verloren gehen. Reaktivierung über retryPending().
                    entry.status = 'failed';
                    console.error(`❌ SyncService: Max. Retries erreicht für [${entry.id}]. Eintrag als 'failed' markiert (kein Datenverlust).`, err);
                    await this._saveQueue();
                } else {
                    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, entry.retries - 1);
                    console.warn(`⚠️ SyncService: Fehler bei [${entry.id}], Versuch ${entry.retries}/${MAX_RETRIES}, Retry in ${delay}ms.`, err);
                    await this._saveQueue();
                    // Verlasse die Schleife und plane späteren Retry
                    setTimeout(() => this._trySync(), delay);
                    break;
                }
            }
        }

        this._isSyncing = false;
        // Nach erfolgreich synchronisierten Einträgen offene Ansichten (History,
        // Profil) aktualisieren, damit der Status live von pending → synced springt.
        if (syncedCount > 0 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bg-refresh-data'));
        }
        return allSuccess && !this._queue.some(e => e.status === 'failed');
    }

    /**
     * Synchronisiert einen einzelnen Queue-Eintrag.
     * @private
     * @param {SyncQueueEntry} entry
     * @returns {Promise<void>}
     */
    async _syncEntry(entry) {
        const { getAuthService } = await import('./AuthService.js');
        const authSvc = getAuthService();
        const token = authSvc.getToken();
        if (!token) throw new Error('SyncService._syncEntry: Nicht authentifiziert.');

        const host = authSvc.host;

        if (entry.type === 'match') {
            const created = await pushToRemote(entry.payload);
            // Lokalen Match-Status nachziehen: ohne markSynced bliebe das Match
            // dauerhaft 'pending' — es würde bei jedem Login erneut hochgeladen,
            // bekäme lokal nie eine pb_id und würde in der UI nie als gesichert
            // angezeigt.
            const localId = entry.payload?.local_id ?? entry.payload?.id ?? null;
            if (localId && created?.id) {
                try {
                    const { getMatchRepository } = await import('./MatchRepository.js');
                    await getMatchRepository().markSynced(localId, created.id);
                } catch (err) {
                    console.warn('⚠️ SyncService: markSynced fehlgeschlagen:', err);
                }
            }
        } else if (entry.type === 'custom_game') {
            await this._syncCustomGame(host, token, entry.payload);
        } else {
            console.warn(`⚠️ SyncService: Unbekannter Entry-Typ: ${entry.type}`);
        }
    }

    /**
     * Synchronisiert ein Custom Game mit PocketBase.
     * Nutzt `version`-Feld für Optimistic Locking.
     * @private
     * @param {string} host
     * @param {string} token
     * @param {any} game
     * @returns {Promise<void>}
     */
    async _syncCustomGame(host, token, game) {
        const cachedUser = await db.get('bg_user');
        const userId = cachedUser?.id ?? null;

        // Prüfe ob bereits ein Remote-Record existiert (via local_id)
        const filterUrl = `${host}/api/collections/custom_games/records?filter=${encodeURIComponent(`local_id = "${game.key || ''}"`)}&perPage=1`;
        const checkResp = await fetchWithTimeout(filterUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        }, 15000);

        let existingRecord = null;
        if (checkResp.ok) {
            const data = await checkResp.json();
            existingRecord = data.items?.[0] ?? null;
        }

        const body = {
            user:      userId,
            name:      game.name,
            config:    { categories: game.categories, emoji: game.emoji, accentColor: game.accentColor },
            local_id:  game.key ?? null,
            is_public: game.status === 'pending_review',
            version:   (existingRecord?.version ?? 0) + 1
        };

        if (existingRecord) {
            // UPDATE: Optimistic Locking via version
            if ((existingRecord.version ?? 0) > (game._remoteVersion ?? 0)) {
                console.warn(`⚠️ SyncService: Konflikt für Custom Game "${game.name}" – Remote-Version ist neuer. Remote-Version wird beibehalten.`);
                return; // Last-Write-Wins: Remote gewinnt
            }
            const patchResp = await fetchWithTimeout(
                `${host}/api/collections/custom_games/records/${existingRecord.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(body)
                },
                20000
            );
            if (!patchResp.ok) throw new Error(`Custom Game PATCH fehlgeschlagen: ${patchResp.status}`);
        } else {
            // CREATE
            const postResp = await fetchWithTimeout(
                `${host}/api/collections/custom_games/records`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(body)
                },
                20000
            );
            if (!postResp.ok) throw new Error(`Custom Game POST fehlgeschlagen: ${postResp.status}`);
        }
    }

    /**
     * Lädt die Queue aus IndexedDB.
     * @private
     */
    async _loadQueue() {
        try {
            this._queue = (await db.get(OFFLINE_QUEUE_KEY)) ?? [];
        } catch (err) {
            console.error('❌ SyncService._loadQueue:', err);
            this._queue = [];
        }
    }

    /**
     * Persistiert die Queue in IndexedDB.
     * @private
     */
    async _saveQueue() {
        try {
            await db.set(OFFLINE_QUEUE_KEY, this._queue);
            // App-Badge konsistent halten: spiegelt die Anzahl noch ausstehender
            // Einträge wider (wird in AppLifecycleService ausgewertet).
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('sync-queue-updated', {
                    detail: {
                        size: this._queue.length,
                        failed: this._queue.filter(e => e.status === 'failed').length
                    }
                }));
            }
        } catch (err) {
            console.error('❌ SyncService._saveQueue:', err);
        }
    }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

/** @type {SyncService|null} */
let _instance = null;

/**
 * Gibt die globale SyncService-Instanz zurück.
 * @returns {SyncService}
 */
export function getSyncService() {
    if (!_instance) _instance = new SyncService();
    return _instance;
}

// Automatischer Sync-Trigger bei Netzwerkwiederkehr
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('🌐 SyncService: Netzwerk wieder verfügbar — löse Sync aus.');
        getSyncService().triggerSync().catch(console.error);
    });

    // Entkopplung von MatchRepository (siehe MatchRepository._signalSync): Ein direkter
    // gegenseitiger Import erzeugte eine zirkuläre Modul-Abhängigkeit, die der Bundler
    // zu einem nicht-exportierten Facade-Modul auflöste. MatchRepository signalisiert
    // Queue-Operationen daher über diese Events. Dieses Modul wird beim App-Start statisch
    // geladen (AppLifecycleService/Header), sodass die Listener rechtzeitig registriert sind.
    window.addEventListener('bg-match-enqueue', (/** @type {any} */ e) => {
        const match = e?.detail;
        if (match) {
            getSyncService().enqueueMatch(match).catch(err =>
                console.warn('⚠️ SyncService: enqueue via Event fehlgeschlagen:', err)
            );
        }
    });

    window.addEventListener('bg-match-dequeue', (/** @type {any} */ e) => {
        const localId = e?.detail;
        if (localId) {
            getSyncService().removePendingMatch(localId).catch(err =>
                console.warn('⚠️ SyncService: removePendingMatch via Event fehlgeschlagen:', err)
            );
        }
    });
}
