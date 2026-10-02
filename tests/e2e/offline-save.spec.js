import { test, expect } from '@playwright/test';

test.describe('Offline First Flow', () => {
  test('App offline öffnen oder Verbindung vor Abschluss trennen und Match speichern', async ({ page }) => {
    // Onboarding überspringen
    await page.addInitScript(() => {
      window.localStorage.setItem('bg_onboarding_completed', 'true');
    });

    // 1. App laden
    await page.goto('/');

    // 2. Netzwerk trennen (offline simulieren)
    await page.route('**/*', route => {
      // Ignore external requests or fail them to simulate offline
      if (route.request().url().includes('/api/collections/')) {
        return route.abort('internetdisconnected');
      }
      return route.continue();
    });

    await page.context().setOffline(true);

    // 3. Spiel starten
    await page.click('text=Mischwald');
    await page.waitForTimeout(500);
    // In GameDashboard:
    await page.click('text=Spiel starten');
    await page.waitForTimeout(500);
    // In PlayerSetup:
    await page.click('text=Wertung starten');
    await page.waitForTimeout(500);

    // In ScoreSheet
    // We assume some default players are there. Just click Save.
    await page.click('button:has-text("Speichern")');

    // Wait for the modal or navigation
    await page.waitForTimeout(1000);

    // 4. Reload
    await page.reload();

    // 5. Historie prüfen (Match sollte da sein)
    await page.click('button[id="btn-open-history"]');
    await page.waitForTimeout(1000);
    // Das Match sollte als "Wartet auf Upload" oder einfach in der Liste sichtbar sein.
    await expect(page.locator('text=Mischwald').first()).toBeVisible();
    
    // Check if the sync modal shows 1 queued match
    await page.click('button[id="sync-status"]');
    await expect(page.locator('text=Warteschlange (1 Runden)')).toBeVisible();
    await page.click('button:has-text("Schließen")');

    // 6. Verbindung wiederherstellen
    await page.context().setOffline(false);
    
    // trigger sync manually or wait for online event
    await page.click('button[id="sync-status"]');
    await page.click('button:has-text("Jetzt synchronisieren")');

    // Queue sollte verarbeiten und keine Dubletten erzeugen
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Warteschlange (0 Runden)')).toBeVisible();
  });
});
