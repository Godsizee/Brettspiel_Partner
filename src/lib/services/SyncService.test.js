import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Lokale Mocks für die dynamisch/statisch importierten Abhängigkeiten des SyncService.
const mockPushToRemote = vi.fn();
const mockMarkSynced = vi.fn();

vi.mock('./DbService.js', () => ({
    db: { get: vi.fn(), set: vi.fn() },
    pushToRemote: (/** @type {any} */ ...args) => mockPushToRemote(...args),
    pullFromRemote: vi.fn(async () => [])
}));

vi.mock('./AuthService.js', () => ({
    getAuthService: () => ({
        getToken: () => 'token-123',
        host: 'https://pb.example',
        isLoggedIn: () => true
    })
}));

vi.mock('./MatchRepository.js', () => ({
    getMatchRepository: () => ({
        markSynced: mockMarkSynced,
        markPending: vi.fn(),
        listUnsynced: vi.fn(async () => [])
    })
}));

import { SyncService } from './SyncService.js';
import { db } from './DbService.js';

describe('SyncService._syncEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('markiert ein Match nach erfolgreichem Push lokal als synced und setzt die pb_id', async () => {
        mockPushToRemote.mockResolvedValue({ id: 'pb-789' });
        const svc = new SyncService();

        await svc._syncEntry({
            id: 'sync_1',
            type: 'match',
            payload: { local_id: 'match_abc', game_name: 'Test' },
            timestamp: Date.now(),
            retries: 0
        });

        expect(mockPushToRemote).toHaveBeenCalledTimes(1);
        // Kernregression: ohne markSynced bliebe das Match dauerhaft 'pending'
        // und würde bei jedem Login erneut hochgeladen.
        expect(mockMarkSynced).toHaveBeenCalledWith('match_abc', 'pb-789');
    });

    it('nutzt payload.id als Fallback, wenn keine local_id vorhanden ist', async () => {
        mockPushToRemote.mockResolvedValue({ id: 'pb-555' });
        const svc = new SyncService();

        await svc._syncEntry({
            id: 'sync_2',
            type: 'match',
            payload: { id: 'match_legacy', game_name: 'Test' },
            timestamp: Date.now(),
            retries: 0
        });

        expect(mockMarkSynced).toHaveBeenCalledWith('match_legacy', 'pb-555');
    });
});

describe('SyncService Dead-Letter (P0.2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // _runSyncLoop prüft navigator.onLine — in Node nicht vorhanden
        vi.stubGlobal('navigator', { onLine: true });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /** Seed-Helfer: Queue-Eintrag direkt über den IndexedDB-Mock laden. */
    function seedQueue(entries) {
        /** @type {import('vitest').Mock} */ (db.get).mockResolvedValue(entries);
    }

    it('behält Einträge nach MAX_RETRIES als failed statt sie zu verwerfen', async () => {
        // Eintrag steht kurz vor der letzten erlaubten Wiederholung (MAX_RETRIES = 5)
        seedQueue([{
            id: 'sync_dead', type: 'match',
            payload: { local_id: 'match_dead', game_name: 'Test' },
            timestamp: Date.now(), retries: 4
        }]);
        mockPushToRemote.mockRejectedValue(new Error('Netzwerkfehler'));
        const svc = new SyncService();

        await svc.triggerSync();

        // Kernregression P0.2: Der Eintrag darf NICHT verworfen werden.
        const entries = await svc.getPendingEntries();
        expect(entries).toHaveLength(1);
        expect(entries[0].status).toBe('failed');
        expect(entries[0].payload.local_id).toBe('match_dead');
        expect(await svc.getFailedCount()).toBe(1);

        // Weitere Sync-Läufe überspringen den Dead-Letter-Eintrag
        mockPushToRemote.mockClear();
        await svc.triggerSync();
        expect(mockPushToRemote).not.toHaveBeenCalled();
    });

    it('retryPending() reaktiviert failed-Einträge und synchronisiert sie', async () => {
        seedQueue([{
            id: 'sync_retry', type: 'match',
            payload: { local_id: 'match_retry', game_name: 'Test' },
            timestamp: Date.now(), retries: 5, status: 'failed'
        }]);
        mockPushToRemote.mockResolvedValue({ id: 'pb-999' });
        const svc = new SyncService();

        // Dead-Letter wird ohne retryPending() nicht angefasst
        await svc.triggerSync();
        expect(mockPushToRemote).not.toHaveBeenCalled();

        const ok = await svc.retryPending();

        expect(ok).toBe(true);
        expect(await svc.getQueueSize()).toBe(0);
        expect(await svc.getFailedCount()).toBe(0);
        expect(mockMarkSynced).toHaveBeenCalledWith('match_retry', 'pb-999');
    });
});
