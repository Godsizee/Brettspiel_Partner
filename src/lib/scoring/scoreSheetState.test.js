import { describe, it, expect } from 'vitest';
import { ScoreSheetState } from './scoreSheetState.svelte.js';

const T = { key: 't', categories: [
  { id: 'a', label: 'A', type: 'sum' },
  { id: 'm', label: 'M', type: 'multiplier', multiplier: 3 },
  { id: 'i', label: 'Info', type: 'info', lines: ['x'] },
], expansion: { label: 'E', extraCategories: [{ id: 'x', label: 'X', type: 'sum' }] } };

describe('ScoreSheetState', () => {
  it('rechnet alle Spieler, nicht nur den aktiven', () => {
    const s = new ScoreSheetState(T, ['Anna', 'Ben']);
    s.setScore('a', 5); s.setActive(1); s.setScore('m', 2);
    expect(s.totals).toEqual([5, 6]);
  });
  it('Undo stellt den Wert vor der Eingabe her', () => {
    const s = new ScoreSheetState(T, ['Anna']);
    s.setScore('a', 7); s.commitScore('a', 7, 0);
    expect(s.undoDepth).toBe(1);
    s.undo();
    expect(s.players[0].scores.a).toBe(0);
  });
  it('Erweiterung zählt nur, wenn aktiv; Ausschalten nullt alle Spieler', () => {
    const s = new ScoreSheetState(T, ['Anna', 'Ben']);
    s.setScore('x', 4);
    expect(s.totals[0]).toBe(0);
    s.setExpansion(true);
    expect(s.totals[0]).toBe(4);
    s.setExpansion(false);
    expect(s.players[0].scores.x).toBe(0);
  });
  it('Payload hat die gespeicherte Form', () => {
    const s = new ScoreSheetState(T, ['Anna']);
    s.setScore('a', 3);
    expect(s.toPayload()).toEqual([{ player_name: 'Anna', score_details: { a: 3, m: 0, x: 0 }, total_score: 3 }]);
  });
  it('fromPayload stellt Entwurf her', () => {
    const s = ScoreSheetState.fromPayload(T, [{ player_name: 'Cem', score_details: { a: 9 }, total_score: 9 }]);
    expect(s.players[0].name).toBe('Cem');
    expect(s.totals[0]).toBe(9);
  });
});
