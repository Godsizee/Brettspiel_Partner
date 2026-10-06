// @ts-check
const BASE = import.meta.env.BASE_URL; // '/files/Brettspiel_Partner/'

/**
 * Sanitizes local image path to prevent dangerous protocol injection (wörtlich aus GenericScoreSheet).
 * @param {string|null|undefined} path
 * @returns {string}
 */
export function sanitizeImagePath(path) {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lower = trimmed.toLowerCase();
  if (dangerous.some((d) => lower.includes(d)) || lower.includes('expression(') || lower.includes('<') || lower.includes('>')) {
    console.warn('🚫 Blocked dangerous image path:', path);
    return '';
  }
  return trimmed;
}

/**
 * Kategorie-Icon → URL (identisch zur alten Normalisierung, Stolperfalle S17):
 * .png → .webp, Präfix `/files/Brettspiel_Partner/` und führendes `/` entfernen, dann BASE_URL davor.
 * @param {string|undefined} icon
 */
export function categoryIconUrl(icon) {
  if (!icon) return '';
  let path = icon;
  if (path.endsWith('.png')) path = path.slice(0, -4) + '.webp';
  const prefix = '/files/Brettspiel_Partner/';
  if (path.startsWith(prefix)) path = path.slice(prefix.length);
  if (path.startsWith('/')) path = path.slice(1);
  const safe = sanitizeImagePath(path);
  return safe ? BASE + safe : '';
}
