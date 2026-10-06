// @ts-check
/** Spielspezifische Rechner. Arithmetik 1:1 aus legacyCalculators.js; DOM-Badges → badges-Objekt. */
const sp = (pts, extra = '') => (extra ? `ergibt ${pts} SP · ${extra}` : `ergibt ${pts} SP`);

/** @type {Record<string, (scores: Record<string, number>, template?: any, opts?: any) => import('./engine.js').PlayerResult>} */
export const CALCULATORS = {
  quacksalber(s) {
    const rubyPoints = Math.floor((s.quacksalber_rubies || 0) / 2);
    const coinPoints = Math.floor((s.quacksalber_coins || 0) / 5);
    const badges = {};
    if (rubyPoints > 0) badges.quacksalber_rubies = sp(rubyPoints);
    if (coinPoints > 0) badges.quacksalber_coins = sp(coinPoints);
    return { total: (s.quacksalber_vp || 0) + rubyPoints + coinPoints, badges };
  },
  la_granja(s) {
    const silverPoints = Math.floor((s.lagranja_silver || 0) / 5);
    return { total: (s.lagranja_vp || 0) + silverPoints, badges: silverPoints > 0 ? { lagranja_silver: sp(silverPoints) } : {} };
  },
  arche_nova(s) {
    return { total: (s.arche_nova_appeal || 0) - (s.arche_nova_conservation || 0), badges: {} };
  },
  scythe(s) {
    const popularity = s.popularity || 0;
    let starMult = 2, regionMult = 1, resourceMult = 1, tier = 1;
    if (popularity >= 7 && popularity <= 12) { starMult = 3; regionMult = 2; resourceMult = 2; tier = 2; }
    else if (popularity >= 13) { starMult = 4; regionMult = 3; resourceMult = 3; tier = 3; }
    const resourcePairs = Math.floor((s.resources || 0) / 2);
    const total = (s.stars || 0) * starMult + (s.regions || 0) * regionMult + resourcePairs * resourceMult
      + (s.coins || 0) + (s.building_bonus || 0);
    return {
      total,
      badges: {},
      panel: {
        title: 'Beliebtheit',
        label: `Stufe ${tier} · Beliebtheit ${popularity}`,
        tone: tier === 1 ? 'danger' : tier === 2 ? 'warning' : 'success',
        items: [
          { label: 'Sterne', value: `×${starMult}` },
          { label: 'Regionen', value: `×${regionMult}` },
          { label: 'Ressourcen-Paare', value: `×${resourceMult}` },
        ],
      },
    };
  },
  age_of_innovation(s) {
    const coins = s.aoi_leftover_coins || 0;
    const resourcePoints = Math.floor(coins / 5);
    const total = (s.aoi_during_game || 0) + (s.aoi_buildings || 0) + (s.aoi_banking || 0) + (s.aoi_law || 0)
      + (s.aoi_engineering || 0) + (s.aoi_medicine || 0) + resourcePoints;
    return { total, badges: { aoi_leftover_coins: sp(resourcePoints, `Gesamtgeld ${coins}`) } };
  },
  sattgruen(s) {
    const plants = s.sattgruen_plants || 0;
    const leaves = s.sattgruen_leaves || 0;
    const potStein = s.sattgruen_pot_stein || 0;
    const potHolz = s.sattgruen_pot_holz || 0;
    const potKeramik = s.sattgruen_pot_keramik || 0;
    const rooms = s.sattgruen_rooms || 0;
    const uniqueItems = s.sattgruen_items || 0;
    const plantDiversity = s.sattgruen_plant_diversity || 0;
    const roomDiversity = s.sattgruen_room_diversity || 0;
    const goals = s.sattgruen_goals || 0;

    const leavesPoints = Math.floor(leaves / 2);
    const potSteinPoints = potStein * 3;
    const potHolzPoints = potHolz * 2;
    const potKeramikPoints = potKeramik * 1;
    const itemSteps = [0, 1, 3, 6, 9, 12, 16, 20, 25];
    const itemPoints = itemSteps[Math.min(uniqueItems, itemSteps.length - 1)] || 0;
    const plantDivPoints = plantDiversity >= 1 ? 3 : 0;
    const roomDivPoints = roomDiversity >= 1 ? 3 : 0;

    const badges = {};
    if (leavesPoints > 0) badges.sattgruen_leaves = sp(leavesPoints);
    if (potSteinPoints > 0) badges.sattgruen_pot_stein = sp(potSteinPoints);
    if (potHolzPoints > 0) badges.sattgruen_pot_holz = sp(potHolzPoints);
    if (potKeramikPoints > 0) badges.sattgruen_pot_keramik = sp(potKeramikPoints);
    if (itemPoints > 0) badges.sattgruen_items = sp(itemPoints);
    if (plantDivPoints > 0) badges.sattgruen_plant_diversity = sp(plantDivPoints);
    if (roomDivPoints > 0) badges.sattgruen_room_diversity = sp(roomDivPoints);

    const total = plants + leavesPoints + potSteinPoints + potHolzPoints + potKeramikPoints + rooms
      + itemPoints + plantDivPoints + roomDivPoints + goals;
    return { total, badges };
  },
  arler_erde(s) {
    const clothing = s.clothing_building || 0;
    const equipment = s.equipment || 0;
    const travel = s.travel || 0;
    const crafting = s.crafting || 0;
    const goods = s.goods || 0;
    const home = s.home_board || 0;
    const moors = s.moors || 0;
    const sheep = s.animals_sheep || 0;
    const horse = s.animals_horse || 0;
    const cattle = s.animals_cattle || 0;
    const shortages = s.shortages || 0;
    const tea = s.tea || 0;
    const ships = s.ships || 0;
    const schlootzieher = s.schlootzieher || 0;

    // Uwe-Rosenberg-Tierwertung: wenigste Art = 2 SP/Tier, zweitwenigste = 1 SP/Tier, meiste = 0.
    const animals = [
      { id: 'animals_sheep', count: sheep },
      { id: 'animals_horse', count: horse },
      { id: 'animals_cattle', count: cattle },
    ].sort((a, b) => a.count - b.count);
    const mults = [2, 1, 0];
    const badges = {};
    let animalPoints = 0;
    animals.forEach((a, i) => {
      const pts = a.count * mults[i];
      animalPoints += pts;
      badges[a.id] = sp(pts, `da ×${mults[i]} Mult.`);
    });

    const total = clothing + equipment + travel + crafting + goods + home + moors + animalPoints
      + shortages + tea + ships + schlootzieher;
    return { total, badges };
  },
  underwater_cities(s) {
    const ingameVp = s.underwater_cities_ingame_vp || 0;
    const metropolis = s.underwater_cities_metropolis || 0;
    const net0 = s.underwater_cities_net_0 || 0;
    const net1 = s.underwater_cities_net_1 || 0;
    const net2 = s.underwater_cities_net_2 || 0;
    const net3 = s.underwater_cities_net_3 || 0;
    const cards = s.underwater_cities_cards || 0;
    const biomass = s.underwater_cities_biomass || 0;
    const kelp = s.underwater_cities_kelp || 0;
    const science = s.underwater_cities_science || 0;
    const steelplastic = s.underwater_cities_steelplastic || 0;
    const credits = s.underwater_cities_credits || 0;

    const net0Points = net0 * 2;
    const net1Points = net1 * 3;
    const net2Points = net2 * 4;
    const net3Points = net3 * 6;
    const biomassCredits = biomass * 2;
    const totalResources = credits + biomassCredits + kelp + science + steelplastic;
    const resourcePoints = Math.floor(totalResources / 4);

    const badges = {};
    if (net0Points > 0) badges.underwater_cities_net_0 = sp(net0Points);
    if (net1Points > 0) badges.underwater_cities_net_1 = sp(net1Points);
    if (net2Points > 0) badges.underwater_cities_net_2 = sp(net2Points);
    if (net3Points > 0) badges.underwater_cities_net_3 = sp(net3Points);
    if (biomassCredits > 0) badges.underwater_cities_biomass = sp(biomassCredits, 'Credits');
    if (resourcePoints > 0) badges.underwater_cities_credits = sp(resourcePoints, `von ${totalResources} Ges.Ress.`);

    const total = ingameVp + metropolis + net0Points + net1Points + net2Points + net3Points + cards + resourcePoints;
    return { total, badges };
  },
  next_station_london(s) {
    const score = (d, st, t) => (d * st) + (t * 2);
    const r1 = score(s.london_r1_districts || 0, s.london_r1_stations || 0, s.london_r1_thames || 0);
    const r2 = score(s.london_r2_districts || 0, s.london_r2_stations || 0, s.london_r2_thames || 0);
    const r3 = score(s.london_r3_districts || 0, s.london_r3_stations || 0, s.london_r3_thames || 0);
    const r4 = score(s.london_r4_districts || 0, s.london_r4_stations || 0, s.london_r4_thames || 0);
    const tourist = s.london_tourist_attractions || 0;
    const interchanges = (s.london_interchanges_2 || 0) * 2 + (s.london_interchanges_3 || 0) * 5 + (s.london_interchanges_4 || 0) * 9;
    const goalsScore = (s.london_goals_achieved || 0) * 10;
    return { total: r1 + r2 + r3 + r4 + tourist + interchanges + goalsScore, badges: {} };
  },
};
