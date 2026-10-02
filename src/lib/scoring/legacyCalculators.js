// @ts-check
/**
 * Wörtliche Kopie der spielspezifischen Rechner aus GenericScoreSheet.js (verschoben, nicht
 * kopiert, in R01 des Frontend-Reworks). Dient als Golden-Master-Quelle für die neue, reine
 * Wertungs-Engine (src/lib/scoring/engine.js, R02) und bleibt unverändert bestehen, solange der
 * alte Wertungsbogen (GenericScoreSheet) noch läuft.
 *
 * Darf NICHTS aus stores/ oder services/ importieren (Stores greifen beim Import auf
 * window/localStorage zu und würden Node-Skripte wie tools/gen-golden-totals.mjs brechen).
 */

// ── Quacksalber custom calculator ──────────────────────────────────────────
/**
 * @param {Record<string, number>} scores
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
export function quacksalberCalculator(scores, shadowRoot) {
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
export function laGranjaCalculator(scores, shadowRoot) {
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
export function archeNovaCalculator(scores, shadowRoot) {
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
export function scytheCalculator(scores, shadowRoot) {
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
export function sattgruenCalculator(scores, shadowRoot) {
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
export function nextStationLondonCalculator(scores, shadowRoot) {
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
export function getRankingDetails(values, pointsList, excludeZero = false) {
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
 * @param {{ players: Array<{ scores: Record<string, number>, total: number }>, activePlayerIndex: number }} sheet
 * @param {ShadowRoot} shadowRoot
 * @returns {number}
 */
export function ageOfInnovationCalculator(sheet, shadowRoot) {
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
export function arlerErdeCalculator(scores, shadowRoot) {
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
export function underwaterCitiesCalculator(scores, shadowRoot) {
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

/** Karte für den Golden-Master-Generator (AoI hat eine andere Signatur und fehlt bewusst). */
export const LEGACY_CALCULATORS = {
  scythe: scytheCalculator,
  sattgruen: sattgruenCalculator,
  arler_erde: arlerErdeCalculator,
  quacksalber: quacksalberCalculator,
  arche_nova: archeNovaCalculator,
  la_granja: laGranjaCalculator,
  underwater_cities: underwaterCitiesCalculator,
  next_station_london: nextStationLondonCalculator,
};

/**
 * Wörtliche Kopie des generischen Zweigs aus GenericScoreSheet.calculateTotals()
 * (ohne DOM-Badges). Nur für den Golden Master.
 * @param {any} t Template @param {Record<string, number>} scores @param {boolean} expansionActive
 */
export function legacyGenericTotal(t, scores, expansionActive) {
  let total = 0;
  const allCats = [...t.categories];
  if (expansionActive && t.expansion?.extraCategories) allCats.push(...t.expansion.extraCategories);
  for (const cat of allCats) {
    const val = scores[cat.id] || 0;
    if (cat.type === 'sum') total += val;
    else if (cat.type === 'multiplier') total += val * (cat.multiplier || 1);
    else if (cat.type === 'step') {
      const steps = cat.steps || [];
      total += steps[Math.min(val, steps.length - 1)] || 0;
    }
  }
  return total;
}
