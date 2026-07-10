// @ts-check
/**
 * ==========================================================================
 * BOARDGAME COMPANION - STATS SERVICE
 * ==========================================================================
 * Reine, seiteneffektfreie Aggregations-Funktionen für das Statistik-Dashboard.
 *
 * Bewusst ohne IO (kein IndexedDB, kein PocketBase, keine Stores), damit die
 * gesamte Auswertungslogik isoliert per Vitest testbar ist. Die UI (SVG-Geometrie,
 * Farben, Formatierung) bleibt in der Komponente.
 *
 * Robustheit: Alle Funktionen tolerieren fehlerhafte/teilweise Daten — Nicht-Arrays,
 * fehlende `player_scores`, fehlende/ungültige Scores oder Datumswerte führen nicht
 * zu Exceptions, sondern werden defensiv übersprungen.
 */

/**
 * @typedef {{ player_name?: string, total_score?: number, score_details?: Record<string, number> }} PlayerScore
 * @typedef {{ game_name?: string, date?: string, duration?: number, player_scores?: PlayerScore[], expand?: { player_scores?: PlayerScore[] }, [k: string]: any }} Match
 */

/** Sicherstellen, dass wir mit einem Array arbeiten. @param {any} v @returns {any[]} */
function asArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Liefert die Spielerwertungen eines Matches – unterstützt sowohl lokale Matches
 * (`player_scores`) als auch PocketBase-Expansionen (`expand.player_scores`).
 * @param {Match} match
 * @returns {PlayerScore[]}
 */
export function getScores(match) {
  if (!match) return [];
  return asArray(match.player_scores ?? match.expand?.player_scores);
}

/**
 * Robuste Zahl-Konvertierung: ungültige Werte werden zu 0.
 * @param {any} v
 * @returns {number}
 */
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sieger eines Matches = höchste Gesamtpunktzahl. Bei Gleichstand gewinnt der
 * zuerst gelistete Spieler (deterministisch, identisch zur bisherigen UI-Logik).
 * @param {Match} match
 * @returns {PlayerScore|null}
 */
export function getWinner(match) {
  const scores = getScores(match);
  if (!scores.length) return null;
  return scores.reduce((best, cur) =>
    toNum(cur.total_score) > toNum(best.total_score) ? cur : best
  );
}

/**
 * Führt lokale und Remote-Matches zusammen. Remote (PocketBase) ist die
 * kanonische Quelle und gewinnt bei Übereinstimmung; lokale Matches ohne
 * Remote-Gegenstück (noch nicht synchronisiert / Gast) bleiben erhalten.
 * Ergebnis ist absteigend nach Datum sortiert.
 * @param {Match[]} local
 * @param {Match[]} remote
 * @returns {Match[]}
 */
