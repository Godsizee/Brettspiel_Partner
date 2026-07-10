// @ts-check
/**
 * ==========================================================================
 * BOARDGAME COMPANION - MATCH REPOSITORY
 * ==========================================================================
 * Local-first storage for matches. 
 * Provides stable IDs and offline persistence via IndexedDB.
 */

import { db } from './DbService.js';

const MATCHES_KEY = 'bg_matches';

export class MatchRepository {
    /**
     * Holt alle lokal gespeicherten Matches.
     * @returns {Promise<any[]>}
     */
    async getLocalMatches() {
        return (await db.get(MATCHES_KEY)) ?? [];
    }

    /**
     * Holt ein spezifisches Match per lokaler ID.
     * @param {string} localId
     * @returns {Promise<any|null>}
     */
    async getMatchByLocalId(localId) {
        const matches = await this.getLocalMatches();
        return matches.find((m) => m.local_id === localId) || null;
    }

    /**
     * Gibt alle Matches zurück, die noch nicht synchronisiert wurden.
     * @returns {Promise<any[]>}
     */
    async listUnsynced() {
        const matches = await this.getLocalMatches();
        return matches.filter(m => ['local_only', 'pending', 'failed'].includes(m.sync_status));
    }

    /**
     * Speichert ein Match lokal und idempotent. 
     * Übergibt es an SyncService, falls eingeloggt.
     * @param {any} match
     * @returns {Promise<any>} Das gespeicherte Match inkl. local_id und Status
     */
    async saveCompletedMatch(match) {
        const { validateMatch } = await import('../schemas/matchSchema.js');
        const validated = validateMatch(match);
        
        const matches = await this.getLocalMatches();
        
        // Stable local_id erzeugen oder wiederverwenden
        if (!validated.local_id) {
            validated.local_id = validated.id || `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }
        // Rückwärtskompatibilität für DbService/Schema
        validated.id = validated.local_id; 

        // Initialen Status setzen
        validated.sync_status = validated.sync_status || 'local_only';
        validated.created_at_local = validated.created_at_local || new Date().toISOString();
        validated.updated_at_local = new Date().toISOString();
        validated.pb_id = validated.pb_id || null;
        
        const existingIdx = matches.findIndex(m => m.local_id === validated.local_id);
        
        if (existingIdx !== -1) {
            matches[existingIdx] = { ...matches[existingIdx], ...validated, updated_at_local: new Date().toISOString() };
        } else {
            matches.push(validated);
        }
        
        await db.set(MATCHES_KEY, matches);
        console.log(`💾 MatchRepository: Match lokal gespeichert [local_id: ${validated.local_id}]`);

        // Sync triggern, falls login vorhanden (ohne zu blockieren)
        if (validated.sync_status === 'local_only' || validated.sync_status === 'failed') {
            try {
                const { getAuthService } = await import('./AuthService.js');
                const authSvc = getAuthService();
                if (authSvc.isLoggedIn()) {
                    await this.markPending(validated.local_id);
                    validated.sync_status = 'pending';

                    // Entkoppelt via Event statt direktem SyncService-Import — siehe
                    // _signalSync(). Der SyncService-Listener reiht das Match in die
                    // Offline-Queue ein und löst einen Sync-Versuch aus.
                    this._signalSync('bg-match-enqueue', { ...validated });
                }
            } catch (err) {
                console.warn('⚠️ MatchRepository: Sync konnte nicht eingereiht werden:', err);
            }
        }
        
        return validated;
    }

    /**
     * @param {string} localId
     * @returns {Promise<void>}
     */
    async markPending(localId) {
        await this._updateStatus(localId, 'pending');
    }

    /**
     * @param {string} localId
     * @param {string} pbId
     * @returns {Promise<void>}
     */
    async markSynced(localId, pbId) {
        await this._updateStatus(localId, 'synced', { pb_id: pbId });
    }

    /**
     * @param {string} localId
     * @param {Error|string} error
     * @returns {Promise<void>}
     */
    async markFailed(localId, error) {
        await this._updateStatus(localId, 'failed', { sync_error: error instanceof Error ? error.message : String(error) });
    }

    /**
     * Löscht ein Match lokal und aus der Sync-Queue.
     * @param {string} localId
     * @returns {Promise<void>}
     */
    async deleteMatch(localId) {
        const matches = await this.getLocalMatches();
        const filtered = matches.filter(m => m.local_id !== localId && m.id !== localId);
        await db.set(MATCHES_KEY, filtered);

        // Aus der Offline-Queue entfernen (entkoppelt via Event) — verhindert, dass
        // ein gelöschtes, noch nicht synchronisiertes Match später doch hochgeladen
        // und damit „wiederbelebt" wird.
        this._signalSync('bg-match-dequeue', localId);
    }

    /**
     * Signalisiert dem SyncService eine Queue-Operation über ein Window-Event.
     *
     * Bewusst KEIN direkter `import('./SyncService.js')`: MatchRepository und
     * SyncService importieren sich gegenseitig, wodurch der Bundler SyncService in
     * ein internes, nicht aus dem Chunk exportiertes Facade-Modul auflöste. Im
     * separat gechunkten MatchRepository war `getSyncService` dadurch `undefined`
     * ("t is not a function"). Die Event-Entkopplung bricht den Zyklus.
     * @private
     * @param {'bg-match-enqueue'|'bg-match-dequeue'} type
     * @param {any} detail
     */
    _signalSync(type, detail) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(type, { detail }));
        }
    }

    /**
     * @private
     * @param {string} localId
     * @param {string} status
     * @param {any} [extraProps]
     */
    async _updateStatus(localId, status, extraProps = {}) {
        const matches = await this.getLocalMatches();
        const existingIdx = matches.findIndex(m => m.local_id === localId);
        if (existingIdx !== -1) {
            matches[existingIdx] = { 
                ...matches[existingIdx], 
                sync_status: status, 
                updated_at_local: new Date().toISOString(),
                ...extraProps
            };
            await db.set(MATCHES_KEY, matches);
        }
    }
}

/** @type {MatchRepository|null} */
let _instance = null;

/**
 * Gibt die globale Instanz des MatchRepository zurück.
 * @returns {MatchRepository}
 */
export function getMatchRepository() {
    if (!_instance) _instance = new MatchRepository();
    return _instance;
}
