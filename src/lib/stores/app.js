// @ts-check
/**
 * Svelte Stores — ersetzt den STATE-Proxy aus app.js
 * Alle reaktiven Zustände der App sind hier zentralisiert.
 */
import { writable, derived } from 'svelte/store';
import { tick } from 'svelte';
import { getAuthService } from '../services/AuthService.js';
import { currentRoute, navigate, clearRouteHash, registerRoutes } from '../router/router.js';
import { wikiHash, ROUTES as wikiRoutesData } from '../components/wiki/utils/wikiRoutes.js';
import { toSlug } from '../components/wiki/utils/wikiKeys.js';

registerRoutes(wikiRoutesData);

export const wikiActive = derived(currentRoute, (r) => r !== null);

// ─── App Settings & Theme Mode (Dark / Light) ──────────────────────────────────
const defaultSettings = {
  hapticsEnabled: true,
  followSystemTheme: true,
  inactivityLogoutMinutes: 0, // 0 = nie
  timerAlarmDurationMinutes: 120, // 2 Stunden
  notificationsEnabled: true,
  savedPlayerCount: 2,
  gameSessionMode: false, // Spielabend-Modus (F2)
  collectionKeys: [], // F4
  wishlistKeys: [] // F4
};

const _savedSettings = localStorage.getItem('bg_settings');
let initialSettings = defaultSettings;
if (_savedSettings) {
  try {
    initialSettings = { ...defaultSettings, ...JSON.parse(_savedSettings) };
  } catch (_) {}
}

export const settings = writable(initialSettings);

settings.subscribe(val => {
  localStorage.setItem('bg_settings', JSON.stringify(val));
});

const _savedMode = localStorage.getItem('bg_theme_mode');
const _prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

/** @type {import('svelte/store').Writable<'dark'|'light'>} */
export const themeMode = writable(/** @type {'dark'|'light'} */(
  initialSettings.followSystemTheme 
    ? (_prefersDark ? 'dark' : 'light') 
    : (_savedMode || (_prefersDark ? 'dark' : 'light'))
));

themeMode.subscribe(mode => {
  document.documentElement.setAttribute('data-theme', mode);
  let follow = true;
  settings.subscribe(s => { follow = s.followSystemTheme; })();
  if (!follow) {
    localStorage.setItem('bg_theme_mode', mode);
  }
});

// Dynamic system theme listener
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
mediaQuery.addEventListener('change', (e) => {
  let follow = true;
  settings.subscribe(s => { follow = s.followSystemTheme; })();
  if (follow) {
    themeMode.set(e.matches ? 'dark' : 'light');
  }
});

export function toggleThemeMode() {
  settings.update(s => ({ ...s, followSystemTheme: false }));
  themeMode.update(m => m === 'dark' ? 'light' : 'dark');
}

// Netzwerkstatus
export const isOnline = writable(navigator.onLine);

// PWA Install-Prompt Store (U9)
/** @type {import('svelte/store').Writable<Event|null>} */
export const pwaInstallEvent = writable(null);
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pwaInstallEvent.set(e);
  });
}

// Aktueller Screen (Screen-Router ohne echtes Routing)
//
// Reload-Persistenz (F5 / Pull-to-Refresh): Der zuletzt aktive Top-Level-Screen
// wird in sessionStorage gehalten, damit der Nutzer nach einem Reload wieder auf
// demselben Tab landet statt auf der Startseite. Nur „eigenständige" Screens
// werden wiederhergestellt — Screens, die von flüchtigem Zustand abhängen
// (gewähltes Spiel, laufende Partie, offener Editor), würden ohne diesen Kontext
// kaputt/leer aussehen und fallen daher bewusst auf 'game-selection' zurück.
// sessionStorage statt localStorage: gilt nur für die aktuelle Tab-Sitzung, nicht
// dauerhaft über Browser-Neustarts hinweg. Keine sensiblen Daten — nur ein Screen-Name.
const RESTORABLE_SCREENS = ['game-selection', 'match-history', 'stats', 'profile', 'user-profile', 'settings'];
let _initialScreen = 'game-selection';
try {
  const _savedScreen = sessionStorage.getItem('bg_active_screen');
  if (_savedScreen && RESTORABLE_SCREENS.includes(_savedScreen)) {
    _initialScreen = _savedScreen;
  }
} catch (_) {}

