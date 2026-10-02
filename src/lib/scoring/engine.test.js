import { describe, it, expect } from 'vitest';
import golden from './__fixtures__/golden-totals.json';
import config from '../../../games_config.json';
import { computeResults, rankOf } from './engine.js';

const templates = Array.isArray(config) ? config : Object.values(config);

describe('Wertungs-Engine = Golden Master (R01)', () => {
  it('Fixture deckt alle Spiele ab', () => {
    expect(Object.keys(golden.games).sort()).toEqual(templates.map((t) => t.key).sort());
  });
  for (const t of templates) {
    it(`${t.key}: alle Fälle identisch`, () => {
      for (const c of golden.games[t.key]) {
        const totals = computeResults(t, c.players.map((scores) => ({ scores })), { expansionActive: c.expansion }).map((r) => r.total);
        expect(totals, `${t.key} · ${c.name} · Erweiterung=${c.expansion}`).toEqual(c.totals);
      }
    });
  }
});

describe('rankOf', () => {
  it('teilt Plätze bei Gleichstand', () => {
    expect([0, 1, 2, 3].map((i) => rankOf([10, 30, 30, 5], i))).toEqual([3, 1, 1, 4]);
  });
});
