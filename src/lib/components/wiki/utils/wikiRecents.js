// @ts-check
import { db } from '$lib/services/DbService.js';

/**
 * @typedef {{
 *   slug: string,
 *   moduleId: string,
 *   entryId: string,
 *   name: string,
 *   ts: number
 * }} RecentEntry
 */

/**
 * Fügt einen Eintrag zu den "Zuletzt angesehenen" hinzu (max 8, neueste zuerst, idempotent).
 * @param {string} slug Spiel-Slug
 * @param {string} moduleId Modul-ID
 * @param {string} entryId Eintrags-ID
 * @param {string} name Eintrags-Name
 * @returns {Promise<RecentEntry[]>}
 */
export async function addRecentEntry(slug, moduleId, entryId, name) {
  if (!slug || !moduleId || !entryId || !name) return [];

  const key = `wiki_recents_${slug}`;
  /** @type {RecentEntry[]} */
  let recents = (await db.get(key)) || [];
  if (!Array.isArray(recents)) recents = [];

  // Filtere Duplikate heraus
  recents = recents.filter(item => !(item.moduleId === moduleId && item.entryId === entryId));

  // Neue oben einfügen
  recents.unshift({ slug, moduleId, entryId, name, ts: Date.now() });

  // Auf max 8 begrenzen
  recents = recents.slice(0, 8);

  await db.set(key, recents);
  return recents;
}

/**
 * Holt die "Zuletzt angesehenen" Einträge für ein Spiel.
 * @param {string} slug Spiel-Slug
 * @returns {Promise<RecentEntry[]>}
 */
export async function getRecentEntries(slug) {
  if (!slug) return [];
  const key = `wiki_recents_${slug}`;
  const recents = await db.get(key);
  return Array.isArray(recents) ? recents : [];
}
