// @ts-check
/**
 * Reine Wertungslogik. Kein DOM, keine Stores. Ergebnis pro Spieler:
 * { total, badges: { [kategorieId]: Anzeigetext }, panel? } — Badges/Panel sind reine Anzeige.
 * Wahrheit für Summen: src/lib/scoring/__fixtures__/golden-totals.json (R01).
 */
import { CALCULATORS } from './calculators.js';

/** @typedef {{ total: number, badges: Record<string, string>, panel?: { title: string, label: string, tone: 'danger'|'warning'|'success', items: Array<{ label: string, value: string }> } }} PlayerResult */

/**
 * @param {any} template Spiel-Template (games_config / PocketBase `games`)
 * @param {Array<{ scores: Record<string, number> }>} players
 * @param {{ expansionActive?: boolean }} [opts]
 * @returns {PlayerResult[]}
 */
export function computeResults(template, players, opts = {}) {
  if (!template) return players.map(() => ({ total: 0, badges: {} }));
  const calc = template.calculator ? CALCULATORS[template.calculator] : null;
  return players.map((p) => (calc ? calc(p.scores ?? {}, template, opts) : genericCompute(p.scores ?? {}, template, opts)));
}

/**
 * Generischer Zweig (sum / multiplier / step; popularity_driver und info zählen nicht).
 * @param {Record<string, number>} scores @param {any} template @param {{ expansionActive?: boolean }} [opts]
 * @returns {PlayerResult}
 */
export function genericCompute(scores, template, { expansionActive = false } = {}) {
  const cats = [...(template.categories ?? []), ...(expansionActive ? template.expansion?.extraCategories ?? [] : [])];
  let total = 0;
  /** @type {Record<string, string>} */
  const badges = {};
  for (const cat of cats) {
    const val = scores[cat.id] || 0;
    if (cat.type === 'sum') {
      total += val;
    } else if (cat.type === 'multiplier') {
      const pts = val * (cat.multiplier || 1);
      total += pts;
      if (pts > 0) badges[cat.id] = `ergibt ${pts} SP`;
    } else if (cat.type === 'step') {
      const steps = cat.steps || [];
      const pts = steps[Math.min(val, steps.length - 1)] || 0;
      total += pts;
      if (pts > 0) badges[cat.id] = `Stufe ${val} → ${pts} SP`;
    }
  }
  return { total, badges };
}

/**
 * Platz eines Spielers (Gleichstand teilt den Platz): 1 + Anzahl Spieler mit mehr Punkten.
 * @param {number[]} totals @param {number} index
 */
export function rankOf(totals, index) {
  return 1 + totals.filter((t) => t > totals[index]).length;
}
