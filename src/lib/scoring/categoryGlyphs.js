// @ts-check
// Inline-SVG-Bibliothek für Kategorien ohne Bild-Icon (wörtlich aus GenericScoreSheet.js).
// Die Ausgabe wird per {@html} gerendert; das ist sicher, weil nur Schlüssel dieser Konstanten-Tabelle
// und eine bereinigte Farbe eingesetzt werden.

/** @type {Record<string, string>} */
export const SVG_ICONS = {
  star:     `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  heart:    `<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>`,
  hexagon:  `<polygon points="12 2 22 8.5 22 15.5 12 19 2 15.5 2 8.5"/>`,
  activity: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  mappin:   `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
  copy:     `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
  diamond:  `<polygon points="12 2 22 12 12 22 2 12"/>`,
  sliders:  `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>`,
  book:     `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
  tree:     `<path d="M12 22V12"/><path d="M5 12l7-9 7 9H5z"/><path d="M3 17l9-5 9 5H3z"/>`,
  layers:   `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
  columns:  `<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>`,
  water:    `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`,
  up:       `<polyline points="18 15 12 9 6 15"/>`,
  down:     `<polyline points="6 9 12 15 18 9"/>`,
  left:     `<polyline points="15 18 9 12 15 6"/>`,
  right:    `<polyline points="9 18 15 12 9 6"/>`,
  cave:     `<path d="M12 2L2 19h20L12 2z"/><path d="M9 19v-3a3 3 0 0 1 6 0v3"/>`,
  coin:     `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><path d="M16 8h-4a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/>`,
  home:     `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  building: `<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/><rect x="8" y="6" width="3" height="3"/><rect x="13" y="6" width="3" height="3"/>`,
  'triangle-circle': `<polygon points="12 2 2 22 22 22"/><circle cx="12" cy="13" r="3"/>`,
};

/**
 * Sanitizes CSS color value to prevent style attribute injection (wörtlich).
 * @param {string|null|undefined} color
 * @returns {string}
 */
export function sanitizeCssColor(color) {
  if (!color || typeof color !== 'string') return '';
  // Block common injection vectors: quotes, semicolons, backslashes, expressions, url()
  const blocked = [';', '"', "'", '\\', 'url', 'expression', 'javascript'];
  const lower = color.toLowerCase();
  if (blocked.some((b) => lower.includes(b))) {
    console.warn('🚫 Blocked dangerous color:', color);
    return '';
  }
  return color;
}

/**
 * @param {string} name
 * @param {string} [color]
 * @returns {string}
 */
export function makeSvgIcon(name, color) {
  const paths = SVG_ICONS[name] || SVG_ICONS['star'];
  const isFilled = ['star', 'heart', 'diamond'].includes(name);
  return `<svg viewBox="0 0 24 24" width="22" height="22"
        fill="${isFilled ? 'currentColor' : 'none'}"
        stroke="${isFilled ? 'none' : 'currentColor'}"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        style="color:${sanitizeCssColor(color) || 'currentColor'}">${paths}</svg>`;
}
