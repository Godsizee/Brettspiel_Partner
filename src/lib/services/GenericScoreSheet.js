// @ts-check
/**
 * ==========================================================================
 * BOARDGAME COMPANION - GENERIC SCORE SHEET COMPONENT
 * ==========================================================================
 * A universal Web Component that renders any game's score sheet dynamically
 * from a JSON template (loaded from PocketBase or games_config.json fallback).
 * Replaces all individual *ScoreSheet.js classes.
 */
import { BaseScoreSheet } from './BaseScoreSheet.js';
import { validateGameImageUrl } from '../utils/urlValidator.js';
import { showToast } from '../stores/app.js';

// Vite resolves import.meta.env.BASE_URL at build time (e.g. '/files/Brettspiel_Partner/')
const _BASE = import.meta.env.BASE_URL;

/**
 * @typedef {Object} GameCategory
 * @property {string} id
 * @property {string} label
 * @property {string} [icon]
 * @property {string} [svgIcon]
 * @property {string} [iconBg]
 * @property {string} [iconColor]
 * @property {'sum' | 'multiplier' | 'step' | 'popularity_driver'} type
 * @property {number} [multiplier]
 * @property {Array<number>} [steps]
 * @property {boolean} [allowNegative]
 */

/**
 * @typedef {Object} GameExpansion
 * @property {string} label
 * @property {string} badge
 * @property {Array<GameCategory>} [extraCategories]
 * @property {string} [expansionModal]
 * @property {string} [expansionModalTitle]
 */

/**
 * @typedef {Object} GameModal
 * @property {string} title
 * @property {string} image
 */

/**
 * @typedef {Object} GameTemplate
 * @property {string} id
 * @property {string} name
 * @property {string} cover
 * @property {string} [calculator]
 * @property {Object} [theme]
 * @property {string} [theme.icon_style]
 * @property {Array<GameCategory>} categories
 * @property {GameExpansion} [expansion]
 * @property {GameModal} [modal]
 * @property {{ categories: Array<{ id: string, label: string, description?: string, items?: Array<{ id: string, name: string, image?: string, effect?: string, tip?: string }> }> }} [wiki]
 */