export function mergeMatches(local, remote) {
  /** @type {Map<string, Match>} */
  const byKey = new Map();
  for (const m of asArray(local)) {
    const key = m?.local_id || m?.id;
    if (key) byKey.set(key, m);
  }
  for (const r of asArray(remote)) {
    if (r?.local_id && byKey.has(r.local_id)) {
      byKey.set(r.local_id, { ...byKey.get(r.local_id), ...r, pb_id: r.id });
    } else if (r?.id) {
      byKey.set(r.id, { ...r, pb_id: r.id });
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
  );
}

/**
 * Alle eindeutigen Spielernamen (alphabetisch sortiert).
 * @param {Match[]} matches
 * @returns {string[]}
 */
export function listPlayers(matches) {
  const set = new Set();
  for (const m of asArray(matches)) {
    for (const ps of getScores(m)) {
      if (ps?.player_name) set.add(ps.player_name);
    }
  }
  return Array.from(set).sort();
}

/**
 * Kennzahlen für die Highlight-Kacheln.
 * @param {Match[]} matches
 * @returns {{ totalMatches: number, avgDurationMin: number, highscore: { playerName: string, score: number, gameName: string } | null }}
 */
export function computeOverview(matches) {
  const list = asArray(matches);

  const timed = list.filter((m) => toNum(m.duration) > 0);
  const avgDurationMin = timed.length
    ? Math.round(timed.reduce((acc, m) => acc + toNum(m.duration), 0) / timed.length / 60)
    : 0;

  /** @type {{ playerName: string, score: number, gameName: string } | null} */
  let highscore = null;
  for (const m of list) {
    for (const ps of getScores(m)) {
      const score = toNum(ps.total_score);
      if (!highscore || score > highscore.score) {
        highscore = {
          playerName: ps.player_name ?? '–',
          score,
          gameName: m.game_name ?? '–'
        };
      }
    }
  }

  return { totalMatches: list.length, avgDurationMin, highscore };
}

/**
 * Siegverteilung als Donut-Segmente (absteigend nach Siegen).
 * `offset` ist der kumulierte Prozent-Startpunkt für den SVG-Donut.
 * Farben werden bewusst NICHT vergeben (Präsentation der Komponente überlassen).
 * @param {Match[]} matches
 * @returns {{ name: string, count: number, percent: number, offset: number }[]}
 */
export function computeWinRateSegments(matches) {
  /** @type {Record<string, number>} */
  const winCounts = {};
  for (const m of asArray(matches)) {
    const winner = getWinner(m);
    if (winner?.player_name) {
      winCounts[winner.player_name] = (winCounts[winner.player_name] || 0) + 1;
    }
  }
  const totalWins = Object.values(winCounts).reduce((a, b) => a + b, 0);

  const segments = Object.entries(winCounts)
    .map(([name, count]) => ({
      name,
      count,
      percent: totalWins > 0 ? (count / totalWins) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);

  let offset = 0;
  return segments.map((seg) => {
    const withOffset = { ...seg, offset };
    offset += seg.percent;
    return withOffset;
  });
}

/**
 * Aktuelle Siegessträhnen je Spieler (absteigend). Ein Match setzt die Strähnen
 * aller Mitspieler außer dem Sieger auf 0; Spieler, die nicht mitspielten,
 * behalten ihre Strähne.
 * @param {Match[]} matches  Absteigend nach Datum sortiert (wie in der UI).
 * @returns {{ name: string, streak: number }[]}
 */
export function computeStreaks(matches) {
  const list = asArray(matches);
  /** @type {Record<string, number>} */
  const streaks = {};
  for (const p of listPlayers(list)) streaks[p] = 0;

  // Chronologisch aufsteigend durchlaufen.
  for (const m of [...list].reverse()) {
    const winner = getWinner(m);
    if (!winner?.player_name) continue;
    const wName = winner.player_name;
    streaks[wName] = (streaks[wName] || 0) + 1;
    for (const ps of getScores(m)) {
      if (ps.player_name && ps.player_name !== wName) streaks[ps.player_name] = 0;
    }
  }

  return Object.entries(streaks)
    .map(([name, streak]) => ({ name, streak }))
    .sort((a, b) => b.streak - a.streak);
}

/**
 * Durchschnittliche Spieldauer (Minuten) je Spiel, absteigend.
 * @param {Match[]} matches
 * @returns {{ name: string, avgMin: number }[]}
 */
export function computeAvgDurationsByGame(matches) {
  /** @type {Record<string, number[]>} */
  const durations = {};
  for (const m of asArray(matches)) {
    const d = toNum(m.duration);
    if (d > 0 && m.game_name) {
      (durations[m.game_name] ||= []).push(d);
    }
  }
  return Object.entries(durations)
    .map(([name, listSecs]) => ({
      name,
      avgMin: Math.round(listSecs.reduce((a, b) => a + b, 0) / listSecs.length / 60)
    }))
    .sort((a, b) => b.avgMin - a.avgMin);
}

/**
 * Punkte-Trend der letzten 10 Partien eines Spielers (chronologisch aufsteigend).
 * @param {Match[]} matches
 * @param {string} player
 * @returns {{ score: number, game: string, dateISO: string }[]}
 */
export function computePlayerTrend(matches, player) {
  if (!player) return [];
  const playerMatches = [...asArray(matches)]
    .reverse()
    .filter((m) => getScores(m).some((ps) => ps.player_name === player));

  return playerMatches.slice(-10).map((m) => {
    const scoreObj = getScores(m).find((ps) => ps.player_name === player);
    return {
      score: toNum(scoreObj?.total_score),
      game: m.game_name ?? '',
      dateISO: m.date ?? ''
    };
  });
}

/**
 * Alle Matches, an denen zwei bestimmte Spieler gemeinsam teilgenommen haben.
 * @param {Match[]} matches
 * @param {string} a
 * @param {string} b
 * @returns {Match[]}
 */
export function getHeadToHeadMatches(matches, a, b) {
  if (!a || !b || a === b) return [];
  return asArray(matches).filter((m) => {
    const names = getScores(m).map((ps) => ps.player_name);
    return names.includes(a) && names.includes(b);
  });
}

/**
 * Direktvergleich zweier Spieler.
 * @param {Match[]} matches
 * @param {string} a
 * @param {string} b
 * @returns {{ count: number, aWins: number, bWins: number, aAvg: number, bAvg: number, aMax: number, bMax: number, favGame: string }}
 */
export function computeHeadToHead(matches, a, b) {
  const h2h = getHeadToHeadMatches(matches, a, b);
  let aWins = 0, bWins = 0, aSum = 0, bSum = 0, aMax = 0, bMax = 0;
  /** @type {Record<string, number>} */
  const gamesCount = {};

  for (const m of h2h) {
    const winner = getWinner(m);
    if (winner?.player_name === a) aWins++;
    if (winner?.player_name === b) bWins++;

    const aObj = getScores(m).find((ps) => ps.player_name === a);
    const bObj = getScores(m).find((ps) => ps.player_name === b);
    if (aObj) { const s = toNum(aObj.total_score); aSum += s; if (s > aMax) aMax = s; }
    if (bObj) { const s = toNum(bObj.total_score); bSum += s; if (s > bMax) bMax = s; }

    if (m.game_name) gamesCount[m.game_name] = (gamesCount[m.game_name] || 0) + 1;
  }

  let favGame = '–', maxG = 0;
  for (const [name, c] of Object.entries(gamesCount)) {
    if (c > maxG) { maxG = c; favGame = name; }
  }

  return {
    count: h2h.length,
    aWins,
    bWins,
    aAvg: h2h.length ? Math.round(aSum / h2h.length) : 0,
    bAvg: h2h.length ? Math.round(bSum / h2h.length) : 0,
    aMax,
    bMax,
    favGame
  };
}

/**
 * Eindeutige Spiele, die zwei Spieler gemeinsam gespielt haben.
 * @param {Match[]} matches
 * @param {string} a
 * @param {string} b
 * @returns {string[]}
 */
export function listHeadToHeadGames(matches, a, b) {
  const set = new Set();
  for (const m of getHeadToHeadMatches(matches, a, b)) {
    if (m.game_name) set.add(m.game_name);
  }
  return Array.from(set);
}

/**
 * Durchschnittliche Kategorie-Punkte zweier Spieler in einem bestimmten Spiel –
 * Grundlage für das Radar-/Spider-Chart. Die SVG-Projektion erfolgt in der UI.
 * @param {Match[]} matches
 * @param {string} a
 * @param {string} b
 * @param {string} gameName
 * @param {{ id: string, label: string }[]} categories
 * @returns {{ id: string, label: string, aAvg: number, bAvg: number }[] | null}
 */
export function computeRadarAverages(matches, a, b, gameName, categories) {
  const cats = asArray(categories);
  if (!gameName || !cats.length) return null;

  const games = getHeadToHeadMatches(matches, a, b).filter((m) => m.game_name === gameName);
  if (!games.length) return null;

  /** @type {Record<string, number>} */
  const aSums = {};
  /** @type {Record<string, number>} */
  const bSums = {};
  for (const c of cats) { aSums[c.id] = 0; bSums[c.id] = 0; }

  for (const m of games) {
    const aObj = getScores(m).find((ps) => ps.player_name === a);
    const bObj = getScores(m).find((ps) => ps.player_name === b);
    for (const c of cats) {
      if (aObj?.score_details) aSums[c.id] += toNum(aObj.score_details[c.id]);
      if (bObj?.score_details) bSums[c.id] += toNum(bObj.score_details[c.id]);
    }
  }

  return cats.map((c) => ({
    id: c.id,
    label: c.label,
    aAvg: parseFloat((aSums[c.id] / games.length).toFixed(1)),
    bAvg: parseFloat((bSums[c.id] / games.length).toFixed(1))
  }));
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

/**
 * Gruppiert Matches nach Monat (neueste zuerst) inkl. Monats-MVP und -Favorit.
 * @param {Match[]} matches
 * @returns {{ key: string, label: string, count: number, favGame: string, mvp: string, matches: Match[] }[]}
 */
export function computeTimeline(matches) {
  /** @type {Record<string, { label: string, matches: Match[] }>} */
  const groups = {};
  for (const m of asArray(matches)) {
    const d = new Date(m.date ?? 0);
    if (Number.isNaN(d.getTime())) continue;
    const y = d.getFullYear();
    const monthNum = d.getMonth();
    const key = `${y}-${String(monthNum + 1).padStart(2, '0')}`;
    if (!groups[key]) groups[key] = { label: `${MONTH_NAMES[monthNum]} ${y}`, matches: [] };
    groups[key].matches.push(m);
  }

  return Object.keys(groups)
    .sort()
    .reverse()
    .map((key) => {
      const g = groups[key];
      /** @type {Record<string, number>} */
      const winCounts = {};
      /** @type {Record<string, number>} */
      const gameCounts = {};
      for (const m of g.matches) {
        const winner = getWinner(m);
        if (winner?.player_name) winCounts[winner.player_name] = (winCounts[winner.player_name] || 0) + 1;
        if (m.game_name) gameCounts[m.game_name] = (gameCounts[m.game_name] || 0) + 1;
      }

      let mvpName = '–', maxW = 0;
      for (const [name, w] of Object.entries(winCounts)) {
        if (w > maxW) { maxW = w; mvpName = name; }
      }
      const mvp = mvpName !== '–' ? `${mvpName} (${maxW} ${maxW === 1 ? 'Sieg' : 'Siege'})` : '–';

      let favGame = '–', maxG = 0;
      for (const [name, c] of Object.entries(gameCounts)) {
        if (c > maxG) { maxG = c; favGame = name; }
      }

      return { key, label: g.label, count: g.matches.length, favGame, mvp, matches: g.matches };
    });
}
