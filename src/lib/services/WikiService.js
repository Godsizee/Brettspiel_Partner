// @ts-check
/**
 * Einzige Fassade der Wiki-Datenschicht (P2.2/P2.3, Wiki_Refaktorierung.md E3).
 *
 * Komponenten sprechen ausschließlich mit diesem Service. Er kapselt:
 * - Katalog + Manifest (statische JSON via wikiLoader)
 * - Lazy-Loading einzelner Module (erst beim Öffnen, nicht eager pro Spiel)
 * - PocketBase-Merge (wiki_items, wiki_tips) mit IndexedDB-Offline-Cache
 * - Memory-Caching pro Session + Invalidierung
 *
 * Offline-Kette pro Anfrage: Memory → Netz (online) → IndexedDB → Fehler.
 */
import { fetchWikiCatalog, loadGameManifest, loadModuleData } from '$lib/components/wiki/utils/wikiLoader.js';
import { toAppKey } from '$lib/components/wiki/utils/wikiKeys.js';
import { get } from 'svelte/store';
import { isOnline, pocketbaseHost, DEFAULT_POCKETBASE_HOST } from '$lib/stores/app.js';
import { db } from '$lib/services/DbService.js';
import { wikiEntrySchema } from '$lib/schemas/wikiSchemas.js';

export const TIPS_MODULE_ID = 'tips-and-strategies';

/** @type {Promise<any[]> | null} */
let _catalogPromise = null;
/** @type {Map<string, Promise<any>>} */
const _overviewCache = new Map();
/** @type {Map<string, Promise<any>>} */
const _moduleCache = new Map();
/** @type {Map<string, Promise<{items: any[], offline: boolean}>>} */
const _pbItemsCache = new Map();
/** @type {Map<string, Promise<{items: any[], offline: boolean}>>} */
const _tipsCache = new Map();
/** @type {Map<string, Promise<any[]>>} */
const _searchPoolCache = new Map();

function pbHost() {
  return get(pocketbaseHost) || DEFAULT_POCKETBASE_HOST;
}

/**
 * Holt PocketBase-Records mit IndexedDB-Fallback.
 * Online wird immer frisch geladen (und der Cache erneuert); schlägt das Netz
 * fehl oder ist die App offline, zählt jeder Cache-Stand — veraltete Regeln
 * sind besser als gar keine (Offline-first, agents.md §4).
 *
 * @param {string} url PocketBase-List-URL
 * @param {string} cacheKey IndexedDB-Schlüssel
 * @param {string} [legacyLocalStorageKey] Alter localStorage-Key (einmalige Migration)
 * @returns {Promise<{items: any[], offline: boolean}>}
 */
async function fetchPbWithCache(url, cacheKey, legacyLocalStorageKey) {
  if (get(isOnline)) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const res = await response.json();
        const items = Array.isArray(res.items) ? res.items : [];
        if (items.length > 0) {
          try {
            await db.set(cacheKey, { ts: Date.now(), items });
          } catch (_) { /* Cache-Schreibfehler sind nicht kritisch */ }
        }
        return { items, offline: false };
      }
    } catch (_) { /* Netzfehler → Cache-Fallback unten */ }
  }

  try {
    const cached = await db.get(cacheKey);
    if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
      return { items: cached.items, offline: true };
    }
  } catch (_) { /* IndexedDB nicht verfügbar */ }

  // Einmalige Migration des alten localStorage-Tipps-Caches (P2.2).
  if (legacyLocalStorageKey) {
    try {
      const legacy = localStorage.getItem(legacyLocalStorageKey);
      if (legacy) {
        const { items } = JSON.parse(legacy);
        localStorage.removeItem(legacyLocalStorageKey);
        if (Array.isArray(items) && items.length > 0) {
          try {
            await db.set(cacheKey, { ts: Date.now(), items });
          } catch (_) {}
          return { items, offline: true };
        }
      }
    } catch (_) {}
  }

  return { items: [], offline: !get(isOnline) };
}

