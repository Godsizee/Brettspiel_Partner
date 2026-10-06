// @ts-check
/**
 * Gruppiert die Kategorien eines Spiel-Templates in Sektionen — Reihenfolge des ersten Auftretens,
 * Erweiterungs-Kategorien nach den Basis-Kategorien (wie GenericScoreSheet._renderCategories).
 * @param {any} template
 * @returns {Array<{ name: string, expansionOnly: boolean, cats: Array<any> }>}
 */
export function groupCategories(template) {
  /** @type {Map<string, Array<any>>} */
  const map = new Map();
  const add = (/** @type {any} */ cat, /** @type {boolean} */ isExpansion) => {
    const sec = cat.section || '';
    if (!map.has(sec)) map.set(sec, []);
    /** @type {any[]} */ (map.get(sec)).push({ ...cat, isExpansion });
  };
  for (const cat of template?.categories ?? []) add(cat, false);
  for (const cat of template?.expansion?.extraCategories ?? []) add(cat, true);
  return [...map.entries()].map(([name, cats]) => ({ name, cats, expansionOnly: cats.every((c) => c.isExpansion) }));
}
