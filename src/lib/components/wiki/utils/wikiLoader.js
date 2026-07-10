// @ts-check
/**
 * Low-Level-Lader für statische Wiki-Daten (JSON unter /data/…).
 * Nur Fetch + Zod-Validierung — Komposition, PocketBase-Merge und Caching
 * liegen ausschließlich in WikiService.js (P2.2, Wiki_Refaktorierung.md E3).
 * Komponenten importieren dieses Modul nicht direkt.
 */
import { wikiManifestSchema, wikiEntrySchema } from '$lib/schemas/wikiSchemas.js';
import { get } from 'svelte/store';
import { gamesCatalog } from '$lib/stores/app.js';
import { toAppKey } from './wikiKeys.js';

const DEFAULT_CATALOG_PATH = '/data/wiki/games.json';

function getBase() {
  return import.meta.env.BASE_URL || '/';
}

/** @param {string} path */
async function fetchJson(path) {
  const base = getBase().replace(/\/$/, '');
  const fullPath = path.startsWith('/') ? `${base}${path}` : path;
  const response = await fetch(fullPath);
  if (!response.ok) throw new Error(`Konnte JSON nicht laden: ${path} (${response.status})`);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Ungültiges JSON-Format erhalten für: ${path} (Content-Type: ${contentType})`);
  }

  return response.json();
}

/** @param {string} path */
function dirname(path) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

/** @param {string} basePath @param {string} relativePath */
function joinPath(basePath, relativePath) {
  if (!relativePath) return basePath;
  if (relativePath.startsWith('/')) return relativePath;
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return new URL(relativePath, `https://x${base}`).pathname;
}

/**
 * Löst wurzel-absolute Asset-Pfade aus den Moduldaten (z. B. "/Wiki/….webp")
 * gegen die Vite-Base auf. Die App wird unter /files/Brettspiel_Partner/
 * ausgeliefert — ohne dieses Präfix laufen die Bilder ins 404.
 * @param {string | null | undefined} path
 * @returns {string | null | undefined}
 */
function resolveAssetPath(path) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return path;
  const base = getBase().replace(/\/$/, '');
  return `${base}${path}`;
}

/**
 * Lädt den Wiki-Katalog (Liste aller verfügbaren Spiele mit Wiki-Einträgen).
 * Reichert jeden Eintrag mit Daten aus dem App-Katalog (Cover, Spieler, Badge, Publisher) an.
 *
 * @param {string} [path] Pfad zur games.json (Standard: /data/wiki/games.json)
 * @returns {Promise<Array<{key: string, name: string, cover: string, players: string, badge: string, publisher: string, wiki?: {enabled: boolean, manifest: string|null}}>>}
 * @throws {Error} Wenn die JSON-Datei nicht geladen werden kann
 */
export async function fetchWikiCatalog(path = DEFAULT_CATALOG_PATH) {
  const catalog = await fetchJson(path);
  if (!Array.isArray(catalog)) return [];
  const appCatalog = get(gamesCatalog) || {};
  return catalog.map((g) => {
    const appGame = appCatalog[toAppKey(g.key)];
    return {
      ...g,
      cover: appGame?.cover || g.cover || '',
      players: appGame?.players || g.players || '',
      badge: appGame?.badge || g.badge || '',
      publisher: appGame?.publisher || g.publisher || ''
    };
  });
}

/**
 * Lädt und validiert das Manifest einer Spiel-Wiki.
 *
 * @param {string | {wiki?: {manifest?: string|null}, manifest?: string}} gameOrKey
 *   Entweder ein Wiki-Slug (string) oder ein Katalogeintrag mit wiki.manifest-Pfad
 * @returns {Promise<{manifest: any, manifestPath: string, basePath: string}>}
 * @throws {Error} Wenn der Manifest-Pfad fehlt, die Datei nicht ladbar ist oder die Zod-Validierung fehlschlägt
 */
export async function loadGameManifest(gameOrKey) {
  const manifestPath =
    typeof gameOrKey === 'string'
      ? `/data/games/${gameOrKey}/manifest.json`
      : gameOrKey?.wiki?.manifest || gameOrKey?.manifest;
  if (!manifestPath) throw new Error('Manifest-Pfad fehlt.');
  const manifest = await fetchJson(manifestPath);

  try {
    wikiManifestSchema.parse(manifest);
  } catch (err) {
    const e = /** @type {any} */ (err);
    console.warn(`[Wiki Validation] Ungültiges Manifest für ${manifestPath}:`, e?.format?.() ?? e);
    throw new Error('Manifest-Validierung fehlgeschlagen.');
  }

  const basePath = dirname(manifestPath);
  return { manifest, manifestPath, basePath };
}

/**
 * Lädt die Daten eines einzelnen Wiki-Moduls aus einer JSON-Quelldatei.
 * Ungültige Einträge werden per Zod-Validierung herausgefiltert und gewarnt.
 *
 * @param {string} basePath Basis-Verzeichnispfad des Manifests
 * @param {{id: string, type: string, source: string, [key: string]: unknown}} moduleDefinition Modul-Definition aus dem Manifest
 * @returns {Promise<{id: string, type: string, sourcePath: string, data: {entries?: object[], [key: string]: unknown}, [key: string]: unknown}>}
 * @throws {Error} Wenn die Quelldatei nicht geladen werden kann
 */
export async function loadModuleData(basePath, moduleDefinition) {
  const sourcePath = joinPath(basePath, moduleDefinition.source);
  const data = await fetchJson(sourcePath);

  if (data && Array.isArray(data.entries)) {
    data.entries = data.entries.reduce((/** @type {any[]} */ acc, /** @type {any} */ entry, /** @type {number} */ idx) => {
      try {
        const parsed = wikiEntrySchema.parse(entry);
        parsed.image = resolveAssetPath(parsed.image) ?? undefined;
        acc.push(parsed);
      } catch (err) {
        const e = /** @type {any} */ (err);
        console.warn(`[Wiki Validation] Ungültiger Eintrag entfernt (Index ${idx}, id: ${entry.id}) in ${sourcePath}:`, e?.format?.() ?? e);
      }
      return acc;
    }, /** @type {any[]} */ ([]));
  }

  return { ...moduleDefinition, sourcePath, data };
}
