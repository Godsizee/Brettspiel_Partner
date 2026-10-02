// Screenshots aller Hauptrouten: 360/390/1280 px × hell/dunkel.
// Aufruf: node tests/visual/capture.mjs <ausgabeordner> [baseUrl]
// Standard-baseUrl ist der Preview-Server (vorher: npm run build && npx vite preview --port 4173).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { prepare } from '../support/seed.js';

const OUT = process.argv[2] ?? './.shots/now';
const BASE = process.argv[3] ?? 'http://localhost:4173/files/Brettspiel_Partner/';
const ROUTES = [
  ['home', '#/'], ['game', '#/spiel/on-mars'], ['history', '#/chronik'], ['stats', '#/chronik/statistik'],
  ['profile', '#/profil'], ['settings', '#/profil/einstellungen'], ['wiki', '#/wiki'], ['wiki-game', '#/wiki/on-mars'],
];
const VIEWPORTS = [['m360', 360, 780], ['m390', 390, 844], ['d1280', 1280, 860]];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [vpName, width, height] of VIEWPORTS) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width, height }, colorScheme: theme, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await prepare(page, { user: true });
    for (const [name, hash] of ROUTES) {
      await page.goto('./' + hash);
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT, `${vpName}-${theme}-${name}.png`) });
    }
    await ctx.close();
  }
}
await browser.close();
console.log('Screenshots in', OUT);
