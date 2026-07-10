// @ts-check
/**
 * Treffer-Hervorhebung für Suchergebnisse (P4.2).
 * Zerlegt einen Text in Segmente, die als Text bzw. <mark> gerendert werden —
 * bewusst ohne {@html}, damit keine Injektionsfläche entsteht.
 */

/** @param {string} value */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} text Anzuzeigender Text
 * @param {string} query Suchbegriff(e), durch Leerzeichen getrennt
 * @returns {Array<{ text: string, hit: boolean }>} Segmente in Originalreihenfolge
 */
export function splitByTerms(text, query) {
  const value = String(text ?? '');
  const terms = String(query ?? '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!value || terms.length === 0) return value ? [{ text: value, hit: false }] : [];

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  const lowerTerms = terms.map((t) => t.toLowerCase());
  return value
    .split(pattern)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, hit: lowerTerms.includes(part.toLowerCase()) }));
}
