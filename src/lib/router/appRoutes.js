// @ts-check
import { ROUTES as WIKI_ROUTES } from '$lib/components/wiki/utils/wikiRoutes.js';
import { buildHash } from './router.js';

/** Routentabelle der App. Bildet 1:1 auf eine spätere src/routes/-Struktur ab (Plan C2). */
export const APP_ROUTES = [
  { name: 'home', pattern: [] },
  { name: 'game', pattern: ['spiel', ':game'] },
  { name: 'match-players', pattern: ['partie', 'spieler'] },
  { name: 'match-score', pattern: ['partie', 'wertung'] },
  { name: 'match-live', pattern: ['partie'] },
  { name: 'stats', pattern: ['chronik', 'statistik'] },
  { name: 'history', pattern: ['chronik'] },
  { name: 'settings', pattern: ['profil', 'einstellungen'] },
  { name: 'legal', pattern: ['profil', 'rechtliches'] },
  { name: 'profile', pattern: ['profil'] },
  { name: 'custom-game-new', pattern: ['eigenes-spiel'] },
  { name: 'admin-review', pattern: ['admin'] },
  ...(import.meta.env.DEV ? [{ name: 'dev-ui', pattern: ['dev', 'ui'] }] : []),
  ...WIKI_ROUTES,
];

/** Einzige Stelle, an der App-URLs entstehen. */
export const appHash = {
  home: () => '#/',
  /** @param {string} slug toSlug(gameKey) */
  game: (slug) => buildHash(['spiel', slug]),
  /** @param {'live'|'score'} [next] */
  matchPlayers: (next = 'live') => buildHash(['partie', 'spieler'], { next }),
  /** @param {boolean} [start] */
  matchLive: (start = false) => buildHash(['partie'], start ? { start: '1' } : {}),
  matchScore: () => '#/partie/wertung',
  history: () => '#/chronik',
  stats: () => '#/chronik/statistik',
  profile: () => '#/profil',
  settings: () => '#/profil/einstellungen',
  legal: () => '#/profil/rechtliches',
  customGame: () => '#/eigenes-spiel',
  admin: () => '#/admin',
};
