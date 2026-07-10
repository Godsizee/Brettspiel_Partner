// @ts-check

/**
 * @typedef {Object} Entry
 * @property {string} [category]
 * @property {string[]} [timing]
 * @property {string} [edition]
 * @property {string} [expansion]
 * @property {any} [id]
 * @property {string} [name]
 */

/**
 * Sammelt verfügbare Filteroptionen aus einem Eintrags-Array.
 * Gibt Arrays mit 'all' als erstem Element zurück (für Dropdown-Defaults).
 *
 * @param {Entry[]} entries
 * @returns {{ categories: string[]; timings: string[]; editions: string[]; expansions: string[] }}
 */
export function collectFilterOptions(entries = []) {
  const categories = new Set();
  const timings = new Set();
  const editions = new Set();
  const expansions = new Set();

  for (const entry of entries) {
    if (entry.category) categories.add(entry.category);
    for (const timing of entry.timing || []) {
      timings.add(timing);
    }
    if (entry.edition) editions.add(entry.edition);
    if (entry.expansion) expansions.add(entry.expansion);
  }

  return {
    categories: ['all', ...Array.from(categories).sort()],
    timings: ['all', ...Array.from(timings).sort()],
    editions: ['all', ...Array.from(editions).sort()],
    expansions: ['all', ...Array.from(expansions).sort()]
  };
}

/**
 * @typedef {Object} FilterOptions
 * @property {string|null} [category]
 * @property {string|null} [timing]
 * @property {string|null} [edition]
 * @property {string|null} [expansion]
 */

/**
 * Filtert Einträge nach Kategorie, Zeitpunkt, Edition und Erweiterung.
 *
 * @param {Entry[]} entries
 * @param {FilterOptions} filters
 * @returns {Entry[]}
 */
export function filterEntries(entries = [], filters = {}) {
  return entries.filter((entry) => {
    const categoryOk =
      !filters.category || filters.category === 'all' || entry.category === filters.category;

    const timingOk =
      !filters.timing ||
      filters.timing === 'all' ||
      (entry.timing || []).includes(filters.timing);

    const editionOk =
      !filters.edition || filters.edition === 'all' || entry.edition === filters.edition;

    const expansionOk =
      !filters.expansion || filters.expansion === 'all' || entry.expansion === filters.expansion;

    return categoryOk && timingOk && editionOk && expansionOk;
  });
}

/**
 * Gibt alle eindeutigen Kategorien eines Eintrags-Arrays zurück.
 *
 * @param {Entry[]} entries
 * @returns {string[]}
 */
export function collectCategories(entries) {
  return /** @type {string[]} */ ([...new Set(entries.map((e) => e.category).filter(Boolean))]);
}

/**
 * Gibt alle eindeutigen Effektzeitpunkte eines Eintrags-Arrays zurück.
 *
 * @param {Entry[]} entries
 * @returns {string[]}
 */
export function collectTimings(entries) {
  return [...new Set(entries.flatMap((e) => e.timing ?? []))];
}