// Der URL-Hash gewinnt immer gegen sessionStorage.
{
  let _route = null;
  currentRoute.subscribe((r) => { _route = r; })();
  if (_route && _initialScreen === 'wiki') {
    _initialScreen = 'game-selection'; // Fallback für activeScreen, da Wiki nun über URL läuft
  } else if (_initialScreen === 'wiki') {
    _initialScreen = 'game-selection';
    navigate(wikiHash.overview(), { replace: true });
  }
}

/** @type {import('svelte/store').Writable<'game-selection'|'game-dashboard'|'game-timer'|'player-setup'|'score-sheet'|'match-history'|'stats'|'profile'|'user-profile'|'settings'|'custom-game-editor'|'admin-review'>} */
export const activeScreen = writable(/** @type {any} */ (_initialScreen));

/** Reihenfolge für Richtungslogik der Transitions */
const SCREEN_ORDER = ['game-selection', 'custom-game-editor', 'game-dashboard', 'game-timer', 'player-setup', 'score-sheet', 'match-history', 'stats', 'profile', 'user-profile', 'settings', 'admin-review'];

let _currentScreen = _initialScreen;
activeScreen.subscribe(s => {
  _currentScreen = s;
  // Nur wiederherstellbare Screens persistieren; transiente Screens entfernen den
  // gespeicherten Wert, damit ein Reload dort sauber auf der Startseite landet.
  try {
    if (RESTORABLE_SCREENS.includes(s)) {
      sessionStorage.setItem('bg_active_screen', s);
    } else {
      sessionStorage.removeItem('bg_active_screen');
    }
  } catch (_) {}
});

/**
 * Navigiert zu einem Screen mit CSS-Slide-Animation.
 * Der aktuelle Screen bekommt .is-leaving (animiert raus),
 * der neue Screen bekommt .active und animiert gleichzeitig rein.
 * @param {'game-selection'|'game-dashboard'|'game-timer'|'player-setup'|'score-sheet'|'match-history'|'stats'|'profile'|'user-profile'|'settings'|'custom-game-editor'|'admin-review'} screen
 */
export async function navigateTo(screen) {
  if (_currentScreen === screen) return;

  const fromIdx = SCREEN_ORDER.indexOf(_currentScreen);
  const toIdx = SCREEN_ORDER.indexOf(screen);
  const direction = (toIdx < 0 || fromIdx < 0)
    ? 'forward'
    : toIdx > fromIdx ? 'forward' : 'backward';

  document.documentElement.dataset.transitionDir = direction;
  window.scrollTo(0, 0);

  activeScreen.set(screen);

  // Wiki verlassen → Routen-Hash aufräumen
  clearRouteHash();
  await tick();
}

/**
 * Öffnet das Wiki als geroutete Seite — ersetzt das frühere Muster
 * `wikiGameKey.set(...); navigateTo('wiki')`.
 * @param {string|null} [appGameKey] App-Spiel-Key (z. B. aus currentGame) oder null für die Übersicht
 * @param {string|null} [moduleId] Optional: direkt ein Modul öffnen
 */
export function openWiki(appGameKey = null, moduleId = null, entryId = null) {
  const slug = appGameKey ? toSlug(appGameKey) : null;
  const hash = !slug ? wikiHash.overview()
    : entryId && moduleId ? wikiHash.entry(slug, moduleId, entryId)
    : moduleId ? wikiHash.module(slug, moduleId)
    : wikiHash.game(slug);
  navigate(hash);
}

// Aktuelles Spiel (key aus GAMES_CATALOG)
/** @type {import('svelte/store').Writable<string|null>} */
export const currentGame = writable(null);



/**
 * Einzige Quelle der Wahrheit für den PocketBase-Backend-Host, wenn
 * VITE_POCKETBASE_URL zur Build-Zeit nicht gesetzt ist. Wird von pocketbaseHost,
 * authService und allen Service-/Komponenten-Fallbacks verwendet, damit Auth- und
 * Daten-Requests garantiert gegen denselben Host laufen.
 * @type {string}
 */
export const DEFAULT_POCKETBASE_HOST = 'https://pocketbase-boardgame.dasdann.jetzt';

// PocketBase Host — gleicher Fallback wie authService (siehe unten), damit
// Store und Auth-Service garantiert denselben Host verwenden. Sonst könnten
// Daten-Requests (Matches, Profile, Admin) gegen einen anderen Host laufen als
// den, für den das Auth-Token ausgestellt wurde.
export const pocketbaseHost = writable(import.meta.env.VITE_POCKETBASE_URL || DEFAULT_POCKETBASE_HOST);

