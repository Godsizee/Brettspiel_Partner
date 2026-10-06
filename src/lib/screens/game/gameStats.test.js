import { describe, it, expect } from 'vitest';
import { computeGameStats, formatDuration } from './gameStats.js';

const match = (game_name, duration, scores) => ({
  game_name,
  duration,
  player_scores: scores.map(([player_name, total_score]) => ({ player_name, total_score })),
});

describe('computeGameStats', () => {
  it('liefert Nullwerte ohne Partien', () => {
    expect(computeGameStats([], 'On Mars', 'on_mars')).toEqual({ count: 0, avgDuration: 0, lastWinner: null, topPlayer: null });
  });

  it('filtert nach Spielname oder game_id und ignoriert Partien ohne Wertung', () => {
    const matches = [
      match('On Mars', 3600, [['Anna', 40], ['Ben', 30]]),
      match('Wingspan', 1800, [['Anna', 90]]),
      { game_id: 'on_mars', duration: 7200, player_scores: [{ player_name: 'Ben', total_score: 55 }, { player_name: 'Anna', total_score: 20 }] },
      { game_name: 'On Mars', duration: 100, player_scores: [] },
    ];
    const s = computeGameStats(matches, 'On Mars', 'on_mars');
    expect(s.count).toBe(2);
    expect(s.avgDuration).toBe(5400);
    expect(s.lastWinner).toBe('Ben');
  });

  it('zählt Siege pro Person (Gleichstand: beide bekommen den Sieg)', () => {
    const matches = [
      match('X', 60, [['Anna', 10], ['Ben', 10]]),
      match('X', 60, [['Anna', 12], ['Ben', 5]]),
    ];
    expect(computeGameStats(matches, 'X', 'x').topPlayer).toBe('Anna');
  });
});

describe('formatDuration', () => {
  it('formatiert Stunden und Minuten', () => {
    expect(formatDuration(0)).toBe('—');
    expect(formatDuration(45 * 60)).toBe('45 Min');
    expect(formatDuration(2 * 3600 + 14 * 60)).toBe('2h 14m');
  });
});
