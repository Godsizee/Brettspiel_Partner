// @ts-check
/** Erlaubte Farbformate für Werte aus Nutzerdaten/Katalog (Schutz vor style-Injection). */
const COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|(rgb|rgba|hsl|hsla)\([0-9.,%\s/-]+\))$/i;

/** @param {unknown} value @param {string} [fallback] */
export function safeCssColor(value, fallback = '') {
  return typeof value === 'string' && COLOR_RE.test(value.trim()) ? value.trim() : fallback;
}

/** @param {string} color @returns {[number, number, number] | null} */
function toRgb(color) {
  const c = color.trim();
  let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = c.match(/^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
  if (m) {
    const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
  }
  m = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** @param {[number, number, number]} rgb */
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const DARK = '#1a1815';
const DARK_L = 0.00924; // Luminanz von #1a1815

/** Lesbare Textfarbe auf einer (Spieler-)Farbe: Schwarz oder Weiß, je nach höherem Kontrast. */
export function onColor(color) {
  const rgb = typeof color === 'string' ? toRgb(color) : null;
  if (!rgb) return DARK;
  const L = luminance(rgb);
  return (L + 0.05) / (DARK_L + 0.05) >= 1.05 / (L + 0.05) ? DARK : '#ffffff';
}
