// @ts-check
/**
 * Games Catalog Service
 * Lädt die Spiel-Templates aus PocketBase → IndexedDB → games_config.json
 * SECURITY: Alle Daten werden mit Zod validiert vor Verwendung
 */
import { get } from 'svelte/store';
import { gamesCatalog, isOnline, pocketbaseHost, DEFAULT_POCKETBASE_HOST } from '../stores/app.js';
import { db } from './DbService.js';
import { GameListSchema, GameSchema, validateGameSafe } from '../schemas/gameSchema.js';
import { z } from 'zod';
import { fetchWithTimeout } from '../utils/timeout.js';

/**
 * Normalizes image paths inside a game record to use the correct BASE_URL.
 * @param {any} game 
 */
export function normalizeGamePaths(game) {
  const base = import.meta.env.BASE_URL || '/';

  // Migriere alte gecachte Cover-Pfade die mit '/' statt BASE_URL beginnen
  // (passiert wenn vorher '/' + filename statt BASE_URL + filename gespeichert wurde)
  if (base !== '/' && game.cover && game.cover.startsWith('/') && !game.cover.startsWith('http') && !game.cover.startsWith(base)) {
    game.cover = base + game.cover.substring(1);
  }

  // Convert local .png image paths to .webp since only .webp files exist in static assets folder
  const isPbCover = game.cover && game.cover !== game.cover_image && !game.cover.startsWith('http') && !game.cover.startsWith('/') && !game.cover.startsWith('.') && game.id;
  if (game.cover && game.cover.endsWith('.png') && !game.cover.startsWith('http') && !isPbCover) {
    game.cover = game.cover.slice(0, -4) + '.webp';
  }
  const isPbCoverImage = game.cover_image && !game.cover_image.startsWith('http') && !game.cover_image.startsWith('/') && !game.cover_image.startsWith('.') && game.id;
  if (game.cover_image && game.cover_image.endsWith('.png') && !game.cover_image.startsWith('http') && !isPbCoverImage) {
    game.cover_image = game.cover_image.slice(0, -4) + '.webp';
  }
  const isPbModalImage = game.modal && game.modal.image && !game.modal.image.startsWith('http') && !game.modal.image.startsWith('/') && !game.modal.image.startsWith('.') && game.id;
  if (game.modal && game.modal.image && game.modal.image.endsWith('.png') && !game.modal.image.startsWith('http') && !isPbModalImage) {
    game.modal.image = game.modal.image.slice(0, -4) + '.webp';
  }
  const isPbExpansionModal = game.expansion && game.expansion.expansionModal && !game.expansion.expansionModal.startsWith('http') && !game.expansion.expansionModal.startsWith('/') && !game.expansion.expansionModal.startsWith('.') && game.id;
  if (game.expansion && game.expansion.expansionModal && game.expansion.expansionModal.endsWith('.png') && !game.expansion.expansionModal.startsWith('http') && !isPbExpansionModal) {
    game.expansion.expansionModal = game.expansion.expansionModal.slice(0, -4) + '.webp';
  }

  // If cover is a PocketBase filename (not a path or URL), construct full URL
  if (game.cover && game.cover !== game.cover_image && !game.cover.startsWith('http') && !game.cover.startsWith('/') && !game.cover.startsWith('.') && game.id) {
    const host = get(pocketbaseHost) || DEFAULT_POCKETBASE_HOST;
    game.cover = `${host}/api/files/${game.collectionId || 'games'}/${game.id}/${game.cover}`;
  }

  // Normalize cover
  if (game.cover) {
    if (!game.cover.startsWith('http') && !game.cover.startsWith('/') && !game.cover.startsWith('.')) {
      game.cover = base + game.cover;
    }
  } else if (game.cover_image) {
    if (!game.cover_image.startsWith('http') && !game.cover_image.startsWith('/') && !game.cover_image.startsWith('.')) {
      game.cover = base + game.cover_image;
    } else {
      game.cover = game.cover_image;
    }
  }
  
  // Normalize modal sheet image
  if (game.modal && game.modal.image && !game.modal.image.startsWith('http') && !game.modal.image.startsWith('/') && !game.modal.image.startsWith('.')) {
    game.modal.image = base + game.modal.image;
  }

  // Normalize expansion modal image
  if (game.expansion && game.expansion.expansionModal && !game.expansion.expansionModal.startsWith('http') && !game.expansion.expansionModal.startsWith('/') && !game.expansion.expansionModal.startsWith('.')) {
    game.expansion.expansionModal = base + game.expansion.expansionModal;
  }

  // Normalize wiki item images
  if (game.wiki?.categories) {
    for (const cat of game.wiki.categories) {
      for (const item of (cat.items ?? [])) {
        if (item.image && item.image !== '' && !item.image.startsWith('http') && !item.image.startsWith('/') && !item.image.startsWith('.')) {
          item.image = base + item.image;
        }
      }
    }
  }
}

