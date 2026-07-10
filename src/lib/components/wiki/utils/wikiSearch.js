// @ts-check

const indexCache = new WeakMap();

/**
 * Foldet deutsche Umlaute in ihre ae/oe/ue/ss Umschrift.
 * @param {string} str
 * @returns {string}
 */
export function foldUmlauts(str) {
  return String(str || '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/Ä/g, 'ae')
    .replace(/Ö/g, 'oe')
    .replace(/Ü/g, 'ue');
}

/**
 * Normalisiert einen Wert für die Suche (lowercase, Umlaut-Folding + Diakritika-Entfernung).
 * Liefert sowohl die gefaltete als auch die diakritikafreie Version zurück (Leerschritt-separiert).
 * @param {any} value
 * @returns {string}
 */
export function normalize(value) {
  const str = String(value || '').toLowerCase().trim();
  if (!str) return '';

  const folded = foldUmlauts(str)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  const stripped = str
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  if (folded === stripped) {
    return folded;
  }
  return `${folded} ${stripped}`;
}

/**
 * @param {any} entry
 * @returns {string[]}
 */
function collectStrings(entry) {
  return [
    entry.name,
    entry.summary,
    entry.details,
    entry.description,
    ...(entry.tags || []),
    ...(entry.aliases || []),
    ...(entry.warnings || []),
    entry.category,
    entry.type
  ]
    .filter(Boolean)
    .map(normalize);
}

/**
 * Rückwärtskompatible Hilfsfunktion für alte Suchtests.
 * @param {any[]} entries
 * @returns {Array<{entry: any, haystack: string}>}
 */
export function buildSearchIndex(entries = []) {
  return entries.map((entry) => ({
    entry,
    haystack: collectStrings(entry).join(' ')
  }));
}

/**
 * Holt den normalisierten Index für die übergebenen Einträge (Lazy/WeakMap).
 * @param {any[]} entries
 * @returns {any[]}
 */
export function getOrBuildIndex(entries) {
  if (indexCache.has(entries)) {
    return indexCache.get(entries);
  }

  const indexed = entries.map((entry, index) => {
    return {
      entry,
      originalIndex: index,
      normName: normalize(entry.name),
      normTags: (entry.tags || []).map(normalize),
      normCategory: normalize(entry.category || entry.moduleTitle),
      normVolltext: [
        entry.summary,
        entry.description,
        entry.details,
        ...(entry.warnings || []),
        ...(entry.aliases || [])
      ]
        .filter(Boolean)
        .map(normalize)
        .join(' ')
    };
  });

  indexCache.set(entries, indexed);
  return indexed;
}

/**
 * Sucht in den Einträgen nach der angegebenen Abfrage.
 * Ranking: Name-Treffer > Tag/Kategorie-Treffer > Volltext-Treffer.
 * Bei Score-Gleichstand gilt die Original-Reihenfolge.
 * @param {any[]} entries
 * @param {string|null|undefined} query
 * @returns {any[]}
 */
export function searchEntries(entries = [], query) {
  if (query === undefined) return [];

  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return entries;

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return entries;

  const indexed = getOrBuildIndex(entries);

  return indexed
    .map((item) => {
      let score = 0;
      for (const term of terms) {
        if (item.normName.includes(term)) {
          score += 1000;
        } else if (item.normCategory.includes(term) || item.normTags.some((/** @type {string} */ t) => t.includes(term))) {
          score += 100;
        } else if (item.normVolltext.includes(term)) {
          score += 1;
        }
      }
      return { entry: item.entry, score, originalIndex: item.originalIndex };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
    .map((item) => item.entry);
}