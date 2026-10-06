// @ts-check
import { get } from 'svelte/store';
import { authService, currentUser } from '$lib/stores/app.js';
import { pullFromRemote } from '$lib/services/DbService.js';
import { getMatchRepository } from '$lib/services/MatchRepository.js';
import { mergeMatches } from '$lib/services/StatsService.js';

/**
 * Alle Partien für Chronik und Statistik (Logik wörtlich aus MatchHistory/StatsDashboard).
 * Offline-first: lokal gespeicherte Partien werden IMMER geladen, Remote-Partien kommen dazu, wenn angemeldet.
 * @returns {Promise<{ matches: any[], needsReauth: boolean }>}
 */
export async function loadAllMatches() {
  const token = authService.getToken();
  const user = get(currentUser);

  let localMatches = [];
  try {
    localMatches = await getMatchRepository().getLocalMatches();
  } catch (e) {
    console.warn('Partien: Lokale Matches konnten nicht geladen werden', e);
  }

  let remoteMatches = [];
  let needsReauth = false;
  if (token && user?.id) {
    try {
      remoteMatches = await pullFromRemote(user.id);
    } catch (e) {
      // Kein harter Fehler: lokale Matches werden weiterhin angezeigt.
      console.warn('Partien: PocketBase fetch failed', e);
    }
  } else if (localMatches.length === 0) {
    // Weder angemeldet noch lokale Daten → Hinweis zum Anmelden.
    needsReauth = true;
  }

  return { matches: mergeMatches(localMatches, remoteMatches), needsReauth };
}
