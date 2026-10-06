// Test-Helfer: App ohne Onboarding und (optional) mit „eingeloggtem“ Nutzer starten.
// Nutzer wird wie von der App selbst in IndexedDB abgelegt (DB boardgame_companion_db, Store keyval).
// navigator.onLine=false + PocketBase blockiert → App behält den gecachten Nutzer (App-Logik:
// offline ohne Token wird die Identität behalten) und nutzt den lokalen Spielkatalog. Ergebnis:
// deterministische Screenshots ohne Netz.
export const PB_HOST = 'https://pocketbase-boardgame.dasdann.jetzt';

/** @param {import('@playwright/test').Page} page */
export async function prepare(page, { user = false } = {}) {
  await page.route(`${PB_HOST}/**`, (route) => route.abort('internetdisconnected'));
  await page.addInitScript(() => {
    localStorage.setItem('bg_onboarding_completed', 'true');
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
  });
  await page.goto('./#/');
  if (user) {
    await page.evaluate(() => new Promise((resolve, reject) => {
      const req = indexedDB.open('boardgame_companion_db', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('keyval');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put({ id: 'e2e', email: 'e2e@test.local', name: 'Testperson', role: 'user' }, 'bg_user');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      };
    }));
    await page.reload();
  }
  await page.waitForSelector('body[data-initialized="true"]');
}
