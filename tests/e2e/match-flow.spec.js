import { test, expect } from '@playwright/test';
import { prepare } from '../support/seed.js';
import { playMatch } from '../support/flow.js';

test('Partie: Spiel → Spieler → Live → Wertung → Ergebnis → Chronik', async ({ page }) => {
  await prepare(page, { user: true });
  const { total } = await playMatch(page);
  expect(total).toBe(17);

  await page.goto('./#/chronik');
  await expect(page.getByRole('navigation', { name: 'Chronik' })).toBeVisible();
  const card = page.getByRole('article').filter({ hasText: 'Mischwald' }).filter({ hasText: 'Pkt.' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Anna');
  await expect(card).toContainText(`${total} Pkt.`);
});
