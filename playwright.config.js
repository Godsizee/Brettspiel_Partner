// @ts-check
import { defineConfig, devices } from '@playwright/test';

// Achtung: baseURL enthält den App-Pfad. In Tests IMMER relativ navigieren
// (page.goto('./#/…')); page.goto('/') springt auf den Host-Root (Stolperfalle S12).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173/files/Brettspiel_Partner/',
    locale: 'de-DE',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/files/Brettspiel_Partner/',
    reuseExistingServer: true,
    timeout: 240_000,
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
});
