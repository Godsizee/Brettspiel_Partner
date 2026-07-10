import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks für Stores und IndexedDB — die Zod-Validierung im wikiLoader läuft echt.
vi.mock('../stores/app.js', async () => {
  const { writable } = await import('svelte/store');
  return {
    gamesCatalog: writable({}),
    isOnline: writable(true),
    pocketbaseHost: writable('https://pb.example'),
    DEFAULT_POCKETBASE_HOST: 'https://pb.example'
  };
});

const idbStore = new Map();
vi.mock('./DbService.js', () => ({
  db: {
    get: vi.fn(async (key) => idbStore.get(key) ?? null),
    set: vi.fn(async (key, value) => { idbStore.set(key, value); })
  }
}));

import { isOnline } from '../stores/app.js';
import {
  getWikiCatalog,
  getGameOverview,
  getGameModule,
  getSearchableEntries,
  invalidateWikiCache,
  TIPS_MODULE_ID
} from './WikiService.js';

const CATALOG = [
  {
    key: 'voidfall',
    name: 'Voidfall',
    publisher: 'Mindclash',
    wiki: { enabled: true, manifest: '/data/games/voidfall/manifest.json' }
  }
];

const MANIFEST = {
  schemaVersion: 1,
  game: { key: 'voidfall', name: 'Voidfall' },
  modules: [
    { id: 'fokusse', type: 'reference', title: 'Fokusse', source: 'modules/fokusse.json', featured: true },
    { id: 'aufbau', type: 'checklist', title: 'Aufbau', source: 'modules/aufbau.json' }
  ]
};

const STATIC_FOKUSSE = {
  entries: [
    { id: 'alpha', type: 'card', name: 'Alpha', summary: 'Statisch A' },
    { id: 'beta', type: 'card', name: 'Beta', summary: 'Statisch B' }
  ]
};

const PB_ITEMS = [
  {
    id: 'rec2', item_id: 'pb-2', name: 'Zeta', category_id: 'fokusse', sort_order: 2,
    effect: 'Effekt Z', tip: 'Tipp Z'
  },
  {
    id: 'rec1', item_id: 'pb-1', name: 'Omega', category_id: 'fokusse', sort_order: 1,
    effect: 'Effekt O', tip: 'Tipp O', image: 'img.png', collectionId: 'col1'
  }
];

/** Antwort-Helfer im fetch-Format des wikiLoaders (Content-Type wird geprüft). */
function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body
  };
}

/** @type {(pbItems?: any[], pbOk?: boolean) => void} */
function installFetch(pbItems = [], pbOk = true) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/data/wiki/games.json')) return jsonResponse(CATALOG);
    if (u.includes('/data/games/voidfall/manifest.json')) return jsonResponse(MANIFEST);
    if (u.includes('/data/games/voidfall/modules/fokusse.json')) return jsonResponse(STATIC_FOKUSSE);
    if (u.includes('/data/games/voidfall/modules/aufbau.json')) return jsonResponse({ items: [{ text: 'Karten mischen' }] });
    if (u.includes('/api/collections/wiki_items/')) {
      return pbOk ? jsonResponse({ items: pbItems }) : jsonResponse({}, false, 500);
    }
    if (u.includes('/api/collections/wiki_tips/')) {
      return pbOk ? jsonResponse({ items: [] }) : jsonResponse({}, false, 500);
    }
    throw new Error(`Unerwartete URL im Test: ${u}`);
  }));
}

beforeEach(() => {
  invalidateWikiCache();
  idbStore.clear();
  isOnline.set(true);
  vi.unstubAllGlobals();
});

