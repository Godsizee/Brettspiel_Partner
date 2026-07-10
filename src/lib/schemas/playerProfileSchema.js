// @ts-check
import { z } from 'zod';

export const PlayerProfileSchema = z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1, 'Name ist erforderlich').max(50, 'Name darf maximal 50 Zeichen lang sein'),
    color: z.string().min(1, 'Farbe ist erforderlich'),
    avatar: z.string().min(1).max(10).default('🎲')
});

export const PlayerProfileListSchema = z.array(PlayerProfileSchema);

/**
 * Validate player profile data
 * @param {any} data
 * @returns {z.infer<typeof PlayerProfileSchema>}
 * @throws {z.ZodError}
 */
export function validatePlayerProfile(data) {
    return PlayerProfileSchema.parse(data);
}
