// @ts-check
import { z } from 'zod';

export const CustomGameCategorySchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1).max(40).transform(s => s.replace(/<[^>]*>/g, '').trim()),
});

export const CustomGameSchema = z.object({
    key: z.string().optional(),
    name: z.string().min(1, 'Spielname erforderlich').max(60).transform(s => s.replace(/<[^>]*>/g, '').trim()),
    description: z.string().max(160).transform(s => s.replace(/<[^>]*>/g, '').trim()).optional().default(''),
    players: z.string().max(30).optional().default('2–4 Spieler'),
    badge: z.string().max(30).optional().default('Benutzerdefiniert'),
    emoji: z.string().max(4).optional().default('🎲'),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültige Farbe').optional().default('#6366f1'),
    categories: z.array(CustomGameCategorySchema).max(20, 'Maximal 20 Kategorien erlaubt'),
    custom: z.literal(true).default(true),
    order: z.number().default(999),
    status: z.enum(['local', 'pending', 'pending_review', 'rejected']).optional().default('local'),
    pb_id: z.string().optional(),
    cover_url: z.string().url().optional().or(z.literal('')),
});

/**
 * @param {any} data
 * @returns {z.infer<typeof CustomGameSchema>}
 */
export function validateCustomGame(data) {
    return CustomGameSchema.parse(data);
}