/** @param {string} slug */
function getPbItems(slug) {
  let promise = _pbItemsCache.get(slug);
  if (!promise) {
    // TODO(W3.1): nach bestätigter PB-Migration auf reinen Slug-Filter reduzieren
    const filter = encodeURIComponent(`game_key='${slug}' || game_key='${toAppKey(slug)}'`);
    const url = `${pbHost()}/api/collections/wiki_items/records?filter=${filter}&perPage=250`;
    promise = fetchPbWithCache(url, `wiki_cache_items_${slug}`);
    _pbItemsCache.set(slug, promise);
    promise.catch(() => _pbItemsCache.delete(slug));
  }
  return promise;
}

/** @param {string} slug */
function getTips(slug) {
  let promise = _tipsCache.get(slug);
  if (!promise) {
    // wiki_tips nutzt Katalog-Slugs (Bindestriche), nicht die App-Keys.
    const filter = encodeURIComponent(`game_key='${slug}'`);
    const url = `${pbHost()}/api/collections/wiki_tips/records?filter=${filter}&perPage=250&sort=sort_order`;
    promise = fetchPbWithCache(url, `wiki_cache_tips_${slug}`, `wiki_tips_${slug}`);
    _tipsCache.set(slug, promise);
    promise.catch(() => _tipsCache.delete(slug));
  }
  return promise;
}

/**
 * Wiki-Katalog (alle Spiele mit Wiki), gecacht pro Session.
 * @returns {Promise<any[]>}
 */
export function getWikiCatalog() {
  let promise = _catalogPromise;
  if (!promise) {
    promise = fetchWikiCatalog().catch((/** @type {any} */ err) => {
      _catalogPromise = null;
      throw err;
    });
    _catalogPromise = promise;
  }
  return promise;
}

/** Kompatibilitäts-Alias für den App-Start (App.svelte, fire-and-forget Warmup). */
export const loadWikiCatalog = getWikiCatalog;

/**
 * Spiel-Übersicht: Katalogeintrag + Manifest + Modul-Metadaten — OHNE Moduldaten.
 * Damit ist die Landing-Seite schnell; Inhalte lädt getGameModule() lazy (P2.3).
 *
 * @param {string} slug Wiki-Slug (z. B. 'on-mars')
 * @returns {Promise<{slug: string, catalogEntry: any, manifest: any, basePath: string, modules: any[]}>}
 */
export function getGameOverview(slug) {
  let promise = _overviewCache.get(slug);
  if (!promise) {
    promise = buildGameOverview(slug).catch((/** @type {any} */ err) => {
      _overviewCache.delete(slug);
      throw err;
    });
    _overviewCache.set(slug, promise);
  }
  return promise;
}

/** @param {string} slug */
async function buildGameOverview(slug) {
  const catalog = await getWikiCatalog();
  const catalogEntry = catalog.find((/** @type {any} */ g) => g.key === slug);
  if (!catalogEntry) throw new Error('Spiel nicht im Wiki-Katalog gefunden.');

  let manifest;
  let basePath = '';
  if (catalogEntry.wiki?.manifest) {
    try {
      const loaded = await loadGameManifest(catalogEntry);
      manifest = loaded.manifest;
      basePath = loaded.basePath;
    } catch (err) {
      throw new Error(`Wiki nicht verfügbar: ${/** @type {any} */ (err)?.message}`);
    }
  } else {
    manifest = { game: { key: slug, name: catalogEntry.name }, version: '1.0.0', modules: [] };
  }

  const modules = [...(manifest.modules || [])];
  // Tipps-Modul immer anbieten (auch leer, damit die UI den Leerzustand zeigen kann).
  if (!modules.some((/** @type {any} */ m) => m.id === TIPS_MODULE_ID)) {
    modules.push({
      id: TIPS_MODULE_ID,
      type: 'tips',
      title: 'Tipps & Strategien',
      icon: 'lightbulb',
      featured: true
    });
  }

  return { slug, catalogEntry, manifest, basePath, modules };
}

/**
 * Mapped einen PocketBase-wiki_items-Record auf das Wiki-Eintragsformat.
 * Vorhandene Felder (timing, tags, warnings, Quelle) werden durchgereicht (P2.2).
 * @param {any} item @param {{id: string, title: string}} moduleDef
 */
