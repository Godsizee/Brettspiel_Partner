import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepare } from '../support/seed.js';
import { makeMatches, seedMatches } from '../support/matches.js';

const ROUTES = ['#/', '#/spiel/on-mars', '#/chronik', '#/chronik/statistik', '#/profil', '#/profil/einstellungen',
  '#/profil/rechtliches', '#/wiki', '#/wiki/on-mars'];

for (const scheme of ['light', 'dark']) {
  test.describe(`A11y + Überlauf (${scheme})`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 360, height: 780 } });
    for (const hash of ROUTES) {
      test(hash, async ({ page }) => {
        await prepare(page, { user: true });
        // Chronik/Statistik mit Inhalt prüfen, nicht nur den Leerzustand
        await seedMatches(page, makeMatches());
        await page.goto('./' + hash);
        await page.reload();
        await page.waitForSelector('body[data-initialized="true"]');
        await page.waitForTimeout(800);
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        const serious = violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
        expect(serious.map((v) => `${v.id}: ${v.nodes.length} · ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, 'horizontales Scrollen bei 360 px').toBeLessThanOrEqual(0);
      });
    }
  });
}