// ── Inline SVG library for categories that don't use image icons ───────────
/** @type {Record<string, string>} */
const SVG_ICONS = {
    star:     `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
    heart:    `<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>`,
    hexagon:  `<polygon points="12 2 22 8.5 22 15.5 12 19 2 15.5 2 8.5"/>`,
    activity: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
    settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
    mappin:   `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
    copy:     `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
    diamond:  `<polygon points="12 2 22 12 12 22 2 12"/>`,
    sliders:  `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>`,
    book:     `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
    tree:     `<path d="M12 22V12"/><path d="M5 12l7-9 7 9H5z"/><path d="M3 17l9-5 9 5H3z"/>`,
    layers:   `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
    columns:  `<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>`,
    water:    `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`,
    up:       `<polyline points="18 15 12 9 6 15"/>`,
    down:     `<polyline points="6 9 12 15 18 9"/>`,
    left:     `<polyline points="15 18 9 12 15 6"/>`,
    right:    `<polyline points="9 18 15 12 9 6"/>`,
    cave:     `<path d="M12 2L2 19h20L12 2z"/><path d="M9 19v-3a3 3 0 0 1 6 0v3"/>`,
    coin:     `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><path d="M16 8h-4a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/>`,
    home:     `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
    building: `<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/><rect x="8" y="6" width="3" height="3"/><rect x="13" y="6" width="3" height="3"/>`,
    'triangle-circle': `<polygon points="12 2 2 22 22 22"/><circle cx="12" cy="13" r="3"/>`,
};

/**
 * Escapes HTML characters to prevent XSS
 * @param {string|null|undefined} str 
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Sanitizes CSS color value to prevent style attribute injection
 * @param {string|null|undefined} color 
 * @returns {string}
 */
function sanitizeCssColor(color) {
    if (!color || typeof color !== 'string') return '';
    // Block common injection vectors: quotes, semicolons, backslashes, expressions, url()
    const blocked = [';', '"', "'", '\\', 'url', 'expression', 'javascript'];
    const lower = color.toLowerCase();
    if (blocked.some(b => lower.includes(b))) {
        console.warn('🚫 Blocked dangerous color:', color);
        return '';
    }
    return color;
}

/**
 * Sanitizes local image path to prevent dangerous protocol injection
 * @param {string|null|undefined} path 
 * @returns {string}
 */
function sanitizeImagePath(path) {
    if (!path || typeof path !== 'string') return '';
    const trimmed = path.trim();
    const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lower = trimmed.toLowerCase();
    if (dangerous.some(d => lower.includes(d)) || lower.includes('expression(') || lower.includes('<') || lower.includes('>')) {
        console.warn('🚫 Blocked dangerous image path:', path);
        return '';
    }
    return trimmed;
}

/**
 * @param {string} name
 * @param {string} [color]
 * @returns {string}
 */
function makeSvgIcon(name, color) {
    const paths = SVG_ICONS[name] || SVG_ICONS['star'];
    const isFilled = ['star','heart','diamond'].includes(name);
    return `<svg viewBox="0 0 24 24" width="22" height="22"
        fill="${isFilled ? 'currentColor' : 'none'}"
        stroke="${isFilled ? 'none' : 'currentColor'}"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        style="color:${color || 'currentColor'}">${paths}</svg>`;
}

// ── Quacksalber custom calculator ──────────────────────────────────────────
/**
 * @param {Record<string, number>} scores
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
function quacksalberCalculator(scores, shadowRoot) {
    const vp = scores['quacksalber_vp'] || 0;
    const rubies = scores['quacksalber_rubies'] || 0;
    const coins = scores['quacksalber_coins'] || 0;

    const rubyPoints = Math.floor(rubies / 2);
    const coinPoints = Math.floor(coins / 5);

    /**
     * @param {string} catId
     * @param {number} pts
     */
    const updateRowBadge = (catId, pts) => {
        const rowMeta = shadowRoot.querySelector(`.score-row[data-category="${catId}"] .row-meta`);
        if (!rowMeta) return;
        
        let badge = /** @type {HTMLElement|null} */ (rowMeta.querySelector('.calc-badge'));
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'calc-badge';
            badge.style.cssText = `
                font-size: 0.75rem;
                font-weight: 700;
                color: var(--color-secondary);
                background: var(--color-secondary-glow);
                padding: 2px 6px;
                border-radius: 6px;
                margin-left: 8px;
                border: 1px solid rgba(255,255,255,0.05);
                display: inline-block;
                vertical-align: middle;
            `;
            rowMeta.appendChild(badge);
        }
        badge.textContent = `(= ${pts} SP)`;
        badge.style.display = pts > 0 ? 'inline-block' : 'none';
    };

    updateRowBadge('quacksalber_rubies', rubyPoints);
    updateRowBadge('quacksalber_coins', coinPoints);

    return vp + rubyPoints + coinPoints;
}

// ── La Granja custom calculator ──────────────────────────────────────────
/**
 * @param {Record<string, number>} scores
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
function laGranjaCalculator(scores, shadowRoot) {
    const vp = scores['lagranja_vp'] || 0;
    const silver = scores['lagranja_silver'] || 0;

    const silverPoints = Math.floor(silver / 5);

    /**
     * @param {string} catId
     * @param {number} pts
     */
    const updateRowBadge = (catId, pts) => {
        const rowMeta = shadowRoot.querySelector(`.score-row[data-category="${catId}"] .row-meta`);
        if (!rowMeta) return;
        
        let badge = /** @type {HTMLElement|null} */ (rowMeta.querySelector('.calc-badge'));
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'calc-badge';
            badge.style.cssText = `
                font-size: 0.75rem;
                font-weight: 700;
                color: var(--color-secondary);
                background: var(--color-secondary-glow);
                padding: 2px 6px;
                border-radius: 6px;
                margin-left: 8px;
                border: 1px solid rgba(255,255,255,0.05);
                display: inline-block;
                vertical-align: middle;
            `;
            rowMeta.appendChild(badge);
        }
        badge.textContent = `(= ${pts} SP)`;
        badge.style.display = pts > 0 ? 'inline-block' : 'none';
    };

    updateRowBadge('lagranja_silver', silverPoints);

    return vp + silverPoints;
}

// ── Arche Nova custom calculator ───────────────────────────────────────────
/**
 * @param {Record<string, number>} scores
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
function archeNovaCalculator(scores, shadowRoot) {
    const appeal = scores['arche_nova_appeal'] || 0;
    const conservation = scores['arche_nova_conservation'] || 0;

    const traditionalScore = appeal - conservation;

    // Clean up any remaining alt-score-hints
    const altHint = shadowRoot.querySelector('.alt-score-hint');
    if (altHint) altHint.remove();

    // Clean up any generic row badges
    const rowMeta = shadowRoot.querySelector(`.score-row[data-category="arche_nova_conservation"] .row-meta`);
    if (rowMeta) {
        const badge = rowMeta.querySelector('.calc-badge');
        if (badge) badge.remove();
    }

    return traditionalScore;
}

// ── Scythe custom calculator ───────────────────────────────────────────────
/**
 * @param {Record<string, number>} scores
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
function scytheCalculator(scores, shadowRoot) {
    const popularity = scores['popularity'] || 0;
    let starMult = 2, regionMult = 1, resourceMult = 1;
    let tierLabel = 'Stufe 1 (🙁)', tierColor = 'hsl(351, 89%, 60%)';

    if (popularity >= 7 && popularity <= 12) {
        starMult = 3; regionMult = 2; resourceMult = 2;
        tierLabel = 'Stufe 2 (🙂)'; tierColor = 'hsl(42, 95%, 55%)';
    } else if (popularity >= 13) {
        starMult = 4; regionMult = 3; resourceMult = 3;
        tierLabel = 'Stufe 3 (👑)'; tierColor = 'hsl(172, 90%, 45%)';
    }

    const badge = /** @type {HTMLElement | null} */ (shadowRoot.getElementById('pop-tier-badge'));
    if (badge) {
        badge.textContent = `${tierLabel} (Beliebtheit: ${popularity})`;
        badge.style.color = badge.style.borderColor = tierColor;
        badge.style.backgroundColor = tierColor + '15';
    }
    const mStars = shadowRoot.getElementById('mult-stars');
    const mRegions = shadowRoot.getElementById('mult-regions');
    const mResources = shadowRoot.getElementById('mult-resources');
    if (mStars) mStars.textContent = `x${starMult}`;
    if (mRegions) mRegions.textContent = `x${regionMult}`;
    if (mResources) mResources.textContent = `x${resourceMult}`;

    const resourcePairs = Math.floor((scores['resources'] || 0) / 2);
    return ((scores['stars'] || 0) * starMult)
         + ((scores['regions'] || 0) * regionMult)
         + (resourcePairs * resourceMult)
         + (scores['coins'] || 0)
         + (scores['building_bonus'] || 0);
}

// ── Sattgrün custom calculator ──────────────────────────────────────────────
/**
 * @param {Record<string, number>} scores
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
function sattgruenCalculator(scores, shadowRoot) {
    const plants = scores['sattgruen_plants'] || 0;
    const leaves = scores['sattgruen_leaves'] || 0;
    const potStein = scores['sattgruen_pot_stein'] || 0;
    const potHolz = scores['sattgruen_pot_holz'] || 0;
    const potKeramik = scores['sattgruen_pot_keramik'] || 0;
    const rooms = scores['sattgruen_rooms'] || 0;
    const uniqueItems = scores['sattgruen_items'] || 0;
    const plantDiversity = scores['sattgruen_plant_diversity'] || 0;
    const roomDiversity = scores['sattgruen_room_diversity'] || 0;
    const goals = scores['sattgruen_goals'] || 0;

    // Calculations
    const leavesPoints = Math.floor(leaves / 2);
    const potSteinPoints = potStein * 3;
    const potHolzPoints = potHolz * 2;
    const potKeramikPoints = potKeramik * 1;
    const itemSteps = [0, 1, 3, 6, 9, 12, 16, 20, 25];
    const itemPoints = itemSteps[Math.min(uniqueItems, itemSteps.length - 1)] || 0;
    const plantDivPoints = plantDiversity >= 1 ? 3 : 0;
    const roomDivPoints = roomDiversity >= 1 ? 3 : 0;

    // Helper to update badges next to titles
    /**
     * @param {string} catId
     * @param {number} pts
     */
    const updateRowBadge = (catId, pts) => {
        const rowMeta = shadowRoot.querySelector(`.score-row[data-category="${catId}"] .row-meta`);
        if (!rowMeta) return;
        
        let badge = /** @type {HTMLElement|null} */ (rowMeta.querySelector('.calc-badge'));
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'calc-badge';
            badge.style.cssText = `
                font-size: 0.75rem;
                font-weight: 700;
                color: var(--color-secondary);
                background: var(--color-secondary-glow);
                padding: 2px 6px;
                border-radius: 6px;
                margin-left: 8px;
                border: 1px solid rgba(255,255,255,0.05);
                display: inline-block;
                vertical-align: middle;
            `;
            rowMeta.appendChild(badge);
        }
        badge.textContent = `(= ${pts} SP)`;
        badge.style.display = pts > 0 ? 'inline-block' : 'none';
    };

    // Update row badges
    updateRowBadge('sattgruen_leaves', leavesPoints);
    updateRowBadge('sattgruen_pot_stein', potSteinPoints);
    updateRowBadge('sattgruen_pot_holz', potHolzPoints);
    updateRowBadge('sattgruen_pot_keramik', potKeramikPoints);
    updateRowBadge('sattgruen_items', itemPoints);
    updateRowBadge('sattgruen_plant_diversity', plantDivPoints);
    updateRowBadge('sattgruen_room_diversity', roomDivPoints);

    return plants + leavesPoints + potSteinPoints + potHolzPoints + potKeramikPoints + rooms + itemPoints + plantDivPoints + roomDivPoints + goals;
}

// ── Next Station: London custom calculator ──────────────────────────────────
/**
 * @param {Record<string, number>} scores
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
function nextStationLondonCalculator(scores, shadowRoot) {
    const r1_d = scores['london_r1_districts'] || 0;
    const r1_s = scores['london_r1_stations'] || 0;
    const r1_t = scores['london_r1_thames'] || 0;
    const r1_score = (r1_d * r1_s) + (r1_t * 2);

    const r2_d = scores['london_r2_districts'] || 0;
    const r2_s = scores['london_r2_stations'] || 0;
    const r2_t = scores['london_r2_thames'] || 0;
    const r2_score = (r2_d * r2_s) + (r2_t * 2);

    const r3_d = scores['london_r3_districts'] || 0;
    const r3_s = scores['london_r3_stations'] || 0;
    const r3_t = scores['london_r3_thames'] || 0;
    const r3_score = (r3_d * r3_s) + (r3_t * 2);

    const r4_d = scores['london_r4_districts'] || 0;
    const r4_s = scores['london_r4_stations'] || 0;
    const r4_t = scores['london_r4_thames'] || 0;
    const r4_score = (r4_d * r4_s) + (r4_t * 2);

    const tourist = scores['london_tourist_attractions'] || 0;

    const ic2 = scores['london_interchanges_2'] || 0;
    const ic3 = scores['london_interchanges_3'] || 0;
    const ic4 = scores['london_interchanges_4'] || 0;
    const interchanges_score = (ic2 * 2) + (ic3 * 5) + (ic4 * 9);

    const goals = scores['london_goals_achieved'] || 0;
    const goals_score = goals * 10;

    // Helper to update badges next to titles
    /**
     * @param {string} catId
     * @param {number} pts
     * @param {string} [customText]
     */
    const updateRowBadge = (catId, pts, customText = undefined) => {
        const rowMeta = shadowRoot.querySelector(`.score-row[data-category="${catId}"] .row-meta`);
        if (!rowMeta) return;
        
        let badge = /** @type {HTMLElement|null} */ (rowMeta.querySelector('.calc-badge'));
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'calc-badge';
            badge.style.cssText = `
                font-size: 0.75rem;
                font-weight: 700;
                color: var(--color-secondary);
                background: var(--color-secondary-glow);
                padding: 2px 6px;
                border-radius: 6px;
                margin-left: 8px;
                border: 1px solid rgba(255,255,255,0.05);
                display: inline-block;
                vertical-align: middle;
            `;
            rowMeta.appendChild(badge);
        }
        badge.textContent = customText !== undefined ? customText : `(= ${pts} SP)`;
        badge.style.display = (pts > 0 || (customText && customText !== '')) ? 'inline-block' : 'none';
    };

    updateRowBadge('london_r1_districts', 0, '');
    updateRowBadge('london_r1_stations', 0, '');
    updateRowBadge('london_r1_thames', 0, '');

    updateRowBadge('london_r2_districts', 0, '');
    updateRowBadge('london_r2_stations', 0, '');
    updateRowBadge('london_r2_thames', 0, '');

    updateRowBadge('london_r3_districts', 0, '');
    updateRowBadge('london_r3_stations', 0, '');
    updateRowBadge('london_r3_thames', 0, '');

    updateRowBadge('london_r4_districts', 0, '');
    updateRowBadge('london_r4_stations', 0, '');
    updateRowBadge('london_r4_thames', 0, '');

    updateRowBadge('london_interchanges_2', 0, '');
    updateRowBadge('london_interchanges_3', 0, '');
    updateRowBadge('london_interchanges_4', 0, '');

    const goalsRow = shadowRoot.querySelector(`.score-row[data-category="london_goals_achieved"]`);
    if (goalsRow) {
        updateRowBadge('london_goals_achieved', 0, '');
    }

    return r1_score + r2_score + r3_score + r4_score + tourist + interchanges_score + goals_score;
}

// ── Age of Innovation ranking helper ─────────────────────────────────────────
/**
 * Computes rank placements and corresponding points for players based on their scores.
 * Tied players share the points of their respective ranks, rounded down.
 * @param {Array<number>} values
 * @param {Array<number>} pointsList
 * @param {boolean} excludeZero If true, players with score 0 receive 0 points and placement '-'
 * @returns {Array<{ points: number, rank: string }>}
 */
function getRankingDetails(values, pointsList, excludeZero = false) {
    const results = Array(values.length).fill(null).map(() => ({ points: 0, rank: '-' }));
    const indices = values.map((val, idx) => ({ val, idx }));
    
    const valid = excludeZero ? indices.filter(item => item.val > 0) : [...indices];
    valid.sort((a, b) => b.val - a.val);
    
    let i = 0;
    while (i < valid.length) {
        let j = i;
        while (j < valid.length && valid[j].val === valid[i].val) {
            j++;
        }
        
        const groupSize = j - i;
        let sumPoints = 0;
        for (let p = 0; p < groupSize; p++) {
            const rankIdx = i + p;
            if (rankIdx < pointsList.length) {
                sumPoints += pointsList[rankIdx];
            }
        }
        
        const sharedPoints = Math.floor(sumPoints / groupSize);
        let rankLabel = "";
        if (groupSize === 1) {
            rankLabel = `${i + 1}.`;
        } else {
            rankLabel = `${i + 1}.-${i + groupSize}.`;
        }
        
        for (let p = i; p < j; p++) {
            results[valid[p].idx] = { points: sharedPoints, rank: rankLabel };
        }
        
        i = j;
    }
    
    return results;
}

// ── Age of Innovation custom calculator ──────────────────────────────────────
/**
 * @param {GenericScoreSheet} sheet
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
function ageOfInnovationCalculator(sheet, shadowRoot) {
    const players = sheet.players;

    // Compute the total for every player
    players.forEach((player, idx) => {
        const scores = player.scores || {};
        const duringGamePoints = scores['aoi_during_game'] || 0;
        const buildingPts = scores['aoi_buildings'] || 0;
        const bankPts = scores['aoi_banking'] || 0;
        const lawPts = scores['aoi_law'] || 0;
        const engPts = scores['aoi_engineering'] || 0;
        const medPts = scores['aoi_medicine'] || 0;

        const coins = scores['aoi_leftover_coins'] || 0;
        const resourcePoints = Math.floor(coins / 5);

        player.total = duringGamePoints + buildingPts + bankPts + lawPts + engPts + medPts + resourcePoints;
    });

    // Helper to update badges next to titles in the active player's view
    const activeIdx = sheet.activePlayerIndex;
    const activeScores = players[activeIdx].scores || {};

    const updateRowBadge = (/** @type {string} */ catId, /** @type {number} */ pts, extraLabel = '') => {
        const rowMeta = shadowRoot.querySelector(`.score-row[data-category="${catId}"] .row-meta`);
        if (!rowMeta) return;
        
        let badge = /** @type {HTMLElement|null} */ (rowMeta.querySelector('.calc-badge'));
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'calc-badge';
            badge.style.cssText = `
                font-size: 0.75rem;
                font-weight: 700;
                color: var(--color-secondary);
                background: var(--color-secondary-glow);
                padding: 2px 6px;
                border-radius: 6px;
                margin-left: 8px;
                border: 1px solid rgba(255,255,255,0.05);
                display: inline-block;
                vertical-align: middle;
            `;
            rowMeta.appendChild(badge);
        }
        badge.textContent = extraLabel ? `(= ${pts} SP, ${extraLabel})` : `(= ${pts} SP)`;
        badge.style.display = 'inline-block';
    };
    
    // Update resource exchange badges
    const activeCoins = activeScores['aoi_leftover_coins'] || 0;
    updateRowBadge('aoi_leftover_coins', Math.floor(activeCoins / 5), `Gesamtgeld: ${activeCoins}`);

    // Update the other tab badges so they show live scores
    const tabButtons = shadowRoot.querySelectorAll('.player-tabs-bar .tab-btn');
    tabButtons.forEach((btn, index) => {
        const badge = btn.querySelector('.tab-total');
        if (badge && players[index]) {
            badge.textContent = String(players[index].total || 0);
        }
    });

    return players[activeIdx].total;
}

// ── Arler Erde custom calculator ─────────────────────────────────────────────
/**
 * @param {Record<string, number>} scores
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
function arlerErdeCalculator(scores, shadowRoot) {
    const clothing = scores['clothing_building'] || 0;
    const equipment = scores['equipment'] || 0;
    const travel = scores['travel'] || 0;
    const crafting = scores['crafting'] || 0;
    const goods = scores['goods'] || 0;
    const home = scores['home_board'] || 0;
    const moors = scores['moors'] || 0;
    const sheep = scores['animals_sheep'] || 0;
    const horse = scores['animals_horse'] || 0;
    const cattle = scores['animals_cattle'] || 0;
    const shortages = scores['shortages'] || 0;

    // Expansion categories (will be 0 if the expansion is not active/toggled)
    const tea = scores['tea'] || 0;
    const ships = scores['ships'] || 0;
    const schlootzieher = scores['schlootzieher'] || 0;

    // Uwe Rosenberg animal scoring:
    // "Jedes Tier derjenigen Art, von der ihr am wenigsten habt, ist 2 Punkte wert. 
    // Zweitwenigsten: 1 Punkt. Drittwenigsten (meisten): 0 Punkte."
    // Quantities sorted: Q1 <= Q2 <= Q3: Q1 * 2 + Q2 * 1 + Q3 * 0
    const sorted = [sheep, horse, cattle].sort((a, b) => a - b);
    const animalPoints = sorted[0] * 2 + sorted[1] * 1;

    // Helper to update badges next to animal rows
    const updateRowBadge = (/** @type {string} */ catId, /** @type {string} */ text) => {
        const rowMeta = shadowRoot.querySelector(`.score-row[data-category="${catId}"] .row-meta`);
        if (!rowMeta) return;
        
        let badge = /** @type {HTMLElement|null} */ (rowMeta.querySelector('.calc-badge'));
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'calc-badge';
            badge.style.cssText = `
                font-size: 0.75rem;
                font-weight: 700;
                color: var(--color-secondary);
                background: var(--color-secondary-glow);
                padding: 2px 6px;
                border-radius: 6px;
                margin-left: 8px;
                border: 1px solid rgba(255,255,255,0.05);
                display: inline-block;
                vertical-align: middle;
            `;
            rowMeta.appendChild(badge);
        }
        badge.textContent = text;
        badge.style.display = 'inline-block';
    };

    // Determine multipliers dynamically based on sorting
    const animals = [
        { id: 'animals_sheep', name: 'Schafe', count: sheep },
        { id: 'animals_horse', name: 'Pferde', count: horse },
        { id: 'animals_cattle', name: 'Rinder', count: cattle }
    ];
    animals.sort((a, b) => a.count - b.count);

    const ptsMap = {
        [animals[0].id]: animals[0].count * 2,
        [animals[1].id]: animals[1].count * 1,
        [animals[2].id]: 0
    };
    
    const multMap = {
        [animals[0].id]: 2,
        [animals[1].id]: 1,
        [animals[2].id]: 0
    };

    updateRowBadge('animals_sheep', `(= ${ptsMap['animals_sheep']} SP, da x${multMap['animals_sheep']} Mult.)`);
    updateRowBadge('animals_horse', `(= ${ptsMap['animals_horse']} SP, da x${multMap['animals_horse']} Mult.)`);
    updateRowBadge('animals_cattle', `(= ${ptsMap['animals_cattle']} SP, da x${multMap['animals_cattle']} Mult.)`);

    return clothing + equipment + travel + crafting + goods + home + moors + animalPoints + shortages + tea + ships + schlootzieher;
}

// ── Underwater Cities custom calculator ──────────────────────────────────────
/**
 * @param {Record<string, number>} scores
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
function underwaterCitiesCalculator(scores, shadowRoot) {
    const ingameVp = scores['underwater_cities_ingame_vp'] || 0;
    const metropolis = scores['underwater_cities_metropolis'] || 0;
    const net0 = scores['underwater_cities_net_0'] || 0;
    const net1 = scores['underwater_cities_net_1'] || 0;
    const net2 = scores['underwater_cities_net_2'] || 0;
    const net3 = scores['underwater_cities_net_3'] || 0;
    const cards = scores['underwater_cities_cards'] || 0;
    const biomass = scores['underwater_cities_biomass'] || 0;
    const kelp = scores['underwater_cities_kelp'] || 0;
    const science = scores['underwater_cities_science'] || 0;
    const steelplastic = scores['underwater_cities_steelplastic'] || 0;
    const credits = scores['underwater_cities_credits'] || 0;

    const net0Points = net0 * 2;
    const net1Points = net1 * 3;
    const net2Points = net2 * 4;
    const net3Points = net3 * 6;

    const biomassCredits = biomass * 2;
    const totalCredits = credits + biomassCredits;
    const totalResources = totalCredits + kelp + science + steelplastic;
    const resourcePoints = Math.floor(totalResources / 4);

    /**
     * @param {string} catId
     * @param {number} pts
     * @param {string} [customText]
     */
    const updateRowBadge = (catId, pts, customText = undefined) => {
        const rowMeta = shadowRoot.querySelector(`.score-row[data-category="${catId}"] .row-meta`);
        if (!rowMeta) return;
        
        let badge = /** @type {HTMLElement|null} */ (rowMeta.querySelector('.calc-badge'));
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'calc-badge';
            badge.style.cssText = `
                font-size: 0.75rem;
                font-weight: 700;
                color: var(--color-secondary);
                background: var(--color-secondary-glow);
                padding: 2px 6px;
                border-radius: 6px;
                margin-left: 8px;
                border: 1px solid rgba(255,255,255,0.05);
                display: inline-block;
                vertical-align: middle;
            `;
            rowMeta.appendChild(badge);
        }
        badge.textContent = customText !== undefined ? customText : `(= ${pts} SP)`;
        badge.style.display = (pts > 0 || (customText && customText !== '')) ? 'inline-block' : 'none';
    };

    updateRowBadge('underwater_cities_net_0', net0Points);
    updateRowBadge('underwater_cities_net_1', net1Points);
    updateRowBadge('underwater_cities_net_2', net2Points);
    updateRowBadge('underwater_cities_net_3', net3Points);

    updateRowBadge('underwater_cities_biomass', biomassCredits, `(= +${biomassCredits} Credits)`);
    updateRowBadge('underwater_cities_credits', resourcePoints, `(= ${resourcePoints} SP von ${totalResources} Ges.Ress.)`);

    updateRowBadge('underwater_cities_kelp', 0, '');
    updateRowBadge('underwater_cities_science', 0, '');
    updateRowBadge('underwater_cities_steelplastic', 0, '');

    return ingameVp + metropolis + net0Points + net1Points + net2Points + net3Points + cards + resourcePoints;
}


// ── Main Component ─────────────────────────────────────────────────────────
export class GenericScoreSheet extends BaseScoreSheet {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        /** @type {GameTemplate | null} */
        this._template = null;
        /** @type {boolean} */
        this._expansionActive = false;
    }

    /**
     * Load a game template and render the score sheet.
     * @param {GameTemplate} template  A single entry from games_config.json
     */
    loadTemplate(template) {
        this._template = template;
        this._render();
        if (this.shadowRoot) {
            this.initScoreSheetHooks(this.shadowRoot);
            this._initListeners();
        }
    }

    // ── Calculation ──────────────────────────────────────────────────────
    calculateTotals() {
        if (!this._template || !this.shadowRoot) return;
        const t = this._template;
        let total = 0;

        // Custom calculators for games with non-trivial formulas
        if (t.calculator === 'scythe') {
            total = scytheCalculator(this.scores, this.shadowRoot);
        } else if (t.calculator === 'sattgruen') {
            total = sattgruenCalculator(this.scores, this.shadowRoot);
        } else if (t.calculator === 'age_of_innovation') {
            total = ageOfInnovationCalculator(this, this.shadowRoot);
        } else if (t.calculator === 'arler_erde') {
            total = arlerErdeCalculator(this.scores, this.shadowRoot);
        } else if (t.calculator === 'quacksalber') {
            total = quacksalberCalculator(this.scores, this.shadowRoot);
        } else if (t.calculator === 'arche_nova') {
            total = archeNovaCalculator(this.scores, this.shadowRoot);
        } else if (t.calculator === 'la_granja') {
            total = laGranjaCalculator(this.scores, this.shadowRoot);
        } else if (t.calculator === 'underwater_cities') {
            total = underwaterCitiesCalculator(this.scores, this.shadowRoot);
        } else if (t.calculator === 'next_station_london') {
            total = nextStationLondonCalculator(this.scores, this.shadowRoot);
        } else {
            // Remove alternative score hint if it exists (e.g. left from arche_nova)
            const altHint = this.shadowRoot.querySelector('.alt-score-hint');
            if (altHint) altHint.remove();
            // Generic calculation for all active categories
            const allCats = [...t.categories];
            if (this._expansionActive && t.expansion?.extraCategories) {
                allCats.push(...t.expansion.extraCategories);
            }
            for (const cat of allCats) {
                const val = this.scores[cat.id] || 0;
                if (cat.type === 'sum') {
                    total += val;
                } else if (cat.type === 'multiplier') {
                    const pts = val * (cat.multiplier || 1);
                    total += pts;
                    this._updateGenericRowBadge(cat.id, pts);
                } else if (cat.type === 'step') {
                    const steps = cat.steps || [];
                    const pts = steps[Math.min(val, steps.length - 1)] || 0;
                    total += pts;
                    this._updateGenericRowBadge(cat.id, pts);
                }
                else if (cat.type === 'popularity_driver') { /* drives multipliers, not summed directly */ }
            }
        }

        this.totalScore = total;
        const el = this.shadowRoot.getElementById('total-score-value');
        if (el) el.textContent = String(total);
    }

    /**
     * @param {string} catId
     * @param {number} pts
     */
    _updateGenericRowBadge(catId, pts) {
        if (!this.shadowRoot) return;
        const rowMeta = this.shadowRoot.querySelector(`.score-row[data-category="${catId}"] .row-meta`);
        if (!rowMeta) return;
        
        let badge = /** @type {HTMLElement|null} */ (rowMeta.querySelector('.calc-badge'));
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'calc-badge';
            badge.style.cssText = `
                font-size: 0.75rem;
                font-weight: 700;
                color: var(--color-secondary);
                background: var(--color-secondary-glow);
                padding: 2px 6px;
                border-radius: 6px;
                margin-left: 8px;
                border: 1px solid rgba(255,255,255,0.05);
                display: inline-block;
                vertical-align: middle;
            `;
            rowMeta.appendChild(badge);
        }
        badge.textContent = `(= ${pts} SP)`;
        badge.style.display = pts > 0 ? 'inline-block' : 'none';
    }

    // ── Listeners ────────────────────────────────────────────────────────
    _initListeners() {
        if (!this._template || !this.shadowRoot) return;
        const t = this._template;
        const shadow = this.shadowRoot;

        // Expansion toggle (e.g. Revive)
        if (t.expansion) {
            const toggle = /** @type {HTMLInputElement | null} */ (shadow.getElementById('toggle-expansion'));
            /** @type {NodeListOf<HTMLElement>} */
            const devotionRows = shadow.querySelectorAll('.expansion-only-row');
            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    const target = /** @type {HTMLInputElement} */ (e.target);
                    this._expansionActive = target.checked;
                    devotionRows.forEach(r => r.classList.toggle('hidden', !this._expansionActive));
                    if (!this._expansionActive && t.expansion?.extraCategories) {
                        for (const cat of t.expansion.extraCategories) {
                            this.scores[cat.id] = 0;
                            const btn = /** @type {HTMLElement | null} */ (shadow.querySelector(`.score-trigger[data-category="${cat.id}"]`));
                            if (btn) {
                                if (btn.tagName === 'INPUT') {
                                    /** @type {HTMLInputElement} */ (btn).value = '0';
                                } else {
                                    btn.textContent = '0';
                                }
                                btn.classList.remove('populated');
                            }
                        }
                    }
                    this.recalculate();
                });
            }
        }
        // Collapsible section headers click handlers
        const headers = shadow.querySelectorAll('.section-card-header');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const card = header.closest('.scoresheet-section-card');
                if (card) {
                    card.classList.toggle('collapsed');
                }
            });
        });

        // Wiki Help Icons click handlers
        const helpIcons = shadow.querySelectorAll('.cat-help-icon');
        helpIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                const helpText = icon.getAttribute('data-help');
                if (helpText) {
                    showToast(helpText, 'info', 6000);
                }
            });
        });

        // Reference modal
        if (t.modal) {            const btnShow   = shadow.getElementById('btn-show-modal');
            const btnClose  = shadow.getElementById('btn-close-modal');
            const backdrop  = shadow.getElementById('modal-backdrop');
            const modal     = shadow.getElementById('example-modal');
            const expGuide  = /** @type {HTMLElement | null} */ (shadow.getElementById('expansion-guide-container'));

            const close = () => modal?.classList.remove('active');
            btnShow?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (expGuide) expGuide.style.display = this._expansionActive ? 'block' : 'none';
                modal?.classList.add('active');
            });
            btnClose?.addEventListener('click', close);
            backdrop?.addEventListener('click', close);
        }
    }

    // ── Render ───────────────────────────────────────────────────────────
    _render() {
        if (!this._template || !this.shadowRoot) return;
        const t = this._template;
        const isWhiteCircle = t.theme?.icon_style === 'white-circle';

        this.shadowRoot.innerHTML = `
            <style>
                ${BaseScoreSheet.getSharedStyles()}

                .hidden { display: none !important; }

                /* Dynamic icon colours injected per category via style attr */
                .row-icon img {
                    width: ${isWhiteCircle ? '24px' : '32px'};
                    height: ${isWhiteCircle ? '24px' : '32px'};
                    object-fit: contain;
                    display: block;
                }
                ${isWhiteCircle ? `
                .row-icon {
                    background-color: rgba(255,255,255,0.9) !important;
                    border-radius: 50% !important;
                    box-shadow: 0 0 8px rgba(255,255,255,0.25);
                    border: 1px solid rgba(255,255,255,0.95);
                    width: 32px; height: 32px;
                    display: flex; align-items: center; justify-content: center;
                }` : ''}

                /* Scythe popularity panel */
                .popularity-info-panel {
                    background: var(--color-surface-glass);
                    border: 1px solid var(--color-border-glass);
                    border-radius: 16px;
                    padding: 14px 18px;
                    margin-bottom: 12px;
                    display: flex; flex-direction: column; gap: 10px;
                }
                .info-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
                .info-label { font-family:'Outfit',sans-serif; font-size:.85rem; font-weight:700; color:var(--color-text-primary); }
                .info-badge { font-size:.75rem; font-weight:800; padding:3px 8px; border-radius:8px; border:1px solid transparent; transition:all .2s ease; }
                .multipliers-list { display:flex; justify-content:space-between; gap:8px; background:rgba(0,0,0,0.1); padding:10px; border-radius:12px; }
                .mult-item { font-size:.75rem; color:var(--color-text-secondary); display:flex; align-items:center; gap:4px; }
                .mult-item strong { color:var(--color-text-primary); font-size:.85rem; font-weight:800; }

                /* Expansion toggle */
                .expansion-toggle-container {
                    display:flex; justify-content:space-between; align-items:center;
                    padding:14px 20px;
                    background:var(--color-surface-glass);
                    border:1px solid var(--color-border-glass);
                    border-radius:18px; margin-bottom:12px;
                    box-shadow:var(--shadow-inner);
                    backdrop-filter:blur(12px);
                }
                .toggle-label { font-family:'Outfit',sans-serif; font-size:.95rem; font-weight:600; color:var(--color-text-primary); display:flex; align-items:center; gap:8px; }
                .toggle-badge { padding:2px 8px; border-radius:8px; font-size:.75rem; border:1px solid hsla(295,85%,63%,.3); background:hsla(295,85%,63%,.15); color:hsl(295,85%,75%); }
                .switch { position:relative; display:inline-block; width:48px; height:26px; }
                .switch input { opacity:0; width:0; height:0; }
                .slider { position:absolute; cursor:pointer; inset:0; background:rgba(0,0,0,0.1); border:1px solid var(--color-border-glass); transition:.3s; border-radius:34px; }
                .slider:before { position:absolute; content:""; height:18px; width:18px; left:3px; bottom:3px; background:var(--color-text-muted); transition:.3s; border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,.2); }
                input:checked+.slider { background:hsla(295,85%,63%,.25); border-color:hsla(295,85%,63%,.5); }
                input:checked+.slider:before { transform:translateX(22px); background:hsl(295,85%,63%); }

                /* Modal */
                .btn-reference { background:var(--color-surface-glass); border:1px solid var(--color-border-glass); color:var(--color-text-secondary); padding:10px 20px; border-radius:14px; font-family:'Outfit',sans-serif; font-size:.9rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all .2s ease; backdrop-filter:blur(8px); }
                .btn-reference:hover { background:var(--color-surface-solid); color:var(--color-text-primary); transform:translateY(-1px); }
                .reference-container { display:flex; justify-content:center; margin-top:15px; margin-bottom:5px; }
                .example-modal { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity .25s; }
                .example-modal.active { opacity:1; pointer-events:auto; }
                .modal-backdrop { position:absolute; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(12px); }
                .modal-content { position:relative; background:var(--color-bg-base); border:1px solid var(--color-border-glass); border-radius:24px; width:92%; max-width:460px; max-height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:var(--shadow-premium); transform:scale(.92); transition:transform .25s cubic-bezier(.34,1.56,.64,1); z-index:10001; }
                .example-modal.active .modal-content { transform:scale(1); }
                .modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--color-border-glass); }
                .modal-title { font-family:'Outfit',sans-serif; font-size:1.1rem; font-weight:700; color:var(--color-text-primary); margin:0; display:flex; align-items:center; gap:8px; }
                .btn-close-modal { background:transparent; border:none; color:var(--color-text-secondary); font-size:1.1rem; cursor:pointer; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:all .2s; }
                .btn-close-modal:hover { background:var(--color-surface-glass); color:var(--color-text-primary); }
                .modal-body { padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:16px; background:var(--color-bg-deep); }
                .modal-img { width:100%; height:auto; border-radius:14px; box-shadow:var(--shadow-premium); max-height:50vh; object-fit:contain; border:1px solid var(--color-border-glass); }
                .modal-section-title { font-family:'Outfit',sans-serif; font-size:.9rem; font-weight:600; color:var(--color-text-secondary); margin:0 0 6px; }

                .scoresheet-grid { padding-bottom: 24px; }

                .score-info-block { background: rgba(255,255,255,0.04); border: 1px solid var(--color-border-glass); border-left: 3px solid var(--color-secondary); border-radius: 12px; padding: 14px 16px; margin: 4px 0; display: flex; flex-direction: column; gap: 5px; }
                .score-info-label { font-family:'Outfit',sans-serif; font-size: 0.82rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 2px; }
                .score-info-line { font-family:'Outfit',sans-serif; font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.55; }
                .score-info-line-highlight { font-family:'Outfit',sans-serif; font-size: 0.82rem; font-weight: 700; color: var(--color-secondary); border-top: 1px solid var(--color-border-glass); padding-top: 7px; margin-top: 2px; }

            </style>

            <div class="scoresheet-grid">
                ${this._renderScythePanelIfNeeded()}
                ${this._renderExpansionToggleIfNeeded()}
                ${this._renderCategories()}

                <div class="score-summary-card">
                    <span class="summary-title">Gesamtpunktzahl</span>
                    <span class="summary-value" id="total-score-value">0</span>
                </div>

                ${t.modal ? this._renderModalButton() : ''}
            </div>

            ${t.modal ? this._renderModal() : ''}
        `;
    }

    /**
     * @param {any} cat
     * @param {string} [extraClass]
     */
    _renderExpansionPanel(cat, extraClass = '') {
        return `
            <div class="expansion-panel hidden ${escapeHtml(extraClass)}" data-for-category="${escapeHtml(cat.id)}">
                <div class="player-progress-list"></div>
            </div>`;
    }

    /**
     * @param {any} cat
     * @param {string} [extraClass]
     */
    _renderRow(cat, extraClass = '') {
        let iconHtml = '';
        if (cat.icon) {
            let path = cat.icon;
            if (path.endsWith('.png')) {
                path = path.slice(0, -4) + '.webp';
            }
            // Prevent double-prefixing if absolute base URL is in database
            const prefix = '/files/Brettspiel_Partner/';
            if (path.startsWith(prefix)) {
                path = path.slice(prefix.length);
            }
            if (path.startsWith('/')) {
                path = path.slice(1);
            }
            const safePath = sanitizeImagePath(path);
            iconHtml = `<img src="${_BASE}${escapeHtml(safePath)}" alt="${escapeHtml(cat.label)}">`;
        } else {
            iconHtml = makeSvgIcon(cat.svgIcon || 'star', sanitizeCssColor(cat.iconColor));
        }

        const iconStyle = cat.iconBg
            ? `style="background-color:${sanitizeCssColor(cat.iconBg)};color:${sanitizeCssColor(cat.iconColor) || 'currentColor'};--color-icon-glow:${sanitizeCssColor(cat.iconBg)};"`
            : (cat.iconColor ? `style="--color-icon-glow:${sanitizeCssColor(cat.iconColor)};"` : '');

        const escapedLabel = escapeHtml(cat.label);
        const label = cat.type === 'step'
            ? `${escapedLabel} → <em style="font-size:.78rem;opacity:.7">[${(cat.steps||[]).map((/** @type {any} */ s) => Number(s) || 0).join('/')} SP]</em>`
            : escapedLabel;

        // title = Regeltext → Desktop zeigt Tooltip beim Mouseover; Klick-Toast bleibt für Touch
        const helpHtml = cat.description
            ? `<span class="cat-help-icon" title="${escapeHtml(cat.description)}" data-help="${escapeHtml(cat.description)}">[?]</span>`
            : '';

        // Kategorien mit allowNegative dürfen kein digit-only Keyboard erzwingen,
        // sonst ist auf Mobilgeräten kein Minuszeichen erreichbar.
        const numericAttrs = cat.allowNegative
            ? ''
            : 'inputmode="numeric" pattern="[0-9]*"';

        return `
            <div class="score-row ${escapeHtml(extraClass)}" data-category="${escapeHtml(cat.id)}">
                <div class="row-meta">
                    <span class="row-icon" ${iconStyle}>${iconHtml}</span>
                    <span class="row-title">${label} ${helpHtml}</span>
                </div>
                <input type="number" ${numericAttrs} class="score-trigger" data-category="${escapeHtml(cat.id)}" data-label="${escapeHtml(cat.label)}" value="0" />
            </div>`;
    }

    /**
     * @param {any} cat
     */
    _renderInfoBlock(cat) {
        const lines = (cat.lines || []);
        const lastIdx = lines.length - 1;
        const linesHtml = lines.map((/** @type {string} */ l, /** @type {number} */ i) =>
            `<span class="${i === lastIdx ? 'score-info-line-highlight' : 'score-info-line'}">${escapeHtml(l)}</span>`
        ).join('');
        const labelHtml = cat.label ? `<span class="score-info-label">${escapeHtml(cat.label)}</span>` : '';
        return `<div class="score-info-block">${labelHtml}${linesHtml}</div>`;
    }

    _renderScythePanelIfNeeded() {
        if (this._template?.calculator !== 'scythe') return '';
        return `
            <div class="popularity-info-panel">
                <div class="info-header">
                    <span class="info-label">Beliebtheits-Multiplikatoren:</span>
                    <span class="info-badge" id="pop-tier-badge">Stufe 1 (🙁)</span>
                </div>
                <div class="multipliers-list">
                    <div class="mult-item">⭐ Sterne: <strong id="mult-stars">x2</strong></div>
                    <div class="mult-item">🗺️ Regionen: <strong id="mult-regions">x1</strong></div>
                    <div class="mult-item">🪵 Ressourcen: <strong id="mult-resources">x1</strong></div>
                </div>
            </div>`;
    }

    _renderExpansionToggleIfNeeded() {
        const exp = this._template?.expansion;
        if (!exp) return '';
        return `
            <div class="expansion-toggle-container">
                <span class="toggle-label">
                    ${makeSvgIcon('triangle-circle', 'hsl(295,85%,63%)')}
                    ${escapeHtml(exp.label)}
                    <span class="toggle-badge">${escapeHtml(exp.badge)}</span>
                </span>
                <label class="switch">
                    <input type="checkbox" id="toggle-expansion">
                    <span class="slider"></span>
                </label>
            </div>`;
    }

    /**
     * @returns {string}
     */
    _renderCategories() {
        if (!this._template) return '';
        const t = this._template;

        /** @type {Map<string, Array<{ id: string, label: string, [key: string]: any, isExpansion: boolean }>>} */
        const sectionsMap = new Map();
        /** @type {Array<string>} */
        const sectionOrder = [];

        for (const cat of t.categories) {
            const sec = /** @type {any} */ (cat).section || '';
            if (!sectionsMap.has(sec)) {
                sectionsMap.set(sec, []);
                sectionOrder.push(sec);
            }
            // @ts-ignore
            sectionsMap.get(sec).push({ ...cat, isExpansion: false });
        }

        if (t.expansion?.extraCategories) {
            for (const cat of t.expansion.extraCategories) {
                const sec = /** @type {any} */ (cat).section || '';
                if (!sectionsMap.has(sec)) {
                    sectionsMap.set(sec, []);
                    sectionOrder.push(sec);
                }
                // @ts-ignore
                sectionsMap.get(sec).push({ ...cat, isExpansion: true });
            }
        }

        let html = '';

        for (const sec of sectionOrder) {
            const sectionCats = sectionsMap.get(sec) || [];
            const cardIsExpansion = sectionCats.every(c => c.isExpansion);
            const extraClass = cardIsExpansion ? 'expansion-only-row hidden' : '';

            if (sec) {
                html += `
                    <div class="scoresheet-section-card collapsed ${extraClass}">
                        <div class="section-card-header">
                            <span>${escapeHtml(sec)}</span>
                            <span class="section-card-arrow">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </span>
                        </div>
                        <div class="section-card-grid">
                `;
                for (const cat of sectionCats) {
                    if (cat.type === 'info') {
                        html += this._renderInfoBlock(cat);
                        continue;
                    }
                    const rowExtraClass = cat.isExpansion ? 'expansion-only-row hidden' : '';
                    html += `
                        <div class="score-group ${rowExtraClass}">
                            ${this._renderRow(cat, rowExtraClass)}
                            ${this._renderExpansionPanel(cat, rowExtraClass)}
                        </div>`;
                }
                html += `</div></div>`;
            } else {
                for (const cat of sectionCats) {
                    if (cat.type === 'info') {
                        html += this._renderInfoBlock(cat);
                        continue;
                    }
                    const rowExtraClass = cat.isExpansion ? 'expansion-only-row hidden' : '';
                    html += `
                        <div class="score-group ${rowExtraClass}">
                            ${this._renderRow(cat, rowExtraClass)}
                            ${this._renderExpansionPanel(cat, rowExtraClass)}
                        </div>`;
                }
            }
        }

        return html;
    }

    _renderModalButton() {
        return `
            <div class="reference-container">
                <button class="btn-reference" id="btn-show-modal" type="button">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    Wertungsregeln anzeigen
                </button>
            </div>`;
    }

    _renderModal() {
        if (!this._template || !this._template.modal) return '';
        const { title, image } = this._template.modal;
        const exp = this._template.expansion;
        const safeImage = validateGameImageUrl(image) || '';
        const safeExpansionModal = exp?.expansionModal ? (validateGameImageUrl(exp.expansionModal) || '') : '';
        return `
            <div class="example-modal" id="example-modal">
                <div class="modal-backdrop" id="modal-backdrop"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">📋 ${escapeHtml(title)}</h3>
                        <button class="btn-close-modal" id="btn-close-modal" aria-label="Schließen">✕</button>
                    </div>
                    <div class="modal-body">
                        <div>
                            <h4 class="modal-section-title">Standard-Wertungsregeln</h4>
                            <img src="${escapeHtml(safeImage)}" alt="${escapeHtml(title)}" class="modal-img">
                        </div>
                        ${exp?.expansionModal ? `
                        <div id="expansion-guide-container" style="display:none;border-top:1px dashed hsla(223,20%,30%,.3);padding-top:16px;">
                            <h4 class="modal-section-title" style="color:hsl(295,85%,75%);">Erweiterungs-Wertung (${escapeHtml(exp.label)})</h4>
                            <img src="${escapeHtml(safeExpansionModal)}" alt="Erweiterung" class="modal-img">
                        </div>` : ''}
                    </div>
                </div>
            </div>`;
    }
}

if (!customElements.get('generic-score-sheet')) {
    customElements.define('generic-score-sheet', GenericScoreSheet);
}
