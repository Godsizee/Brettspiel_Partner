// @ts-check
/**
 * Routenname → Lazy-Loader. Während der Migration zeigen Einträge auf alte Komponenten;
 * jede Screen-Aufgabe (R08–R17) stellt genau ihren Eintrag um und entfernt ihn aus LEGACY.
 */
export const SCREENS = {
  home: () => import('$lib/screens/home/HomeScreen.svelte'),
  game: () => import('$lib/screens/game/GameScreen.svelte'),
  'match-players': () => import('$lib/screens/match/PlayersScreen.svelte'),
  'match-live': () => import('$lib/screens/match/LiveScreen.svelte'),
  'match-score': () => import('$lib/screens/match/ScoreScreen.svelte'),
  history: () => import('$lib/components/MatchHistory.svelte'),
  stats: () => import('$lib/components/StatsDashboard.svelte'),
  profile: () => import('$lib/screens/profile/LegacyProfileScreen.svelte'),
  settings: () => import('$lib/components/Settings.svelte'),
  legal: () => import('$lib/screens/legal/LegalScreen.svelte'),
  'custom-game-new': () => import('$lib/components/CustomGameEditor.svelte'),
  'admin-review': () => import('$lib/components/AdminReview.svelte'),
  'dev-ui': () => import('$lib/screens/dev/UiGallery.svelte'),
  wiki: () => import('$lib/components/wiki/WikiApp.svelte'),
};

/** Keys, die noch alte Komponenten zeigen (bekommen den alten Innenabstand). */
export const LEGACY = new Set(['history', 'stats', 'profile', 'settings', 'custom-game-new', 'admin-review']);

/** Alle wiki-* Routen teilen sich WikiApp (internes Routing). */
export const screenKey = (/** @type {string} */ name) => (name.startsWith('wiki') ? 'wiki' : name in SCREENS ? name : 'home');

/** Routen im Fokusmodus (mobile Tab-Leiste ausgeblendet, Plan C4). */
export const FOCUS_ROUTES = new Set(['match-players', 'match-live', 'match-score']);
