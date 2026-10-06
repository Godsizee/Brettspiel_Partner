// Test-Helfer: gespeicherte Partien in IndexedDB (bg_matches) anlegen — für Chronik/Statistik-Tests.
// Nutzung: await seedMatches(page, makeMatches()) nach prepare(page); danach page.reload().

/** 14 Partien aus 3 Monaten, 3 Spiele, 2–3 Spieler, mit Kategorie-Details (On Mars). */
export function makeMatches() {
  const games = [
    { name: 'On Mars', ids: ['ingame_vp', 'progress', 'ships', 'colonists'] },
    { name: 'Scythe', ids: ['stars', 'regions', 'coins'] },
    { name: 'Arche Nova', ids: ['arche_nova_appeal', 'arche_nova_conservation'] },
  ];
  const people = ['Anna', 'Ben', 'Cleo'];
  const base = new Date('2026-10-05T19:30:00Z').getTime();
  return Array.from({ length: 14 }, (_, i) => {
    const g = games[i % games.length];
    const n = i % 4 === 0 ? 3 : 2;
    const scores = people.slice(0, n).map((name, p) => {
      const details = Object.fromEntries(g.ids.map((id, k) => [id, ((i * 7 + p * 5 + k * 3) % 13) + 1]));
      const total = Object.values(details).reduce((a, b) => a + b, 0) + ((i + p) % 3) * 4;
      return { player_name: name, score_details: details, total_score: total };
    });
    return {
      id: `seed_${i}`, local_id: `seed_${i}`, game_name: g.name,
      duration: 1800 + i * 420,
      date: new Date(base - i * 5 * 86_400_000).toISOString(),
      player_scores: scores, sync_status: ['local_only', 'pending', 'synced', 'failed'][i % 4],
    };
  });
}

/** @param {import('@playwright/test').Page} page @param {any[]} matches */
export async function seedMatches(page, matches) {
  await page.evaluate((list) => new Promise((resolve, reject) => {
    const req = indexedDB.open('boardgame_companion_db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keyval');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put(list, 'bg_matches');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    };
  }), matches);
}
