// @ts-check
import { db } from './DbService.js';
import { showToast } from '../stores/app.js';

/** @typedef {{ id: string, title: string, description: string, icon: string, unlockedAt: string }} Achievement */

const DEFINITIONS = [
  { id: 'first_match',   title: 'Erste Partie',      description: 'Dein erstes gespeichertes Match.',           icon: '🎲' },
  { id: 'ten_matches',   title: 'Stammgast',          description: '10 Partien eines Spiels gespielt.',          icon: '🔟' },
  { id: 'five_games',    title: 'Vielspieler',        description: '5 verschiedene Spiele gespielt.',            icon: '🎮' },
  { id: 'marathon',      title: 'Marathonspieler',    description: 'Eine Partie über 4 Stunden gespielt.',       icon: '⏳' },
  { id: 'dominance',     title: 'Dominanz',           description: '3 Siege hintereinander errungen.',           icon: '👑' },
];

/** @returns {Promise<Achievement[]>} */
export async function getAchievements() {
  return (await db.get('bg_achievements')) ?? [];
}

/**
 * Prüft nach Match-Speicherung ob neue Achievements freigeschalten wurden.
 * @param {any[]} allMatches Alle bisherigen Matches inkl. dem neuen
 * @param {string} winnerName Name des Siegers des neuen Matches
 */
export async function checkAchievements(allMatches, winnerName) {
  const unlocked = await getAchievements();
  const unlockedIds = new Set(unlocked.map((/** @type {Achievement} */ a) => a.id));

  /** @param {string} id */
  async function unlock(id) {
    if (unlockedIds.has(id)) return;
    const def = DEFINITIONS.find(d => d.id === id);
    if (!def) return;
    /** @type {Achievement} */
    const achievement = { ...def, unlockedAt: new Date().toISOString() };
    unlocked.push(achievement);
    unlockedIds.add(id);
    await db.set('bg_achievements', unlocked);
    showToast(`${def.icon} Achievement freigeschaltet: ${def.title}!`, 'success');
  }

  // first_match
  if (allMatches.length >= 1) await unlock('first_match');

  // ten_matches — mind. 10 Partien desselben Spiels
  const gameCounts = /** @type {Record<string, number>} */ ({});
  allMatches.forEach(m => { gameCounts[m.game_name] = (gameCounts[m.game_name] || 0) + 1; });
  if (Object.values(gameCounts).some(c => c >= 10)) await unlock('ten_matches');

  // five_games — mind. 5 verschiedene Spiele
  if (Object.keys(gameCounts).length >= 5) await unlock('five_games');

  // marathon — Partie über 4h (14400 Sekunden)
  const latestMatch = allMatches[allMatches.length - 1];
  if (latestMatch && (latestMatch.duration ?? 0) >= 14400) await unlock('marathon');

  // dominance — 3 Siege des selben Spielers in Folge
  if (winnerName) {
    const chronoMatches = [...allMatches].reverse();
    let streak = 0;
    for (const m of chronoMatches) {
      const scores = m.player_scores ?? [];
      const maxScore = Math.max(...scores.map((/** @type {any} */ ps) => ps.total_score ?? 0));
      const winner = scores.find((/** @type {any} */ ps) => (ps.total_score ?? 0) === maxScore);
      const mWinner = winner?.player_name ?? winner?.name ?? '';
      if (mWinner === winnerName) {
        streak++;
        if (streak >= 3) { await unlock('dominance'); break; }
      } else {
        break;
      }
    }
  }
}
