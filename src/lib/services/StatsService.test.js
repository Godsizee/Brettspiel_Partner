import { describe, it, expect } from 'vitest';
import {
  getScores,
  getWinner,
  mergeMatches,
  listPlayers,
  computeOverview,
  computeWinRateSegments,
  computeStreaks,
  computeAvgDurationsByGame,
  computePlayerTrend,
  getHeadToHeadMatches,
  computeHeadToHead,
  listHeadToHeadGames,
  computeRadarAverages,
  computeTimeline
} from './StatsService.js';

/** Hilfs-Factory für ein Match */
function match(game_name, date, duration, scores) {
  return { game_name, date, duration, player_scores: scores };
}
function ps(player_name, total_score, score_details) {
  return { player_name, total_score, score_details };
}

describe('StatsService – Helfer', () => {
  it('getScores unterstützt player_scores und expand.player_scores', () => {
    expect(getScores({ player_scores: [ps('A', 1)] })).toHaveLength(1);
    expect(getScores({ expand: { player_scores: [ps('A', 1)] } })).toHaveLength(1);
    expect(getScores(null)).toEqual([]);
    expect(getScores({})).toEqual([]);
  });

  it('getWinner liefert höchste Punktzahl, bei Gleichstand den ersten', () => {
    expect(getWinner(match('G', '2026-01-01', 0, [ps('A', 10), ps('B', 20)]))?.player_name).toBe('B');
    expect(getWinner(match('G', '2026-01-01', 0, [ps('A', 20), ps('B', 20)]))?.player_name).toBe('A');
    expect(getWinner(match('G', '2026-01-01', 0, []))).toBeNull();
  });

  it('getWinner ignoriert ungültige Scores (NaN -> 0)', () => {
    const m = match('G', '2026-01-01', 0, [ps('A', undefined), ps('B', 5)]);
    expect(getWinner(m)?.player_name).toBe('B');
  });
});

describe('StatsService – mergeMatches', () => {
  it('Remote gewinnt bei gleicher local_id, lokale Gast-Matches bleiben', () => {
    const local = [
      { local_id: 'l1', date: '2026-01-01', game_name: 'A', player_scores: [] },
      { local_id: 'l2', date: '2026-01-02', game_name: 'GastOnly', player_scores: [] }
    ];
    const remote = [{ id: 'r1', local_id: 'l1', date: '2026-01-01', game_name: 'A-remote', player_scores: [] }];
    const merged = mergeMatches(local, remote);
    expect(merged).toHaveLength(2);
    const fromL1 = merged.find((m) => m.local_id === 'l1');
    expect(fromL1.game_name).toBe('A-remote');
    expect(fromL1.pb_id).toBe('r1');
    expect(merged.find((m) => m.game_name === 'GastOnly')).toBeTruthy();
  });

  it('sortiert absteigend nach Datum', () => {
    const merged = mergeMatches(
      [
        { id: '1', date: '2026-01-01', player_scores: [] },
        { id: '2', date: '2026-03-01', player_scores: [] }
      ],
      []
    );
    expect(merged[0].id).toBe('2');
  });

  it('toleriert Nicht-Arrays', () => {
    expect(mergeMatches(null, undefined)).toEqual([]);
  });
});

describe('StatsService – Aggregationen', () => {
  const matches = [
    match('Wingspan', '2026-03-10', 3600, [ps('Anna', 80), ps('Ben', 70)]),
    match('Wingspan', '2026-03-05', 1800, [ps('Anna', 60), ps('Ben', 90)]),
    match('Scythe', '2026-02-20', 7200, [ps('Anna', 50), ps('Cara', 40)])
  ];

  it('listPlayers liefert sortierte eindeutige Namen', () => {
    expect(listPlayers(matches)).toEqual(['Anna', 'Ben', 'Cara']);
  });

  it('computeOverview berechnet Anzahl, Ø Dauer und Highscore', () => {
    const o = computeOverview(matches);
    expect(o.totalMatches).toBe(3);
    // (3600 + 1800 + 7200) / 3 / 60 = 70
    expect(o.avgDurationMin).toBe(70);
    expect(o.highscore).toEqual({ playerName: 'Ben', score: 90, gameName: 'Wingspan' });
  });

  it('computeOverview ohne Daten ist robust', () => {
    expect(computeOverview([])).toEqual({ totalMatches: 0, avgDurationMin: 0, highscore: null });
    expect(computeOverview(null).totalMatches).toBe(0);
  });

  it('computeWinRateSegments summiert Siege mit kumuliertem Offset', () => {
    const segs = computeWinRateSegments(matches);
    // Anna gewinnt Spiel 1 & 3, Ben Spiel 2
    const anna = segs.find((s) => s.name === 'Anna');
    const ben = segs.find((s) => s.name === 'Ben');
    expect(anna.count).toBe(2);
    expect(ben.count).toBe(1);
    expect(segs[0].offset).toBe(0);
    expect(Math.round(segs[0].percent + segs[1].percent)).toBe(100);
  });

  it('computeStreaks zählt Strähnen und setzt Mitspieler zurück', () => {
    const streaks = computeStreaks(matches);
    const anna = streaks.find((s) => s.name === 'Anna');
    // Chronologisch: Scythe(Anna+), Wingspan05(Ben+ -> Anna reset 0), Wingspan10(Anna+ ->1)
    expect(anna.streak).toBe(1);
    expect(streaks.find((s) => s.name === 'Cara').streak).toBe(0);
  });

  it('computeAvgDurationsByGame mittelt je Spiel', () => {
    const d = computeAvgDurationsByGame(matches);
    expect(d.find((x) => x.name === 'Scythe').avgMin).toBe(120);
    expect(d.find((x) => x.name === 'Wingspan').avgMin).toBe(45); // (3600+1800)/2/60
  });

  it('computeAvgDurationsByGame ignoriert Matches ohne Dauer', () => {
    const d = computeAvgDurationsByGame([match('X', '2026-01-01', 0, [ps('A', 1)])]);
    expect(d).toEqual([]);
  });

  it('computePlayerTrend liefert chronologische letzte 10 Partien', () => {
    const trend = computePlayerTrend(matches, 'Anna');
    expect(trend).toHaveLength(3);
    expect(trend[0].score).toBe(50); // ältestes zuerst (Scythe)
    expect(trend[trend.length - 1].score).toBe(80);
  });

  it('computePlayerTrend ohne Spieler ist leer', () => {
    expect(computePlayerTrend(matches, '')).toEqual([]);
  });
});

