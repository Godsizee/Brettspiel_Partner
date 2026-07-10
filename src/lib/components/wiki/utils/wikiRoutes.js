// @ts-check
import { buildHash } from '$lib/router/router.js';

export const ROUTES = [
  { name: 'wiki-search', pattern: ['wiki', ':game', 'search'] },
  { name: 'wiki-entry', pattern: ['wiki', ':game', ':module', ':entry'] },
  { name: 'wiki-module', pattern: ['wiki', ':game', ':module'] },
  { name: 'wiki-game', pattern: ['wiki', ':game'] },
  { name: 'wiki-overview', pattern: ['wiki'] }
];

/** Hash-Builder für alle Wiki-Routen — einzige Stelle, an der Wiki-URLs entstehen. */
export const wikiHash = {
  overview: () => '#/wiki',
  /** @param {string} game */
  game: (game) => buildHash(['wiki', game]),
  /** @param {string} game @param {string} moduleId */
  module: (game, moduleId) => buildHash(['wiki', game, moduleId]),
  /** @param {string} game @param {string} moduleId @param {string} entryId */
  entry: (game, moduleId, entryId) => buildHash(['wiki', game, moduleId, entryId]),
  /**
   * Suche: Query UND Filter leben in der URL (P4.1) — teilbar, Reload-fest.
   * @param {string} game
   * @param {{ q?: string, category?: string|null, timing?: string|null, edition?: string|null, expansion?: string|null }} [params]
   */
  search: (game, params = {}) => {
    /** @type {Record<string, string>} */
    const query = {};
    for (const key of ['q', 'category', 'timing', 'edition', 'expansion']) {
      const value = /** @type {any} */ (params)[key];
      if (value) query[key] = String(value);
    }
    return buildHash(['wiki', game, 'search'], query);
  }
};

/**
 * Elternroute einer Route ("Hoch"-Navigation für den Zurück-Pfeil im Header).
 * @param {import('$lib/router/router.js').Route | null} route
 * @returns {string | null} Hash der Elternebene oder null (Übersicht hat keine)
 */
export function parentHash(route) {
  if (!route) return null;
  switch (route.name) {
    case 'wiki-entry':
      return wikiHash.module(route.params.game, route.params.module);
    case 'wiki-module':
    case 'wiki-search':
      return wikiHash.game(route.params.game);
    case 'wiki-game':
      return wikiHash.overview();
    default:
      return null;
  }
}
