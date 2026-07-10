// @ts-check
/**
 * Einzige Stelle für das Mapping zwischen App-Spiel-Keys (games_config.json,
 * `currentGame`-Store: Unterstriche/Leerzeichen, z. B. "on mars", "la_granja")
 * und Wiki-Slugs (URL + static/data/wiki/games.json: Bindestriche,
 * z. B. "on-mars", "la-granja").
 *
 * Der Slug ist der kanonische, URL-sichere Bezeichner des Wikis (P2.1,
 * siehe Wiki_Refaktorierung.md E2).
 */

/** Sonderfälle, die nicht über die Zeichenersetzung abbildbar sind. */
const APP_TO_SLUG = new Map([
  ['wingspan', 'fluegelschlag'],
  ['on mars', 'on-mars']
]);

const SLUG_TO_APP = new Map([...APP_TO_SLUG].map(([app, slug]) => [slug, app]));

/**
 * App-Key → Wiki-Slug (URL-Form).
 * @param {string} appKey z. B. "on mars", "la_granja"
 * @returns {string} z. B. "on-mars", "la-granja"
 */
export function toSlug(appKey) {
  if (!appKey) return '';
  const special = APP_TO_SLUG.get(appKey);
  if (special) return special;
  return appKey.replace(/[_\s]+/g, '-');
}

/**
 * Wiki-Slug → App-Key (games_config-Form).
 * @param {string} slug z. B. "on-mars", "la-granja"
 * @returns {string} z. B. "on mars", "la_granja"
 */
export function toAppKey(slug) {
  if (!slug) return '';
  const special = SLUG_TO_APP.get(slug);
  if (special) return special;
  return slug.replace(/-/g, '_');
}