function mapPbItem(item, moduleDef) {
  const host = pbHost();
  return {
    id: item.item_id || item.id,
    type: 'card',
    category: moduleDef.title,
    name: item.name,
    image: item.image
      ? `${host}/api/files/${item.collectionId || 'pbc_wiki_items'}/${item.id}/${item.image}`
      : null,
    thumb: item.image
      ? `${host}/api/files/${item.collectionId || 'pbc_wiki_items'}/${item.id}/${item.image}?thumb=300x0`
      : null,
    summary: item.effect || '',
    description: item.tip || '',
    timing: Array.isArray(item.timing) ? item.timing : [],
    tags: Array.isArray(item.tags) && item.tags.length ? item.tags : [moduleDef.id],
    warnings: Array.isArray(item.warnings) ? item.warnings : [],
    source: item.source_document
      ? { document: item.source_document, page: item.source_page ?? null }
      : undefined
  };
}

/**
 * Lädt ein einzelnes Wiki-Modul (lazy, gecacht).
 * Referenz-Module bevorzugen PocketBase-Daten (mit IndexedDB-Fallback) und
 * fallen auf die statische JSON-Quelle zurück, wenn PocketBase nichts liefert.
 *
 * @param {string} slug Wiki-Slug
 * @param {string} moduleId Modul-ID aus dem Manifest
 * @returns {Promise<any>} Modul inkl. data.entries; bei Ladefehlern mit error-Feld
 */
export function getGameModule(slug, moduleId) {
  const key = `${slug}/${moduleId}`;
  let promise = _moduleCache.get(key);
  if (!promise) {
    promise = buildGameModule(slug, moduleId).catch((/** @type {any} */ err) => {
      _moduleCache.delete(key);
      throw err;
    });
    _moduleCache.set(key, promise);
  }
  return promise;
}

/** @param {string} slug @param {string} moduleId */
async function buildGameModule(slug, moduleId) {
  const overview = await getGameOverview(slug);
  const moduleDef = overview.modules.find((/** @type {any} */ m) => m.id === moduleId);
  if (!moduleDef) throw new Error('Bereich nicht gefunden.');

  if (moduleDef.id === TIPS_MODULE_ID) {
    const { items, offline } = await getTips(slug);
    const mappedItems = items.map((/** @type {any} */ e) => ({
      ...e,
      name: e.title ?? '',
      summary: e.content ?? '',
      isHtml: true
    }));
    return { ...moduleDef, data: { entries: mappedItems }, offlineFallback: offline };
  }

  if (moduleDef.type === 'reference') {
    const { items, offline } = await getPbItems(slug);
    const filtered = items
      .filter((/** @type {any} */ item) => item.category_id === moduleDef.id)
      .sort((/** @type {any} */ a, /** @type {any} */ b) => (a.sort_order || 0) - (b.sort_order || 0));

    const validatedEntries = [];
    for (const item of filtered) {
      try {
        const mapped = mapPbItem(item, moduleDef);
        const parsed = wikiEntrySchema.parse(mapped);
        validatedEntries.push(parsed);
      } catch (err) {
        console.warn(`[Wiki Validation] PB-Record ungültig (id: ${item.id}):`, err);
      }
    }

    if (validatedEntries.length > 0) {
      return {
        ...moduleDef,
        sourcePath: `pocketbase://wiki_items?game_key=${slug}&category_id=${moduleDef.id}`,
        data: { entries: validatedEntries },
        offlineFallback: offline
      };
    }
  }

  try {
    return await loadModuleData(overview.basePath, moduleDef);
  } catch (err) {
    console.error(`⚠️ Wiki-Modul konnte nicht geladen werden (${slug}/${moduleId}):`, err);
    return {
      ...moduleDef,
      error: /** @type {any} */ (err)?.message || 'Modul-Daten konnten nicht geladen werden.',
      data: { entries: [] }
    };
  }
}

/**
 * Alle durchsuchbaren Einträge eines Spiels (alle reference-Module, lazy geladen).
 * Jeder Eintrag wird um moduleId/moduleTitle ergänzt, damit Trefferkarten
 * direkt auf die Eintragsseite verlinken können.
 *
 * @param {string} slug Wiki-Slug
 * @returns {Promise<any[]>}
 */
export function getSearchableEntries(slug) {
  let promise = _searchPoolCache.get(slug);
  if (!promise) {
    promise = buildSearchPool(slug).catch((/** @type {any} */ err) => {
      _searchPoolCache.delete(slug);
      throw err;
    });
    _searchPoolCache.set(slug, promise);
  }
  return promise;
}