describe('StatsService – Head-to-Head', () => {
  const matches = [
    match('Wingspan', '2026-03-10', 3600, [ps('Anna', 80), ps('Ben', 70)]),
    match('Wingspan', '2026-03-05', 1800, [ps('Anna', 60), ps('Ben', 90)]),
    match('Scythe', '2026-02-20', 7200, [ps('Anna', 50), ps('Cara', 40)])
  ];

  it('getHeadToHeadMatches findet gemeinsame Partien', () => {
    expect(getHeadToHeadMatches(matches, 'Anna', 'Ben')).toHaveLength(2);
    expect(getHeadToHeadMatches(matches, 'Anna', 'Anna')).toEqual([]);
  });

  it('computeHeadToHead bilanziert Siege, Schnitt, Max und Lieblingsspiel', () => {
    const h = computeHeadToHead(matches, 'Anna', 'Ben');
    expect(h.count).toBe(2);
    expect(h.aWins).toBe(1);
    expect(h.bWins).toBe(1);
    expect(h.aAvg).toBe(70); // (80+60)/2
    expect(h.bAvg).toBe(80); // (70+90)/2
    expect(h.aMax).toBe(80);
    expect(h.bMax).toBe(90);
    expect(h.favGame).toBe('Wingspan');
  });

  it('listHeadToHeadGames liefert eindeutige gemeinsame Spiele', () => {
    expect(listHeadToHeadGames(matches, 'Anna', 'Ben')).toEqual(['Wingspan']);
  });

  it('computeRadarAverages mittelt Kategorie-Details', () => {
    const m = [
      match('Wingspan', '2026-03-10', 0, [
        ps('Anna', 80, { birds: 30, eggs: 10 }),
        ps('Ben', 70, { birds: 20, eggs: 20 })
      ]),
      match('Wingspan', '2026-03-05', 0, [
        ps('Anna', 60, { birds: 10, eggs: 30 }),
        ps('Ben', 90, { birds: 40, eggs: 10 })
      ])
    ];
    const cats = [{ id: 'birds', label: 'Vögel' }, { id: 'eggs', label: 'Eier' }];
    const radar = computeRadarAverages(m, 'Anna', 'Ben', 'Wingspan', cats);
    expect(radar).toHaveLength(2);
    expect(radar[0]).toMatchObject({ id: 'birds', aAvg: 20, bAvg: 30 });
    expect(radar[1]).toMatchObject({ id: 'eggs', aAvg: 20, bAvg: 15 });
  });

  it('computeRadarAverages ohne Kategorien/Spiel -> null', () => {
    expect(computeRadarAverages(matches, 'Anna', 'Ben', '', [])).toBeNull();
    expect(computeRadarAverages(matches, 'Anna', 'Ben', 'Wingspan', [])).toBeNull();
  });
});

describe('StatsService – Timeline', () => {
  it('gruppiert nach Monat mit MVP und Favorit, neueste zuerst', () => {
    const matches = [
      match('Wingspan', '2026-03-10', 0, [ps('Anna', 80), ps('Ben', 70)]),
      match('Wingspan', '2026-03-05', 0, [ps('Anna', 90), ps('Ben', 60)]),
      match('Scythe', '2026-02-20', 0, [ps('Ben', 50), ps('Anna', 40)])
    ];
    const tl = computeTimeline(matches);
    expect(tl).toHaveLength(2);
    expect(tl[0].label).toBe('März 2026');
    expect(tl[0].count).toBe(2);
    expect(tl[0].favGame).toBe('Wingspan');
    expect(tl[0].mvp).toBe('Anna (2 Siege)');
    expect(tl[1].label).toBe('Februar 2026');
  });

  it('überspringt Matches mit ungültigem Datum', () => {
    const tl = computeTimeline([match('X', 'kein-datum', 0, [ps('A', 1)])]);
    expect(tl).toEqual([]);
  });
});
