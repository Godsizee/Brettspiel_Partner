// @ts-check

/** @type {Map<string, number>} */
const positions = new Map();

/**
 * Speichert die Scrollposition für einen Hash.
 * @param {string | null} hash
 */
export function rememberScroll(hash) {
  if (hash != null) {
    positions.set(hash, window.scrollY);
  }
}

/**
 * Gibt die gespeicherte Scrollposition für einen Hash zurück.
 * @param {string | null} hash
 * @returns {number}
 */
export function targetScroll(hash) {
  return hash != null ? (positions.get(hash) ?? 0) : 0;
}
