import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatchRepository, getMatchRepository } from './MatchRepository.js';
import { db } from './DbService.js';

// Mock dependencies
vi.mock('./DbService.js', () => ({
    db: {
        get: vi.fn(),
        set: vi.fn()
    }
}));

vi.mock('./AuthService.js', () => ({
    getAuthService: vi.fn(() => ({
        isLoggedIn: vi.fn(() => false)
    }))
}));

describe('MatchRepository', () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new MatchRepository();
        db.get.mockResolvedValue([]);
    });

    it('Gast + offline -> lokal gespeichert, Status local_only', async () => {
        const match = { game_name: 'Test', player_scores: [{ player_name: 'P1', total_score: 10 }] };
        const saved = await repo.saveCompletedMatch(match);
        
        expect(saved.local_id).toBeDefined();
        expect(saved.sync_status).toBe('local_only');
        expect(db.set).toHaveBeenCalled();
    });

    it('Login + offline -> lokal gespeichert, Status pending (enqueue via Event)', async () => {
        const { getAuthService } = await import('./AuthService.js');
        getAuthService.mockReturnValue({ isLoggedIn: () => true });

        // SyncService wird entkoppelt über ein Window-Event angesprochen (kein direkter
        // Import mehr, da das eine zirkuläre Modul-Abhängigkeit erzeugte). Daher hier
        // window/CustomEvent stubben und das ausgelöste Event prüfen.
        const dispatchSpy = vi.fn();
        globalThis.window = /** @type {any} */ ({ dispatchEvent: dispatchSpy });
        globalThis.CustomEvent = /** @type {any} */ (
            class { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
        );

        try {
            const match = { game_name: 'Test', player_scores: [{ player_name: 'P1', total_score: 10 }] };
            const saved = await repo.saveCompletedMatch(match);

            expect(saved.local_id).toBeDefined();
            expect(saved.sync_status).toBe('pending');

            expect(dispatchSpy).toHaveBeenCalledTimes(1);
            const evt = dispatchSpy.mock.calls[0][0];
            expect(evt.type).toBe('bg-match-enqueue');
            expect(evt.detail).toMatchObject({ game_name: 'Test', sync_status: 'pending' });
        } finally {
            delete globalThis.window;
            delete globalThis.CustomEvent;
        }
    });

    it('gleiche local_id zweimal -> genau ein lokales Match', async () => {
        const match1 = { local_id: '123', game_name: 'Test 1', player_scores: [{ player_name: 'P1', total_score: 10 }] };
        
        db.get.mockResolvedValue([match1]);
        
        const match2 = { local_id: '123', game_name: 'Test 2', sync_status: 'local_only', player_scores: [{ player_name: 'P1', total_score: 10 }] };
        await repo.saveCompletedMatch(match2);
        
        // Assert db.set is called with an array of length 1 (updated match)
        const callArgs = db.set.mock.calls[0];
        expect(callArgs[0]).toBe('bg_matches');
        expect(callArgs[1].length).toBe(1);
        expect(callArgs[1][0].game_name).toBe('Test 2');
    });

    it('erfolgreicher Sync -> Status synced, pb_id gesetzt', async () => {
        const match = { local_id: '123', sync_status: 'pending' };
        db.get.mockResolvedValue([match]);
        
        await repo.markSynced('123', 'pb-456');
        
        const callArgs = db.set.mock.calls[0];
        expect(callArgs[1][0].sync_status).toBe('synced');
        expect(callArgs[1][0].pb_id).toBe('pb-456');
    });
});
