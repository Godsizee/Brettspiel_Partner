import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mocks für Stores, IndexedDB und Netzwerk — die Zod-Validierung läuft echt.
vi.mock('../stores/app.js', async () => {
    const { writable } = await import('svelte/store');
    return {
        gamesCatalog: writable({}),
        isOnline: writable(true),
        pocketbaseHost: writable('https://pb.example'),
        DEFAULT_POCKETBASE_HOST: 'https://pb.example'
    };
});

const mockDbGet = vi.fn(async () => null);
const mockGetCustomGames = vi.fn(async () => /** @type {any[]} */ ([]));

vi.mock('./DbService.js', () => ({
    db: {
        get: (/** @type {any} */ ...args) => mockDbGet(...args),
        set: vi.fn(async () => {})
    },
    getCustomGames: (/** @type {any} */ ...args) => mockGetCustomGames(...args)
}));

const mockFetch = vi.fn();
vi.mock('../utils/timeout.js', () => ({
    fetchWithTimeout: (/** @type {any} */ ...args) => mockFetch(...args)
}));

import { loadGamesCatalog } from './GamesCatalogService.js';
import { gamesCatalog, isOnline } from '../stores/app.js';

/** Baut eine fetch-Response nach. */
function jsonResponse(/** @type {any} */ body) {
    return { ok: true, json: async () => body };
}

const CUSTOM_GAME = { key: 'custom_1', name: 'Mein Eigenbau', categories: [] };

describe('loadGamesCatalog — Custom-Games-Merge (P1.1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        gamesCatalog.set({});
        mockGetCustomGames.mockResolvedValue([CUSTOM_GAME]);
    });

    it('behält Custom Games im Katalog, wenn der PocketBase-Pfad greift', async () => {
        isOnline.set(true);
        mockFetch.mockImplementation(async (/** @type {string} */ url) => {
            if (url.includes('/api/collections/games/records')) {
                return jsonResponse({ items: [{ key: 'wingspan', name: 'Flügelschlag' }] });
            }
            // lokale games_config.json (Cover-Fallbacks)
            return jsonResponse([]);
        });

        await loadGamesCatalog();
        await new Promise(resolve => setTimeout(resolve, 10)); // Flush background promises

        const catalog = get(gamesCatalog);
        // Kernregression P1.1: der frühe return des Online-Pfads übersprang den Merge
        expect(catalog['custom_1']).toBeDefined();
        expect(catalog['custom_1'].name).toBe('Mein Eigenbau');
        expect(catalog['wingspan']).toBeDefined();
    });

    it('behält Custom Games im Katalog, wenn der IndexedDB-Cache greift', async () => {
        isOnline.set(false);
        mockDbGet.mockResolvedValue({ wingspan: { key: 'wingspan', name: 'Flügelschlag' } });

        await loadGamesCatalog();

        const catalog = get(gamesCatalog);
        expect(catalog['custom_1']).toBeDefined();
        expect(catalog['wingspan']).toBeDefined();
    });

    it('merged Custom Games auch im games_config.json-Fallback-Pfad', async () => {
        isOnline.set(false);
        mockDbGet.mockResolvedValue(null);
        mockFetch.mockResolvedValue(jsonResponse([{ key: 'wingspan', name: 'Flügelschlag' }]));

        await loadGamesCatalog();

        const catalog = get(gamesCatalog);
        expect(catalog['custom_1']).toBeDefined();
        expect(catalog['wingspan']).toBeDefined();
    });
});