// Shared AuthService instance (encapsulates authToken in memory)
export const authService = getAuthService(import.meta.env.VITE_POCKETBASE_URL || DEFAULT_POCKETBASE_HOST);

// Spieldauer der aktuellen Session (Sekunden)
export const currentSessionDuration = writable(0);

// Spieleranzahl
export const playerCount = writable(2);

// Vorbelegte Spielernamen (aus History)
/** @type {import('svelte/store').Writable<string[]|null>} */
export const prefilledPlayerNames = writable(null);

// Spieler-Farben
/** @type {import('svelte/store').Writable<string[]|null>} */
export const playerColors = writable(null);

export const DEFAULT_PLAYER_COLORS = [
  'hsl(12, 85%, 55%)',
  'hsl(195, 85%, 50%)',
  'hsl(142, 70%, 45%)',
  'hsl(38, 90%, 55%)',
  'hsl(270, 75%, 60%)',
  'hsl(330, 85%, 55%)',
  'hsl(180, 70%, 45%)',
  'hsl(220, 80%, 55%)'
];

// Spieler-Profile (F1)
/** @type {import('svelte/store').Writable<any[]>} */
export const playerProfiles = writable([]);

export async function loadPlayerProfiles() {
  const { getProfiles } = await import('../services/DbService.js');
  const list = await getProfiles();
  playerProfiles.set(list);
}

// History-Filter
export const historyFilter = writable('all');

// Gecachte Matches für History
export const cachedMatches = writable(/** @type {any[]} */([]));

// Active Multi-Game-Session (F2)
const _savedSession = localStorage.getItem('bg_active_session');
let initialSession = null;
if (_savedSession) {
  try {
    initialSession = JSON.parse(_savedSession);
  } catch (_) {}
}
export const activeSession = writable(initialSession);
activeSession.subscribe(val => {
  if (val) {
    localStorage.setItem('bg_active_session', JSON.stringify(val));
  } else {
    localStorage.removeItem('bg_active_session');
  }
});

// Auth
/** @type {import('svelte/store').Writable<any>} */
export const currentUser = writable(null);

// Games Catalog (aus PocketBase / IndexedDB / JSON)
/** @type {import('svelte/store').Writable<Record<string, any>>} */
export const gamesCatalog = writable({});

// ─── Wiki ─────────────────────────────────────────────────────────────────────
// Der Wiki-Zustand (Spiel, Modul, Eintrag, Suche) lebt vollständig in der
// URL-Route (src/lib/router/router.js). Öffnen über openWiki() weiter oben;
// die früheren Stores wikiGameKey/wikiPreselectedCategory sind entfallen.

// ─── Timer UI State (für Floating Pill in App.svelte) ────────────────────────
/** @type {import('svelte/store').Writable<'stopped'|'running'|'paused'>} */
export const timerState = writable(/** @type {'stopped'|'running'|'paused'} */('stopped'));
export const timerText = writable('00:00:00');
export const timerElapsedSeconds = writable(0);

// Toast-Nachrichten Queue
/** @type {import('svelte/store').Writable<Array<{id: number, message: string, type: string}>>} */
export const toasts = writable([]);

let toastId = 0;

/**
 * Zeigt eine Toast-Benachrichtigung an.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type]
 * @param {number} [duration]
 * @param {{ label: string, onClick: () => void } | undefined} [action]
 */
export function showToast(message, type = 'info', duration = 3500, action = undefined) {
  const id = ++toastId;
  toasts.update(t => [...t, { id, message, type, action }]);
  setTimeout(() => {
    toasts.update(t => t.filter(toast => toast.id !== id));
  }, duration);
}

// Derived: Ist ein Nutzer eingeloggt?
export const isAuthenticated = derived(
  currentUser,
  $user => !!$user
);

// Derived: Ist der Nutzer ein Admin?
export const isAdmin = derived(
  currentUser,
  $user => $user?.role === 'admin'
);

