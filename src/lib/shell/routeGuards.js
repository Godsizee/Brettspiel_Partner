// @ts-check
import { get } from 'svelte/store';
import { navigate } from '$lib/router/router.js';
import { appHash } from '$lib/router/appRoutes.js';
import { currentGame, gamesCatalog, isAdmin, showToast } from '$lib/stores/app.js';
import { toSlug } from '$lib/components/wiki/utils/wikiKeys.js';

/** Slug → App-Key über den Katalog. toAppKey() ist NICHT umkehrbar (ß, Leerzeichen) — Stolperfalle S4. */
export function gameKeyFromSlug(/** @type {string} */ slug, /** @type {Record<string, any>} */ catalog) {
  return Object.keys(catalog).find((k) => toSlug(k) === slug) ?? null;
}

/**
 * Prüft, ob die Route angezeigt werden darf; leitet sonst um (replace).
 * @param {import('$lib/router/router.js').Route | null} route
 * @returns {boolean}
 */
export function guardRoute(route) {
  const name = route?.name ?? 'home';
  if (name === 'game') {
    const catalog = get(gamesCatalog);
    if (!Object.keys(catalog).length) return true; // Katalog lädt noch → Screen zeigt Skeleton
    const key = gameKeyFromSlug(route?.params.game ?? '', catalog);
    if (!key) {
      showToast('Spiel nicht gefunden.', 'warning');
      navigate(appHash.home(), { replace: true });
      return false;
    }
    if (get(currentGame) !== key) currentGame.set(key);
    return true;
  }
  if (name.startsWith('match-') && !get(currentGame)) {
    const stored = localStorage.getItem('bg_timer_current_game');
    if (stored) { currentGame.set(stored); return true; }
    navigate(appHash.home(), { replace: true });
    return false;
  }
  if (name === 'admin-review' && !get(isAdmin)) {
    navigate(appHash.home(), { replace: true });
    return false;
  }
  return true;
}
