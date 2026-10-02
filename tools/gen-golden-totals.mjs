// Erzeugt src/lib/scoring/__fixtures__/golden-totals.json aus der ALTEN Rechenlogik.
// Einmal in R01 ausführen und committen. Danach NIE neu erzeugen — die Datei ist die Wahrheit.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import * as legacy from '../src/lib/scoring/legacyCalculators.js';

const raw = JSON.parse(readFileSync(new URL('../games_config.json', import.meta.url), 'utf8'));
const templates = Array.isArray(raw) ? raw : Object.values(raw);
const SCORABLE = new Set(['sum', 'multiplier', 'step', 'popularity_driver']);
// Rechner fragen das DOM nur nach Badge-Zielen; null = „nicht vorhanden“ → kein DOM-Zugriff.
const STUB = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const cats = (t) => [...(t.categories ?? []), ...(t.expansion?.extraCategories ?? [])].filter((c) => SCORABLE.has(c.type));
const fill = (t, v) => Object.fromEntries(cats(t).map((c) => [c.id, v]));
function randomScores(t, rnd) {
  const s = {};
  for (const c of cats(t)) {
    const max = c.type === 'step' ? (c.steps?.length ?? 1) + 1 : c.id === 'popularity' ? 18 : 25;
    const min = c.allowNegative ? -10 : 0;
    s[c.id] = min + Math.floor(rnd() * (max - min + 1));
  }
  return s;
}
function legacyTotals(t, players, expansion) {
  if (t.calculator === 'age_of_innovation') {
    const sheet = { players: players.map((s) => ({ name: 'x', scores: { ...s }, total: 0 })), activePlayerIndex: 0 };
    return players.map((_, i) => { sheet.activePlayerIndex = i; return legacy.ageOfInnovationCalculator(sheet, STUB); });
  }
  const fn = t.calculator ? legacy.LEGACY_CALCULATORS[t.calculator] : null;
  if (t.calculator && !fn) throw new Error(`Unbekannter Rechner: ${t.calculator}`);
  return players.map((s) => (fn ? fn({ ...s }, STUB) : legacy.legacyGenericTotal(t, { ...s }, expansion)));
}

const out = { generatedAt: new Date().toISOString(), sourceCommit: execSync('git rev-parse --short HEAD').toString().trim(), games: {} };
for (const t of templates) {
  const cases = [];
  for (const expansion of t.expansion ? [false, true] : [false]) {
    cases.push({ name: 'zeros', expansion, players: [fill(t, 0), fill(t, 0)] });
    cases.push({ name: 'ones', expansion, players: [fill(t, 1), fill(t, 1), fill(t, 1)] });
    for (let seed = 1; seed <= 25; seed++) {
      const rnd = mulberry32(seed * 7919 + t.key.length);
      cases.push({ name: `seed-${seed}`, expansion, players: [randomScores(t, rnd), randomScores(t, rnd), randomScores(t, rnd)] });
    }
  }
  out.games[t.key] = cases.map((c) => ({ ...c, totals: legacyTotals(t, c.players, c.expansion) }));
}
mkdirSync(new URL('../src/lib/scoring/__fixtures__/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/lib/scoring/__fixtures__/golden-totals.json', import.meta.url), JSON.stringify(out, null, 1));
const n = Object.values(out.games).reduce((a, c) => a + c.length, 0);
console.log(`Spiele: ${Object.keys(out.games).length} · Fälle: ${n}`);