/** @param {string} slug */
async function buildSearchPool(slug) {
  const overview = await getGameOverview(slug);
  const loaded = await Promise.all(
    overview.modules.map((/** @type {any} */ m) =>
      getGameModule(slug, m.id).catch((err) => {
        console.warn(`[Search Pool] Fehler beim Laden von Modul ${m.id}:`, err);
        return null;
      })
    )
  );

  return loaded.flatMap((/** @type {any} */ mod) => {
    if (!mod || mod.error) return [];
    
    // Normalisierte / statische entries holen
    const entries = Array.isArray(mod.data)
      ? mod.data
      : Array.isArray(mod.data?.entries)
        ? mod.data.entries
        : [];
    
    if (mod.type === 'reference' || mod.type === 'glossary') {
      return entries.map((/** @type {any} */ e) => ({
        ...e,
        moduleId: mod.id,
        moduleTitle: mod.title,
        kind: mod.type || 'reference'
      }));
    }
    
    if (mod.id === TIPS_MODULE_ID || mod.type === 'tips') {
      return entries.map((/** @type {any} */ e) => ({
        ...e,
        id: String(e.id),
        name: e.name || e.title || '',
        summary: e.summary || e.content || '',
        moduleId: mod.id,
        moduleTitle: mod.title,
        kind: 'tips'
      }));
    }
    
    if (mod.type === 'faq') {
      const items = mod.data?.items || [];
      return items.map((/** @type {any} */ item, /** @type {number} */ index) => ({
        id: `${mod.id}-faq-${index}`,
        name: item.question ?? '',
        summary: item.answer ?? '',
        moduleId: mod.id,
        moduleTitle: mod.title,
        kind: 'faq'
      }));
    }
    
    if (mod.type === 'article') {
      const sections = mod.data?.sections || [];
      const result = [];
      if (mod.data?.content) {
        result.push({
          id: `${mod.id}-article-main`,
          name: mod.data.title || mod.title,
          summary: mod.data.content,
          moduleId: mod.id,
          moduleTitle: mod.title,
          kind: 'article'
        });
      }
      sections.forEach((/** @type {any} */ sect, /** @type {number} */ index) => {
        result.push({
          id: `${mod.id}-section-${index}`,
          name: sect.title || mod.title,
          summary: sect.content,
          moduleId: mod.id,
          moduleTitle: mod.title,
          kind: 'article'
        });
      });
      return result;
    }
    
    if (mod.type === 'checklist') {
      const sections = mod.data?.sections || [{ title: '', items: mod.data?.items || [] }];
      return sections.flatMap((/** @type {any} */ sect, /** @type {number} */ sIdx) => {
        const items = sect.items || [];
        return items.map((/** @type {any} */ item, /** @type {number} */ iIdx) => ({
          id: `${mod.id}-chk-${sIdx}-${iIdx}`,
          name: item.text ?? '',
          summary: item.note ?? '',
          moduleId: mod.id,
          moduleTitle: mod.title,
          kind: 'checklist'
        }));
      });
    }
    
    if (mod.type === 'scoring') {
      const sections = mod.data?.sections || [];
      return sections.flatMap((/** @type {any} */ sect, /** @type {number} */ sIdx) => {
        const items = sect.items || [];
        return items.map((/** @type {any} */ item, /** @type {number} */ iIdx) => ({
          id: `${mod.id}-score-${sIdx}-${iIdx}`,
          name: item.name ?? '',
          summary: item.description ?? '',
          moduleId: mod.id,
          moduleTitle: mod.title,
          kind: 'scoring'
        }));
      });
    }
    
    return [];
  });
}

/**
 * Leert die Memory-Caches (z. B. nach einem Daten-Update).
 * @param {string} [slug] Wenn angegeben, wird nur dieses Spiel geleert.
 */
export function invalidateWikiCache(slug) {
  if (slug) {
    _overviewCache.delete(slug);
    _pbItemsCache.delete(slug);
    _tipsCache.delete(slug);
    _searchPoolCache.delete(slug);
    for (const key of _moduleCache.keys()) {
      if (key.startsWith(`${slug}/`)) _moduleCache.delete(key);
    }
  } else {
    _catalogPromise = null;
    _overviewCache.clear();
    _moduleCache.clear();
    _pbItemsCache.clear();
    _tipsCache.clear();
    _searchPoolCache.clear();
  }
}