// Game-spezifische Themes (HSL)
export const THEMES = /** @type {Record<string, Record<string, string>>} */ ({
  wingspan: {
    '--color-primary': 'hsl(142, 45%, 45%)',
    '--color-primary-hover': 'hsl(142, 45%, 52%)',
    '--color-primary-glow': 'hsla(142, 45%, 45%, 0.4)',
    '--color-secondary': 'hsl(38, 75%, 65%)',
    '--color-secondary-hover': 'hsl(38, 75%, 72%)',
    '--color-secondary-glow': 'hsla(38, 75%, 65%, 0.3)',
    '--color-border-glow': 'hsla(142, 45%, 45%, 0.35)',
  },
  'on mars': {
    '--color-primary': 'hsl(12, 75%, 45%)',
    '--color-primary-hover': 'hsl(12, 75%, 52%)',
    '--color-primary-glow': 'hsla(12, 75%, 45%, 0.4)',
    '--color-secondary': 'hsl(42, 95%, 55%)',
    '--color-secondary-hover': 'hsl(42, 95%, 65%)',
    '--color-secondary-glow': 'hsla(42, 95%, 55%, 0.3)',
    '--color-border-glow': 'hsla(12, 75%, 45%, 0.35)',
  },
  mischwald: {
    '--color-primary': 'hsl(145, 65%, 35%)',
    '--color-primary-hover': 'hsl(145, 65%, 42%)',
    '--color-primary-glow': 'hsla(145, 65%, 35%, 0.4)',
    '--color-secondary': 'hsl(48, 85%, 50%)',
    '--color-secondary-hover': 'hsl(48, 85%, 60%)',
    '--color-secondary-glow': 'hsla(48, 85%, 50%, 0.3)',
    '--color-border-glow': 'hsla(145, 65%, 35%, 0.35)',
  },
  mischwald_dartmoor: {
    '--color-primary': 'hsl(165, 55%, 38%)',
    '--color-primary-hover': 'hsl(165, 55%, 45%)',
    '--color-primary-glow': 'hsla(165, 55%, 38%, 0.4)',
    '--color-secondary': 'hsl(28, 70%, 55%)',
    '--color-secondary-hover': 'hsl(28, 70%, 65%)',
    '--color-secondary-glow': 'hsla(28, 70%, 55%, 0.3)',
    '--color-border-glow': 'hsla(165, 55%, 38%, 0.35)',
  },
  revive: {
    '--color-primary': 'hsl(190, 85%, 45%)',
    '--color-primary-hover': 'hsl(190, 85%, 55%)',
    '--color-primary-glow': 'hsla(190, 85%, 45%, 0.4)',
    '--color-secondary': 'hsl(55, 95%, 55%)',
    '--color-secondary-hover': 'hsl(55, 95%, 65%)',
    '--color-secondary-glow': 'hsla(55, 95%, 55%, 0.3)',
    '--color-border-glow': 'hsla(190, 85%, 45%, 0.35)',
  },
  scythe: {
    '--color-primary': 'hsl(28, 60%, 42%)',
    '--color-primary-hover': 'hsl(28, 60%, 50%)',
    '--color-primary-glow': 'hsla(28, 60%, 42%, 0.4)',
    '--color-secondary': 'hsl(45, 85%, 50%)',
    '--color-secondary-hover': 'hsl(45, 85%, 60%)',
    '--color-secondary-glow': 'hsla(45, 85%, 50%, 0.3)',
    '--color-border-glow': 'hsla(28, 60%, 42%, 0.35)',
  },
  sattgruen: {
    '--color-primary': 'hsl(140, 50%, 35%)',
    '--color-primary-hover': 'hsl(140, 50%, 42%)',
    '--color-primary-glow': 'hsla(140, 50%, 35%, 0.4)',
    '--color-secondary': 'hsl(42, 85%, 55%)',
    '--color-secondary-hover': 'hsl(42, 85%, 65%)',
    '--color-secondary-glow': 'hsla(42, 85%, 55%, 0.3)',
    '--color-border-glow': 'hsla(140, 50%, 35%, 0.35)',
  },
  radlands: {
    '--color-primary': 'hsl(330, 95%, 55%)',
    '--color-primary-hover': 'hsl(330, 95%, 62%)',
    '--color-primary-glow': 'hsla(330, 95%, 55%, 0.4)',
    '--color-secondary': 'hsl(190, 95%, 50%)',
    '--color-secondary-hover': 'hsl(190, 95%, 60%)',
    '--color-secondary-glow': 'hsla(190, 95%, 50%, 0.3)',
    '--color-border-glow': 'hsla(330, 95%, 55%, 0.35)',
  },
  la_granja: {
    '--color-primary': 'hsl(120, 45%, 35%)',
    '--color-primary-hover': 'hsl(120, 45%, 42%)',
    '--color-primary-glow': 'hsla(120, 45%, 35%, 0.4)',
    '--color-secondary': 'hsl(45, 90%, 50%)',
    '--color-secondary-hover': 'hsl(45, 90%, 60%)',
    '--color-secondary-glow': 'hsla(45, 90%, 50%, 0.3)',
    '--color-border-glow': 'hsla(120, 45%, 35%, 0.35)',
  },
  underwater_cities: {
    '--color-primary': 'hsl(195, 85%, 35%)',
    '--color-primary-hover': 'hsl(195, 85%, 42%)',
    '--color-primary-glow': 'hsla(195, 85%, 35%, 0.4)',
    '--color-secondary': 'hsl(45, 95%, 55%)',
    '--color-secondary-hover': 'hsl(45, 95%, 65%)',
    '--color-secondary-glow': 'hsla(45, 95%, 55%, 0.3)',
    '--color-border-glow': 'hsla(195, 85%, 35%, 0.35)',
  },
  next_station_london: {
    '--color-primary': 'hsl(340, 85%, 55%)',
    '--color-primary-hover': 'hsl(340, 85%, 62%)',
    '--color-primary-glow': 'hsla(340, 85%, 55%, 0.4)',
    '--color-secondary': 'hsl(200, 85%, 50%)',
    '--color-secondary-hover': 'hsl(200, 85%, 60%)',
    '--color-secondary-glow': 'hsla(200, 85%, 50%, 0.3)',
    '--color-border-glow': 'hsla(340, 85%, 55%, 0.35)',
  },
  default: {
    '--color-primary': 'hsl(250, 89%, 65%)',
    '--color-primary-hover': 'hsl(250, 89%, 72%)',
    '--color-primary-glow': 'hsla(250, 89%, 65%, 0.4)',
    '--color-secondary': 'hsl(172, 90%, 45%)',
    '--color-secondary-hover': 'hsl(172, 90%, 55%)',
    '--color-secondary-glow': 'hsla(172, 90%, 45%, 0.3)',
    '--color-border-glow': 'hsla(250, 89%, 65%, 0.35)',
  },
});

