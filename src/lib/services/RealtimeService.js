// @ts-check
/**
 * ==========================================================================
 * BOARDGAME COMPANION - REALTIME SERVICE (Szenario 3)
 * ==========================================================================
 * Kapselt die PocketBase Server-Sent-Events (SSE) Realtime-API für
 * Echtzeit-Multiplayer und Live-Timer-Synchronisation.
 *
 * Features:
 *  - subscribeToSession(sessionId, callback): Abonniert Session-Updates
 *  - updateScore(sessionId, category, value): Schreibt Einzel-Score
 *  - Reconnect mit Exponential Backoff (max. ~5 Minuten)
 *  - Optimistic Concurrency via updated_at
 *
 * SECURITY: Token ausschließlich aus AuthService (RAM).
 * Alle Schreib-Requests über fetchWithTimeout.
 */

import { fetchWithTimeout } from '../utils/timeout.js';
import { DEFAULT_POCKETBASE_HOST } from '../stores/app.js';

const MAX_RECONNECT_ATTEMPTS = 10;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 300_000; // 5 Minuten

/**
 * @typedef {Object} SessionEvent
 * @property {'session'|'session_scores'|'error'|'connected'} type
 * @property {any} [record]
 * @property {string} [action]  create | update | delete
 * @property {string} [error]
 */

/** @typedef {function(SessionEvent): void} SessionCallback */

export class RealtimeService {
    /**
     * @param {string} host PocketBase Base-URL
     */
    constructor(host) {
        /** @type {string} */
        this.host = host;

        /** @type {Map<string, {callback: SessionCallback, reconnects: number, es: EventSource|null, closed: boolean}>} */
        this._subscriptions = new Map();
    }

    // ── Öffentliche API ────────────────────────────────────────────────────────

    /**
     * Abonniert alle Realtime-Events für eine Session und ihre Scores.
     * Bei Verbindungsabbruch wird automatisch mit Exponential Backoff reconnected.
     *
     * @param {string} sessionId PocketBase Session-ID
     * @param {SessionCallback} callback Wird bei jedem Ereignis aufgerufen
     * @returns {function(): void} Cleanup-Funktion zum Abbestellen
     */
    subscribeToSession(sessionId, callback) {
        // Bestehende Subscription für diese Session bereinigen
        this._closeSubscription(sessionId);

        /** @type {{ callback: SessionCallback, reconnects: number, es: EventSource|null, closed: boolean }} */
        const sub = { callback, reconnects: 0, es: null, closed: false };
        this._subscriptions.set(sessionId, sub);

        this._openEventSource(sessionId);

        // Cleanup-Funktion zurückgeben
        return () => this.unsubscribeFromSession(sessionId);
    }

    /**
     * Beendet die Realtime-Subscription für eine Session.
     * @param {string} sessionId
     */
    unsubscribeFromSession(sessionId) {
        this._closeSubscription(sessionId);
        console.log(`🔴 RealtimeService: Subscription für Session [${sessionId}] beendet.`);
    }

    /**
     * Schreibt einen Score-Wert in die `session_scores` Collection.
     * Implementiert Optimistic Concurrency: liest `updated_at` vor dem Schreiben.
     *
     * @param {string} sessionId   PocketBase Session-ID
     * @param {string} playerId    PocketBase User-ID des Spielers
     * @param {string} category    Scoring-Kategorie
     * @param {number} value       Neuer Wert
     * @returns {Promise<any>} Gespeicherter PocketBase-Record
     * @throws {Error} Bei Netzwerkfehler, Konflikt (409) oder fehlender Auth
     */
    async updateScore(sessionId, playerId, category, value) {
        const { getAuthService } = await import('./AuthService.js');
        const authSvc = getAuthService();
        const token = authSvc.getToken();
        if (!token) throw new Error('RealtimeService.updateScore: Nicht authentifiziert.');

        const host = this.host;

        // Bestehenden Record suchen (für Optimistic Concurrency)
        const filter = encodeURIComponent(`session = "${sessionId}" && player = "${playerId}" && category = "${category}"`);
        const listUrl = `${host}/api/collections/session_scores/records?filter=${filter}&perPage=1`;

        const listResp = await fetchWithTimeout(listUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        }, 15000);

