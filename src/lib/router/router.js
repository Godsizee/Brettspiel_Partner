// @ts-check
/**
 * Minimaler Hash-Router (P0.1, Wiki_Refaktorierung.md E1).
 *
 * Warum Hash-Routing: Die App liegt unter /files/Brettspiel_Partner/ hinter
 * Nginx und als installierte PWA (start_url/scope). `#/…`-Routen brauchen kein
 * Server-Rewrite, kollidieren nicht mit dem PWA-Scope und funktionieren offline.
 *
 * Der Router ist bewusst generisch gehalten (Routentabelle + Parse/Build als
 * pure Funktionen), damit weitere Screens später migrieren können. Aktuell
 * nutzt ihn nur das Wiki.
 */
import { writable, get } from 'svelte/store';

/**
 * @typedef {Object} RouteDef
 * @property {string} name
 * @property {string[]} pattern
 */

/**
 * @typedef {Object} Route
 * @property {string} name Routen-Name aus der Tabelle (z. B. 'wiki-module')
 * @property {Record<string, string>} params Decodierte Pfad-Parameter
 * @property {Record<string, string>} query Decodierte Query-Parameter
 * @property {string} hash Kanonischer Hash inkl. '#' (Schlüssel für Scroll-Restore)
 */

/** @type {RouteDef[]} */
let ROUTES = [];

/**
 * Registriert die Routentabelle.
 * @param {RouteDef[]} routes
 */
export function registerRoutes(routes) {
  ROUTES = routes;
  if (typeof window !== 'undefined') {
    currentRoute.set(parseRoute(window.location.hash));
  }
}

/**
 * Zerlegt einen Hash (oder Pfad) in eine Route. Pure Funktion — testbar ohne DOM.
 * @param {string} rawHash z. B. '#/wiki/on-mars/fokusse?q=st%C3%A4dte'
 * @returns {Route | null} null, wenn keine Route der Tabelle passt
 */
export function parseRoute(rawHash) {
  if (typeof rawHash !== 'string') return null;
  let path = rawHash.replace(/^#/, '');
  if (!path.startsWith('/')) return null;

  /** @type {Record<string, string>} */
  const query = {};
  const qIdx = path.indexOf('?');
  if (qIdx >= 0) {
    for (const [k, v] of new URLSearchParams(path.slice(qIdx + 1))) {
      query[k] = v;
    }
    path = path.slice(0, qIdx);
  }

  const segments = path.split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });

  for (const route of ROUTES) {
    if (route.pattern.length !== segments.length) continue;
    /** @type {Record<string, string>} */
    const params = {};
    let ok = true;
    for (let i = 0; i < route.pattern.length; i++) {
      const pat = route.pattern[i];
      if (pat.startsWith(':')) {
        params[pat.slice(1)] = segments[i];
      } else if (pat !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return { name: route.name, params, query, hash: buildHash(segments, query) };
    }
  }
  return null;
}

/**
 * Baut aus Segmenten + Query einen kanonischen Hash.
 * @param {string[]} segments Decodierte Segmente
 * @param {Record<string, string>} [query]
 * @returns {string} z. B. '#/wiki/on-mars/fokusse?q=st%C3%A4dte'
 */
export function buildHash(segments, query = {}) {
  const path = '#/' + segments.map(encodeURIComponent).join('/');
  const entries = Object.entries(query).filter(([, v]) => v !== '' && v != null);
  if (!entries.length) return path;
  const qs = new URLSearchParams(entries).toString();
  return `${path}?${qs}`;
}

const hasWindow = typeof window !== 'undefined';

/**
 * Aktuelle Route (null = kein geroutetes Ziel im Hash).
 * @type {import('svelte/store').Writable<Route | null>}
 */
export const currentRoute = writable(hasWindow ? parseRoute(window.location.hash) : null);

if (hasWindow) {
  window.addEventListener('hashchange', () => {
    currentRoute.set(parseRoute(window.location.hash));
  });
}

/**
 * Navigiert zu einem Hash.
 * push (Default): neuer History-Eintrag — Browser-Zurück kehrt zur vorigen
 * Ansicht zurück. replace: ersetzt den aktuellen Eintrag (z. B. Tipp-Eingabe
 * in der Suche), ohne die History vollzumüllen.
 * @param {string} hash z. B. '#/wiki/on-mars'
 * @param {{ replace?: boolean }} [opts]
 */
export function navigate(hash, { replace = false } = {}) {
  if (!hasWindow) return;
  if (window.location.hash === hash) return;
  if (replace) {
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(window.history.state, '', base + hash);
    // replaceState feuert kein hashchange — Store manuell synchronisieren.
    currentRoute.set(parseRoute(hash));
  } else {
    window.location.hash = hash;
  }
}

/**
 * Entfernt den Routen-Hash ohne neuen History-Eintrag (beim Verlassen des
 * Wikis über die App-Navigation), damit kein toter '#/wiki'-Rest in der URL klebt.
 */
export function clearRouteHash() {
  if (!hasWindow) return;
  if (!get(currentRoute) && !window.location.hash) return;
  const base = window.location.pathname + window.location.search;
  window.history.replaceState(window.history.state, '', base);
  currentRoute.set(null);
}