describe('getWikiCatalog / getGameOverview', () => {
  it('liefert den Katalog und cached ihn pro Session', async () => {
    installFetch();
    const first = await getWikiCatalog();
    const second = await getWikiCatalog();
    expect(first).toHaveLength(1);
    expect(second).toBe(first);
    const fetchCalls = /** @type {any} */ (fetch).mock.calls.filter(([u]) => String(u).includes('games.json'));
    expect(fetchCalls).toHaveLength(1);
  });

  it('lädt die Übersicht ohne Moduldaten und injiziert das Tipps-Modul', async () => {
    installFetch();
    const overview = await getGameOverview('voidfall');
    expect(overview.catalogEntry.name).toBe('Voidfall');
    expect(overview.modules.map((m) => m.id)).toEqual(['fokusse', 'aufbau', TIPS_MODULE_ID]);
    // Lazy: keine Modul-Quelldateien angefasst (P2.3)
    const moduleCalls = /** @type {any} */ (fetch).mock.calls.filter(([u]) => String(u).includes('/modules/'));
    expect(moduleCalls).toHaveLength(0);
  });

  it('wirft für unbekannte Slugs einen verständlichen Fehler', async () => {
    installFetch();
    await expect(getGameOverview('gibt-es-nicht')).rejects.toThrow('nicht im Wiki-Katalog');
  });
});

describe('getGameModule', () => {
  it('bevorzugt PocketBase-Einträge, sortiert nach sort_order und mapped Felder', async () => {
    installFetch(PB_ITEMS);
    const mod = await getGameModule('voidfall', 'fokusse');
    expect(mod.data.entries.map((e) => e.id)).toEqual(['pb-1', 'pb-2']);
    const first = mod.data.entries[0];
    expect(first.summary).toBe('Effekt O');
    expect(first.description).toBe('Tipp O');
    expect(first.image).toBe('https://pb.example/api/files/col1/rec1/img.png');
    // Keine Pseudo-Quelle mehr (P2.2)
    expect(first.source).toBeUndefined();
    expect(mod.offlineFallback).toBe(false);
  });

  it('fällt auf die statische JSON-Quelle zurück, wenn PocketBase nichts liefert', async () => {
    installFetch([]);
    const mod = await getGameModule('voidfall', 'fokusse');
    expect(mod.data.entries.map((e) => e.id)).toEqual(['alpha', 'beta']);
    expect(mod.sourcePath).toContain('/data/games/voidfall/modules/fokusse.json');
  });

  it('nutzt offline den IndexedDB-Cache für PocketBase-Daten', async () => {
    installFetch(PB_ITEMS);
    await getGameModule('voidfall', 'fokusse'); // füllt den Cache
    expect(idbStore.has('wiki_cache_items_voidfall')).toBe(true);

    invalidateWikiCache();
    isOnline.set(false);
    const mod = await getGameModule('voidfall', 'fokusse');
    expect(mod.data.entries.map((e) => e.id)).toEqual(['pb-1', 'pb-2']);
    expect(mod.offlineFallback).toBe(true);
  });

  it('liefert für unbekannte Module einen Fehler', async () => {
    installFetch();
    await expect(getGameModule('voidfall', 'quatsch')).rejects.toThrow('Bereich nicht gefunden');
  });
});

describe('getSearchableEntries / invalidateWikiCache', () => {
  it('sammelt alle Moduleinträge inkl. Pseudo-Einträgen mit Modul-Kontext', async () => {
    installFetch([]);
    const pool = await getSearchableEntries('voidfall');
    expect(pool).toHaveLength(3);
    expect(pool[0].moduleId).toBe('fokusse');
    expect(pool[0].moduleTitle).toBe('Fokusse');
    expect(pool[2].moduleId).toBe('aufbau');
    expect(pool[2].name).toBe('Karten mischen');
  });

  it('invalidateWikiCache(slug) erzwingt Neuladen nur für dieses Spiel', async () => {
    installFetch([]);
    await getGameModule('voidfall', 'fokusse');
    const before = /** @type {any} */ (fetch).mock.calls.length;
    await getGameModule('voidfall', 'fokusse'); // aus dem Cache
    expect(/** @type {any} */ (fetch).mock.calls.length).toBe(before);

    invalidateWikiCache('voidfall');
    await getGameModule('voidfall', 'fokusse');
    expect(/** @type {any} */ (fetch).mock.calls.length).toBeGreaterThan(before);
  });
});
