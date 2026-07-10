// @ts-check
/**
 * ==========================================================================
 * GAME SCHEMA VALIDATION
 * ==========================================================================
 * Validates game catalog data from PocketBase or local games_config.json
 * Based on actual usage in GameSelection.svelte and GameTimer.js
 */

import { z } from 'zod';

/**
 * Single Game Schema
 * Validates fields used in GameSelection and ScoreSheet
 */
export const GameSchema = z.object({
    id: z.string().min(1).nullable().optional(),  // PocketBase ID (optional for local JSON)
    key: z.string().min(1, 'Game key is required'),  // 'scythe', 'wingspan', etc.
    name: z.string().min(1, 'Game name is required').max(100),
    description: z.string().nullable().optional(),
    // Accept any string for cover — validator will check it at display time
    cover: z.string().nullable().optional(),
    cover_image: z.string().nullable().optional(),  // Legacy field name (for backward compatibility)
    badge: z.string().nullable().optional(),
    order: z.number().nullable().optional(),
    active: z.boolean().nullable().optional(),
    
    // Player info
    players: z.string().nullable().optional(),  // '1–5 Spieler' format
    
    // Theme/Styling
    theme: z.object({
        primary: z.string().nullable().optional(),
        secondary: z.string().nullable().optional(),
        gradientColor: z.string().nullable().optional(),  // Hex color validation happens at display time
        backgroundColor: z.string().nullable().optional(),
        icon_bg: z.string().nullable().optional(),
        icon_style: z.string().nullable().optional()
    }).nullable().optional(),
    
    // Game calculation details
    categories: z.array(z.any()).nullable().optional(),
    calculator: z.string().nullable().optional(),
    expansion: z.any().nullable().optional(),
    modal: z.any().nullable().optional(),

    // Wiki / Karten-Referenz (optionales Enzyklopädie-Feature)
    wiki: z.union([
        z.object({
            categories: z.array(z.object({
                id: z.string(),
                label: z.string(),
                description: z.string().nullable().optional(),
                items: z.array(z.object({
                    id: z.string(),
                    name: z.string(),
                    image: z.string().nullable().optional(),
                    effect: z.string().nullable().optional(),
                    tip: z.string().nullable().optional(),
                })).nullable().optional().default([])
            }))
        }),
        z.object({
            enabled: z.boolean(),
            manifest: z.string()
        })
    ]).nullable().optional()
});

/**
 * Game List (from games_config.json or PocketBase)
 */
export const GameListSchema = z.array(GameSchema);

/**
 * Game Catalog Map (keyed by game.key)
 */
export const GameCatalogSchema = z.record(z.string(), GameSchema);

/**
 * Validate and transform raw game data
 * @param {any} data Raw game data
 * @returns {z.infer<typeof GameSchema>} Validated game object
 * @throws {z.ZodError} If validation fails
 */
export function validateGame(data) {
    return GameSchema.parse(data);
}

/**
 * Validate entire game list
 * @param {any} data Raw list data
 * @returns {z.infer<typeof GameListSchema>} Validated game list
 * @throws {z.ZodError} If validation fails
 */
export function validateGameList(data) {
    return GameListSchema.parse(data);
}

/**
 * Safely validate game with fallback
 * @param {any} data Raw game data
 * @returns {z.infer<typeof GameSchema>|null} Validated game or null if invalid
 */
export function validateGameSafe(data) {
    try {
        return GameSchema.parse(data);
    } catch (error) {
        console.warn('Invalid game data:', error);
        return null;
    }
}