/**
 * Wendet das Theme eines Spiels auf :root an.
 * @param {string|null} gameName
 */
export function applyTheme(gameName) {
  const theme = (gameName && THEMES[gameName]) ? THEMES[gameName] : THEMES.default;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(theme)) {
    root.style.setProperty(key, val);
  }
}

// ─── Token Refresh / Expiry Listeners ─────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('auth-token-refreshed', (/** @type {any} */ e) => {
    const refreshed = e.detail;
    const user = refreshed.record ?? refreshed.user;
    currentUser.set(user);
    import('../services/DbService.js').then(({ db }) => {
      db.set('bg_user', user);
    });
  });

  window.addEventListener('auth-session-expired', (/** @type {any} */ e) => {
    currentUser.set(null);
    import('../services/DbService.js').then(({ db }) => {
      db.set('bg_user', null);
    });
    showToast('Sitzung abgelaufen. Bitte melde dich erneut an. 🔒', 'warning');
  });
}

// ─── Custom Global Dialog (Modals) ──────────────────────────────────────────
/** 
 * @typedef {Object} DialogState
 * @property {boolean} isOpen
 * @property {'confirm'|'prompt'} type
 * @property {string} message
 * @property {string} title
 * @property {string} placeholder
 * @property {boolean} isPassword
 * @property {(value: any) => void} resolve
 */

/** @type {import('svelte/store').Writable<DialogState>} */
export const dialogState = writable({
  isOpen: false,
  type: 'confirm',
  message: '',
  title: 'Bestätigung',
  placeholder: '',
  isPassword: false,
  resolve: () => {}
});

/**
 * Zeigt einen asynchronen Bestätigungsdialog (Ersatz für window.confirm)
 * @param {string} message 
 * @param {string} [title="Bestätigung"] 
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, title = "Bestätigung") {
  return new Promise((resolve) => {
    dialogState.set({
      isOpen: true,
      type: 'confirm',
      message,
      title,
      placeholder: '',
      isPassword: false,
      resolve
    });
  });
}

/**
 * Zeigt einen asynchronen Eingabedialog (Ersatz für window.prompt)
 * @param {string} message 
 * @param {string} [title="Eingabe"] 
 * @param {boolean} [isPassword=false]
 * @param {string} [placeholder=""]
 * @returns {Promise<string|null>}
 */
export function promptDialog(message, title = "Eingabe", isPassword = false, placeholder = "") {
  return new Promise((resolve) => {
    dialogState.set({
      isOpen: true,
      type: 'prompt',
      message,
      title,
      placeholder,
      isPassword,
      resolve
    });
  });
}