        if (!listResp.ok) throw new Error(`updateScore: Datenbankabfrage fehlgeschlagen (${listResp.status})`);

        const listData = await listResp.json();
        const existing = listData.items?.[0] ?? null;

        const now = new Date().toISOString();
        const body = { session: sessionId, player: playerId, category, value, updated_at: now };

        if (existing) {
            // Optimistic Concurrency: Prüfe ob updated_at sich seit unserem Lesen geändert hat
            const patchUrl = `${host}/api/collections/session_scores/records/${existing.id}`;
            const patchResp = await fetchWithTimeout(patchUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            }, 15000);

            if (patchResp.status === 404) {
                // Record wurde zwischenzeitlich gelöscht — neu anlegen
                return this._createScore(host, token, body);
            }
            if (!patchResp.ok) {
                const err = await patchResp.json().catch(() => ({}));
                throw new Error(`updateScore PATCH: ${err.message || patchResp.status}`);
            }
            return patchResp.json();
        } else {
            return this._createScore(host, token, body);
        }
    }

    /**
     * Lädt alle aktuellen Scores einer Session.
     * @param {string} sessionId
     * @returns {Promise<any[]>}
     */
    async getSessionScores(sessionId) {
        const { getAuthService } = await import('./AuthService.js');
        const token = getAuthService().getToken();
        if (!token) throw new Error('getSessionScores: Nicht authentifiziert.');

        const filter = encodeURIComponent(`session = "${sessionId}"`);
        const url = `${this.host}/api/collections/session_scores/records?filter=${filter}&perPage=200`;

        const resp = await fetchWithTimeout(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }, 15000);

        if (!resp.ok) throw new Error(`getSessionScores: ${resp.status}`);
        const data = await resp.json();
        return data.items ?? [];
    }

    /**
     * Gibt die verbleibende Timer-Zeit in Sekunden zurück.
     * Berechnung erfolgt lokal basierend auf `timer_started_at` aus dem Session-Record.
     * Der Host setzt den Timer — Clients berechnen die Restzeit eigenständig.
     *
     * @param {{ timer_started_at: string|null, timer_duration: number }} session
     * @returns {number} Verbleibende Sekunden (0 wenn abgelaufen oder kein Timer)
     */
    getRemainingSeconds(session) {
        if (!session.timer_started_at || !session.timer_duration) return 0;
        const startedAt = new Date(session.timer_started_at).getTime();
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        return Math.max(0, session.timer_duration - elapsed);
    }

    // ── Private Methoden ───────────────────────────────────────────────────────

    /**
     * Öffnet eine SSE-Verbindung zur PocketBase Realtime-API.
     * @private
     * @param {string} sessionId
     */
    _openEventSource(sessionId) {
        const sub = this._subscriptions.get(sessionId);
        if (!sub || sub.closed) return;

        // PocketBase SSE-Endpunkt: /api/realtime
        // Abonniert beide Collections gleichzeitig
        const topicsParam = encodeURIComponent(
            JSON.stringify([
                `sessions/${sessionId}`,
                `session_scores?filter=session="${sessionId}"`
            ])
        );
        const url = `${this.host}/api/realtime`;

        console.log(`📡 RealtimeService: Öffne SSE-Verbindung für Session [${sessionId}]...`);

        const es = new EventSource(url);
        sub.es = es;

        es.addEventListener('open', () => {
            sub.reconnects = 0;
            sub.callback({ type: 'connected' });
            console.log(`✅ RealtimeService: SSE verbunden [${sessionId}]`);

            // PocketBase erwartet eine initiale SUBSCRIBE-Nachricht (POST)
            this._sendSubscribe(sessionId, topicsParam).catch(err => {
                console.warn('⚠️ RealtimeService: Subscribe-Anfrage fehlgeschlagen:', err);
            });
        });

        es.addEventListener('message', (/** @type {MessageEvent} */ event) => {
            try {
                const data = JSON.parse(event.data);
                const collection = data.collection ?? '';
                const action     = data.action ?? 'update';
                const record     = data.record ?? data;

                if (collection === 'sessions' || collection === '') {
                    sub.callback({ type: 'session', action, record });
                } else if (collection === 'session_scores') {
                    sub.callback({ type: 'session_scores', action, record });
                }
            } catch (err) {
                console.warn('⚠️ RealtimeService: Fehler beim Parsen der SSE-Nachricht:', err);
            }
        });

        es.addEventListener('error', (event) => {
            console.warn(`⚠️ RealtimeService: SSE-Fehler für [${sessionId}]:`, event);
            sub.callback({ type: 'error', error: 'SSE-Verbindungsfehler' });
            es.close();
            sub.es = null;
            this._scheduleReconnect(sessionId);
        });
    }

    /**
     * Sendet die SUBSCRIBE-Anfrage nach dem SSE-Handshake.
     * @private
     * @param {string} sessionId
     * @param {string} _topicsParam (derzeit ungenutzt — PB v0.22+ nutzt Query-Param)
     */
    async _sendSubscribe(sessionId, _topicsParam) {
        const { getAuthService } = await import('./AuthService.js');
        const token = getAuthService().getToken();
        if (!token) return;

        await fetchWithTimeout(
            `${this.host}/api/realtime`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    clientId: sessionId,
                    subscriptions: [
                        `sessions/${sessionId}`,
                        `session_scores`
                    ]
                })
            },
            10000
        );
    }

    /**
     * Plant einen Reconnect-Versuch mit Exponential Backoff.
     * @private
     * @param {string} sessionId
     */
    _scheduleReconnect(sessionId) {
        const sub = this._subscriptions.get(sessionId);
        if (!sub || sub.closed) return;

        if (sub.reconnects >= MAX_RECONNECT_ATTEMPTS) {
            console.error(`❌ RealtimeService: Max. Reconnect-Versuche erreicht für [${sessionId}]. Subscription beendet.`);
            sub.closed = true;
            sub.callback({ type: 'error', error: 'Maximale Reconnect-Versuche erreicht.' });
            return;
        }

        sub.reconnects++;
        const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, sub.reconnects - 1), BACKOFF_CAP_MS);
        console.log(`🔄 RealtimeService: Reconnect [${sub.reconnects}/${MAX_RECONNECT_ATTEMPTS}] für [${sessionId}] in ${delay}ms...`);

        setTimeout(() => {
            if (!sub.closed) this._openEventSource(sessionId);
        }, delay);
    }

    /**
     * Schließt eine bestehende EventSource-Verbindung.
     * @private
     * @param {string} sessionId
     */
    _closeSubscription(sessionId) {
        const sub = this._subscriptions.get(sessionId);
        if (!sub) return;
        sub.closed = true;
        if (sub.es) {
            sub.es.close();
            sub.es = null;
        }
        this._subscriptions.delete(sessionId);
    }

    /**
     * Erstellt einen neuen session_scores-Record.
     * @private
     * @param {string} host
     * @param {string} token
     * @param {any} body
     * @returns {Promise<any>}
     */
    async _createScore(host, token, body) {
        const resp = await fetchWithTimeout(
            `${host}/api/collections/session_scores/records`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            },
            15000
        );
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(`updateScore POST: ${err.message || resp.status}`);
        }
        return resp.json();
    }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

/** @type {RealtimeService|null} */
let _instance = null;

/**
 * Gibt die globale RealtimeService-Instanz zurück.
 * Der Host wird beim ersten Aufruf gesetzt.
 * @param {string} [host]
 * @returns {RealtimeService}
 */
export function getRealtimeService(host) {
    if (!_instance) {
        const h = host || import.meta.env?.VITE_POCKETBASE_URL || DEFAULT_POCKETBASE_HOST;
        _instance = new RealtimeService(h);
    }
    return _instance;
}
