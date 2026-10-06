// @ts-check
/**
 * Kennzahlen eines Spiels aus allen gespeicherten Partien (Logik aus dem alten GameDashboard).
 * @param {any[]} allMatches alle Partien des Geräts/Kontos
 * @param {string} gameName Anzeigename des Spiels
 * @param {string} gameKey App-Key des Spiels
 * @returns {{ count: number, avgDuration: number, lastWinner: string|null, topPlayer: string|null }}
 */
export function computeGameStats(allMatches, gameName, gameKey) {
  const filtered = allMatches.filter(
    (m) => (m.game_name === gameName || m.game_id === gameKey) && m.player_scores?.length
  );
  if (filtered.length === 0) return { count: 0, avgDuration: 0, lastWinner: null, topPlayer: null };

  const totalDuration = filtered.reduce((s, m) => s + (m.duration ?? 0), 0);
  const avgDuration = Math.round(totalDuration / filtered.length);

  const lastScores = filtered[filtered.length - 1]?.player_scores ?? [];
  const maxScore = Math.max(...lastScores.map((/** @type {any} */ p) => p.total_score ?? 0));
  const lastWinner = lastScores.find((/** @type {any} */ p) => p.total_score === maxScore)?.player_name ?? null;

  /** @type {Record<string, number>} */
  const winCounts = {};
  for (const m of filtered) {
    const scores = m.player_scores ?? [];
    const top = Math.max(...scores.map((/** @type {any} */ p) => p.total_score ?? 0));
    for (const p of scores.filter((/** @type {any} */ s) => s.total_score === top)) {
      winCounts[p.player_name] = (winCounts[p.player_name] ?? 0) + 1;
    }
  }
  const topPlayer = Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { count: filtered.length, avgDuration, lastWinner, topPlayer };
}

/** @param {number} secs */
export function formatDuration(secs) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} Min`;
}
