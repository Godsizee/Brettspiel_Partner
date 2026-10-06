import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepare, PB_HOST } from '../support/seed.js';
import { makeMatches, seedMatches } from '../support/matches.js';

/** @param {import('@playwright/test').Page} page */
async function expectNoSeriousViolations(page, label) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
  expect(serious.map((v) => `${label} · ${v.id}: ${v.nodes.length} · ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: horizontales Scrollen bei 360 px`).toBeLessThanOrEqual(0);
}

for (const scheme of ['light', 'dark']) {
  test.describe(`A11y Abläufe und Overlays (${scheme})`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 360, height: 780 } });

    test('Onboarding (erster und letzter Schritt)', async ({ page }) => {
      await page.route(`${PB_HOST}/**`, (r) => r.abort('internetdisconnected'));
      await page.goto('./#/');
      await page.waitForSelector('dialog.onb[open]');
      await expectNoSeriousViolations(page, 'Onboarding 1');
      await page.getByRole('button', { name: 'Überspringen' }).click();
      await expect(page.getByLabel('Dein Name')).toBeVisible();
      await expectNoSeriousViolations(page, 'Onboarding Name');
    });

    test('Partie: Spieler → Live → Wertung → Ergebnis', async ({ page }) => {
      await prepare(page, { user: true });
      await page.goto('./#/spiel/mischwald');
      await page.getByRole('link', { name: 'Partie starten' }).click();
      await expectNoSeriousViolations(page, 'Spieler');
      await page.getByPlaceholder('Spieler 1 oder E-Mail').fill('Anna');
      await page.getByPlaceholder('Spieler 2 oder E-Mail').fill('Ben');
      await page.getByRole('button', { name: 'Los geht’s' }).click();
      await expect(page.getByRole('timer')).toBeVisible();
      await expectNoSeriousViolations(page, 'Live');
      await page.getByRole('button', { name: 'Wertung eintragen' }).click();
      await page.waitForSelector('[role=tablist] [role=tab]');
      await page.waitForTimeout(500);
      await expectNoSeriousViolations(page, 'Wertung');
      await page.getByRole('button', { name: 'Speichern' }).click();
      await page.waitForSelector('dialog[open]');
      await page.waitForTimeout(500);
      await expectNoSeriousViolations(page, 'Ergebnis');
    });

    test('Chronik: aufgeklappte Karte, Statistik-Duell', async ({ page }) => {
      await prepare(page, { user: true });
      await seedMatches(page, makeMatches());
      await page.goto('./#/chronik');
      await page.reload();
      await page.waitForSelector('body[data-initialized="true"]');
      await page.locator('article button[aria-expanded]').first().click();
      await page.waitForTimeout(300);
      await expectNoSeriousViolations(page, 'Chronik offen');
      await page.goto('./#/chronik/statistik');
      await page.getByRole('radio', { name: 'Duell' }).click();
      await page.waitForTimeout(300);
      await expectNoSeriousViolations(page, 'Duell');
    });

    test('Anmelde-Sheet und Konto-Sheet', async ({ page }) => {
      await prepare(page, { user: false });
      await page.goto('./#/');
      await page.locator('article a').first().click();
      await page.waitForSelector('dialog[open]');
      await expectNoSeriousViolations(page, 'AuthSheet');
    });
  });
}
