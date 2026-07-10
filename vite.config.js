import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/files/Brettspiel_Partner/',
  test: {
    // Unit-Tests (Vitest) laufen colocated unter src/; tests/e2e gehört Playwright.
    include: ['src/**/*.test.js'],
  },
  server: {
    port: 8080,
    strictPort: true,
  },
  publicDir: 'static',
  plugins: [
    tailwindcss(),
    svelte(),
    {
      name: 'dev-csp',
      transformIndexHtml(html, { server }) {
        if (server) {
          // Dev-Modus: CSP um localhost für HMR und API-Calls ergänzen
          return html.replace(
            /connect-src 'self' https:\/\/pocketbase-boardgame\.dasdann\.jetzt;/,
            "connect-src 'self' https://pocketbase-boardgame.dasdann.jetzt ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*;"
          ).replace(
            /script-src 'self';/,
            "script-src 'self' 'unsafe-inline' 'unsafe-eval';"
          );
        }
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      workbox: {
        // P1.2 Precache-Diät: nur die App-Shell vorab cachen (< 2 MB statt 17,9 MB).
        // Bilder (images/, Wiki/, icons/) und Moduldaten laufen über runtimeCaching
        // und sind offline verfügbar, sobald sie einmal aufgerufen wurden.
        // Wiki-Refaktorierung P5.2: Wiki-Katalog + Manifeste sind klein und liegen
        // im Precache, damit die Wiki-Übersicht beim ersten Offline-Start funktioniert.
        globPatterns: ['**/*.{js,css,html}', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'games_config.json', 'fonts/**', 'data/wiki/games.json', 'data/games/*/manifest.json'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/pocketbase-boardgame\.dasdann\.jetzt\/api\/files\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pb-files-cache',
              expiration: { maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/pocketbase-boardgame\.dasdann\.jetzt\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pocketbase-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'local-images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          {
            // Wiki-Module unter static/data/ — nicht mehr im Precache (P1.2)
            urlPattern: /\/data\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'wiki-data-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          }
        ],
      },
      manifest: {
        name: 'Boardgame Companion',
        short_name: 'BG Companion',
        description: 'Dein digitaler Brettspiel-Begleiter für Scoring und Spielverlauf',
        theme_color: '#0b0f19',
        background_color: '#0b0f19',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/files/Brettspiel_Partner/',
        scope: '/files/Brettspiel_Partner/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '$lib': '/src/lib',
    },
  },
  build: {
    outDir: 'public',
    emptyOutDir: true,
  },
});
