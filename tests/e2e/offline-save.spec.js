import { test, expect } from '@playwright/test';
import { prepare } from '../support/seed.js';
import { playMatch } from '../support/flow.js';

// Gemessen: MatchRepository.saveCompletedMatch reiht nur ein, wenn ein Konto angemeldet ist.
// Der Test-Nutzer aus seed.js hat kein Token → die Partie bleibt „local_only“, die Warteschlange leer.
// Der Warteschlangen-Pfad („Warteschlange (1 Runden)“) braucht ein echtes Konto und wird manuell geprüft.
test.describe('Offline speichern', () => {
  // „Offline“ = PocketBase blockiert und navigator.onLine=false (prepare). Ein echtes setOffline würde ohne
  // Service Worker (im Test geblockt) auch das Nachladen der JS-Chunks verhindern.
  test('Partie ohne Netz werten, App neu laden, Partie bleibt in der Chronik', async ({ page }) => {
    await prepare(page, { user: true });
    const { total } = await playMatch(page);

    await page.reload();
    await page.waitForSelector('body[data-initialized="true"]');
    await page.goto('./#/chronik');
    await expect(page.getByRole('navigation', { name: 'Chronik' })).toBeVisible();

    const card = page.getByRole('article').filter({ hasText: 'Mischwald' }).filter({ hasText: 'Pkt.' });
    await expect(card).toBeVisible();
    await expect(card).toContainText(`${total} Pkt.`);
    await expect(card.getByRole('img', { name: 'Nur auf diesem Gerät' })).toBeVisible();
  });
});
