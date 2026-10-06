// @ts-check
// Gemeinsamer Zustand + Aktionen für Spiele (Startseite und Spiel-Seite): Favorit, Sammlung,
// Wunschliste, eigenes Spiel löschen. Speicher-Keys unverändert (Plan B4).
import { get } from 'svelte/store';
import { showToast, confirmDialog, pocketbaseHost, authService } from '$lib/stores/app.js';
import { deleteCustomGame } from '$lib/services/DbService.js';
import { loadGamesCatalog } from '$lib/services/GamesCatalogService.js';

const KEYS = { favorites: 'bg_favorites', owned: 'bg_owned_games', wishlist: 'bg_wishlist_games' };

/** Lebt auf Modulebene: beide Screens sehen denselben Zustand. */
export const collection = $state({
  favorites: /** @type {string[]} */ ([]),
  owned: /** @type {string[]} */ ([]),
  wishlist: /** @type {string[]} */ ([]),
});

/** Liest die drei Listen aus dem localStorage (beim Einhängen eines Screens aufrufen). */
export function loadCollection() {
  for (const [field, key] of Object.entries(KEYS)) {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? '[]');
      collection[/** @type {'favorites'|'owned'|'wishlist'} */ (field)] = Array.isArray(value) ? value : [];
    } catch (_) {
      collection[/** @type {'favorites'|'owned'|'wishlist'} */ (field)] = [];
    }
  }
}

/** @param {'favorites'|'owned'|'wishlist'} field */
function persist(field) {
  localStorage.setItem(KEYS[field], JSON.stringify(collection[field]));
}

/** @param {string} key */
export function toggleFavorite(key) {
  collection.favorites = collection.favorites.includes(key)
    ? collection.favorites.filter((k) => k !== key)
    : [...collection.favorites, key];
  persist('favorites');
  showToast(collection.favorites.includes(key) ? 'Als Favorit markiert' : 'Favorit entfernt', 'success');
}

/** @param {string} key */
export function toggleOwned(key) {
  if (collection.owned.includes(key)) {
    collection.owned = collection.owned.filter((k) => k !== key);
  } else {
    collection.owned = [...collection.owned, key];
    collection.wishlist = collection.wishlist.filter((k) => k !== key);
    persist('wishlist');
  }
  persist('owned');
  showToast(collection.owned.includes(key) ? 'Zur Spielesammlung hinzugefügt' : 'Aus Spielesammlung entfernt', 'success');
}

/** @param {string} key */
export function toggleWishlist(key) {
  if (collection.wishlist.includes(key)) {
    collection.wishlist = collection.wishlist.filter((k) => k !== key);
  } else {
    collection.wishlist = [...collection.wishlist, key];
    collection.owned = collection.owned.filter((k) => k !== key);
    persist('owned');
  }
  persist('wishlist');
  showToast(collection.wishlist.includes(key) ? 'Zur Wunschliste hinzugefügt' : 'Von Wunschliste entfernt', 'success');
}

/**
 * Löscht ein eigenes Spiel nach Rückfrage.
 * @param {string} key
 * @returns {Promise<boolean>} true, wenn gelöscht wurde
 */
export async function deleteCustomGameEntry(key) {
  if (!(await confirmDialog('Dieses benutzerdefinierte Spiel wirklich löschen?'))) return false;
  try {
    await deleteCustomGame(key, { host: get(pocketbaseHost), token: authService.getToken() ?? undefined });
    await loadGamesCatalog();
    showToast('Spiel gelöscht.', 'success');
    return true;
  } catch (_) {
    showToast('Fehler beim Löschen.', 'error');
    return false;
  }
}
