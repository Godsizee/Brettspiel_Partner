// Tintbare Haus-Symbol-Icons (Voidfall).
// Ein Icon pro Haus (schwarze Silhouette als webp), per Slug aufgeloest und ueberall
// wiederverwendet (Szenario-Chips + Haus-Detailseiten). Die Icons werden im Frontend
// per CSS-mask + `currentColor` eingefaerbt -> theme-adaptiv (schwarz im Light-,
// hell im Dark-Mode).
//
// Verfuegbarkeit kommt aus static/images/voidfall/haeuser/index.json, das der
// Verarbeitungs-Watcher (scripts/watch_house_screenshots.py) pflegt. So erscheint ein
// Icon erst, sobald es tatsaechlich gecroppt/erzeugt wurde (kein kaputter Mask-Kasten).

const BASE_URL = import.meta.env.BASE_URL || '/';

function resolveImg(path) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return path;
  return `${BASE_URL.replace(/\/$/, '')}${path}`;
}

/** Slug wie in Python (slugify): lowercase, Umlaute ersetzt, non-alnum -> '_'. */
export function houseSlug(name) {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

let available = $state(new Set());
let loaded = false;

/** Laedt den Verfuegbarkeits-Index einmalig (idempotent, nur im Browser sinnvoll). */
export function ensureHouseIcons() {
  if (loaded) return;
  loaded = true;
  fetch(resolveImg('/images/voidfall/haeuser/index.json'))
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      available = new Set(Array.isArray(list) ? list : []);
    })
    .catch(() => {
      // Kein Index (noch keine Icons) -> Chips bleiben einfach ohne Symbol.
    });
}

/**
 * Icon-URL fuer einen Hausnamen ODER -slug, oder null wenn (noch) nicht vorhanden.
 * Reaktiv: sobald ensureHouseIcons() den Index nachlaedt, aktualisieren sich Aufrufer.
 * @param {string} nameOrSlug
 * @returns {string | null}
 */
export function houseIconUrl(nameOrSlug) {
  const slug = houseSlug(nameOrSlug);
  return available.has(slug) ? resolveImg(`/images/voidfall/haeuser/${slug}.webp`) : null;
}
