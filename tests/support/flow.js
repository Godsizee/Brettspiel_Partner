import { expect } from '@playwright/test';

/**
 * Spielt eine komplette Partie Mischwald mit zwei Spielern und speichert sie.
 * Voraussetzung: prepare(page, { user: true }) wurde aufgerufen.
 * Endet auf der Startseite (nach „Fertig“ im Ergebnis-Sheet).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ total: number }>}
 */
export async function playMatch(page, { first = 10, second = 7 } = {}) {
  await page.goto('./#/spiel/mischwald');
  await page.getByRole('link', { name: 'Partie starten' }).click();
  await page.getByPlaceholder('Spieler 1 oder E-Mail').fill('Anna');
  await page.getByPlaceholder('Spieler 2 oder E-Mail').fill('Ben');
  await page.getByRole('button', { name: 'Los geht’s' }).click();

  // Zeit läuft: der Text ändert sich binnen 2 s
  const timer = page.getByRole('timer');
  const t0 = await timer.innerText();
  await expect.poll(async () => timer.innerText(), { timeout: 4000 }).not.toBe(t0);

  await page.getByRole('button', { name: 'Wertung eintragen' }).click();
  await page.waitForSelector('[role=tablist] [role=tab]');
  const fields = page.locator('input[type=number]');
  await fields.nth(0).fill(String(first));
  await fields.nth(0).blur();
  await fields.nth(1).fill(String(second));
  await fields.nth(1).blur();
  const total = first + second;
  await expect(page.getByLabel(/^Gesamtpunktzahl/)).toHaveAccessibleName(`Gesamtpunktzahl ${total}`);

  await page.getByRole('button', { name: 'Speichern' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ergebnis' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Partie lokal gespeichert')).toBeVisible();
  await sheet.getByRole('button', { name: 'Fertig' }).click();
  await expect(page).toHaveURL(/#\/$/);
  return { total };
}