/**
 * F6: Merged benutzerdefinierte Spiele in den Katalog-Store.
 * Muss in JEDEM Lade-Pfad laufen (PocketBase, IndexedDB-Cache, lokale Config) —
 * sonst verschwinden eigene Spiele aus der Spielauswahl, sobald der Online-
 * oder Cache-Pfad greift (P1.1).
 */
export async function mergeCustomGamesIntoCatalog() {
  try {
    const { getCustomGames } = await import('./DbService.js');
    const customGames = await getCustomGames();
    if (customGames.length > 0) {
      gamesCatalog.update(catalog => {
        const updated = { ...catalog };
        customGames.forEach((/** @type {any} */ g) => {
          normalizeGamePaths(g);
          updated[g.key] = g;
        });
        return updated;
      });
    }
  } catch (e) {
    console.warn('⚠️ Fehler beim Laden der Custom Games:', e);
  }
}

export async function loadGamesCatalog() {
  const host = get(pocketbaseHost);
  const online = get(isOnline);
  let cacheLoaded = false;

  // 1. IndexedDB Cache sofort laden
  const cached = await db.get('bg_games_catalog');
  if (cached && Object.keys(cached).length > 0) {
    try {
      for (const key in cached) {
        const validated = validateGameSafe(cached[key]);
        if (!validated) {
          delete cached[key];
        } else {
          cached[key].cover = cached[key].cover || cached[key].cover_image || '';
          normalizeGamePaths(cached[key]);
        }
      }
      
      if (Object.keys(cached).length > 0) {
        gamesCatalog.set(cached);
        cacheLoaded = true;
        console.log('📦 Games catalog loaded from IndexedDB cache - validated.');
        await mergeCustomGamesIntoCatalog();
      }
    } catch (e) {
      console.warn('⚠️ Cached games validation failed.', e);
    }
  }

  // 2. Lokales Fallback, wenn kein Cache da ist
  if (!cacheLoaded) {
    try {
      const resp = await fetchWithTimeout(`${import.meta.env.BASE_URL}games_config.json`, {}, 10000);
      const list = await resp.json();
      try {
        const validatedGames = GameListSchema.parse(list);
        /** @type {Record<string, any>} */
        const catalog = {};
        for (const g of validatedGames) {
          g.cover = g.cover || g.cover_image || '';
          normalizeGamePaths(g);
          catalog[g.key] = g;
        }
        gamesCatalog.set(catalog);
        console.log(`📂 Games catalog loaded from local games_config.json (${validatedGames.length} games) - validated.`);
        await mergeCustomGamesIntoCatalog();
      } catch (validationError) {
        gamesCatalog.set({});
      }
    } catch (e) {
      gamesCatalog.set({});
    }
  }

  // 3. PocketBase im Hintergrund laden (SWR)
  if (online) {
    (async () => {
      try {
        const url = `${host}/api/collections/games/records?sort=order&perPage=50`;
        const resp = await fetchWithTimeout(url, {}, 15000);
        if (resp.ok) {
          const data = await resp.json();
          if (data.items && data.items.length > 0) {
            try {
              const validatedGames = GameListSchema.parse(data.items);
              
              let localConfig = [];
              try {
                const localResp = await fetchWithTimeout(`${import.meta.env.BASE_URL}games_config.json`, {}, 10000);
                if (localResp.ok) localConfig = await localResp.json();
              } catch (err) {}

              /** @type {Record<string, any>} */
              const catalog = {};
              for (const item of validatedGames) {
                const localGame = localConfig.find((/** @type {any} */ g) => g.key === item.key);
                const fallbackCover = localGame ? (localGame.cover || localGame.cover_image) : null;
                
                if (item.cover || item.cover_image) {
                  item.cover = item.cover || item.cover_image;
                } else if (fallbackCover) {
                  const base = import.meta.env.BASE_URL || '/';
                  item.cover = base + (fallbackCover.startsWith('/') ? fallbackCover.substring(1) : fallbackCover);
                } else {
                  item.cover = '';
                }
                
                if (!item.wiki && localGame?.wiki) {
                  item.wiki = localGame.wiki;
                }

                normalizeGamePaths(item);
                catalog[item.key] = item;
              }
              gamesCatalog.set(catalog);
              await db.set('bg_games_catalog', catalog);
              console.log(`✅ Games catalog updated from PocketBase (${validatedGames.length} games) in background.`);
              await mergeCustomGamesIntoCatalog();
            } catch (validationError) {
              console.warn('⚠️ PocketBase background update validation failed.', validationError);
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ PocketBase background fetch failed.', e);
      }
    })();
  }
}
