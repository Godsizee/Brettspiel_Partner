import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  // Svelte-Plugin, damit .svelte.js-Module (Runes) im Test kompiliert werden;
  // 'browser'-Condition, damit Svelte die Client-Reaktivität nutzt ($derived rechnet nach).
  plugins: [svelte()],
  test: {
    setupFiles: ['./tests/setup.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/tests/core-flow.spec.js',
      '**/tests/e2e/**' // Playwright
    ]
  },
  resolve: {
    alias: { '$lib': resolve(__dirname, './src/lib') },
    conditions: process.env.VITEST ? ['browser'] : undefined
  }
});
