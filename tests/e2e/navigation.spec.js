import { test, expect } from '@playwright/test';
import { prepare } from '../support/seed.js';

test.describe('Navigation und Routen', () => {
  test('Deep Link #/chronik/statistik lädt direkt', async ({ page }) => {
    await prepare(page, { user: true });
    await page.goto('./#/chronik/statistik');
    await page.reload();
    await page.waitForSelector('body[data-initialized="true"]');
    await expect(page.getByRole('heading', { name: 'Chronik', level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Chronik' }).getByRole('link', { name: 'Statistik' })).toHaveAttribute('aria-current', 'page');
  });

  test('Zurück führt Schritt für Schritt: Wiki → Spiel → Startseite', async ({ page }) => {
    await prepare(page, { user: true });
    await page.goto('./#/');
    await page.goto('./#/spiel/mischwald');
    await expect(page.getByRole('heading', { name: 'Mischwald', level: 1 })).toBeVisible();
    await page.goto('./#/wiki/mischwald');
    await expect(page).toHaveURL(/#\/wiki\/mischwald/);

    await page.goBack();
    await expect(page).toHaveURL(/#\/spiel\/mischwald$/);
    await expect(page.getByRole('heading', { name: 'Mischwald', level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/#\/$/);
  });

  test('Reload auf #/partie/wertung ohne laufende Partie führt zur Startseite', async ({ page }) => {
    await prepare(page, { user: true });
    await page.goto('./#/partie/wertung');
    await page.reload();
    await page.waitForSelector('body[data-initialized="true"]');
    await expect(page).toHaveURL(/#\/$/);
  });

  test('Spielname mit ß: #/spiel/die-blumenstraße', async ({ page }) => {
    await prepare(page, { user: true });
    await page.goto('./#/spiel/die-blumenstraße');
    await expect(page.getByRole('heading', { name: 'Die Blumenstraße', level: 1 })).toBeVisible();
  });

  test('Unbekanntes Spiel führt zur Startseite', async ({ page }) => {
    await prepare(page, { user: true });
    await page.goto('./#/spiel/gibtsnicht');
    await expect(page).toHaveURL(/#\/$/);
  });
});
