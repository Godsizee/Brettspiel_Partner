// @ts-check
import { z } from 'zod';

/**
 * Zod-Schema für einen standardisierten Wiki-Eintrag.
 * Dieses Schema definiert das Format, das sowohl statische JSON-Daten
 * als auch aus PocketBase geladene Records erfüllen müssen, bevor
 * sie in den UI-Komponenten gerendert werden.
 */
export const wikiEntrySchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.string().optional(),
  category: z.string().optional(),
  name: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  image: z.string().nullable().optional(),
  thumb: z.string().nullable().optional(),
  group: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  timing: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  source: z.object({
    document: z.string(),
    page: z.number().nullable().optional()
  }).optional(),
  // Zusatzfelder für den Tips-Renderer (TipsRenderer.svelte):
  // optional, damit Bestandsmodule unverändert validieren.
  title: z.string().optional(),
  content: z.string().optional(),
  difficulty: z.string().optional()
});

/**
 * Zod-Schema für ein Wiki-Manifest (games.json / wiki.json).
 */
export const wikiManifestSchema = z.object({
  schemaVersion: z.number().optional(),
  version: z.string().optional(),
  game: z.object({
    key: z.string(),
    name: z.string()
  }),
  modules: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    layout: z.string().optional(),
    icon: z.string().optional(),
    featured: z.boolean().optional(),
    source: z.string().optional()
  })).optional()
});

/**
 * @typedef {z.infer<typeof wikiEntrySchema>} WikiEntry
 */
/**
 * @typedef {z.infer<typeof wikiManifestSchema>} WikiManifest
 */