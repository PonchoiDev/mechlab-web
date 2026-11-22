import { describe, expect, it } from 'vitest';
import { getStockBuild } from './buildCode';
import { getBuildSummary, getWeaponStats, truncateTo } from './calculators';
import { getMechSpecs, hasActiveProbe } from './mechs';
import { allItems, allMechs, getItem, getMech } from '../test/fixtures';
import { createEmptyArmor, createEmptyLoadout } from './zones';

// Cifras del mechlab del juego con el loadout por defecto de cada mech (capturas del 23 de octubre
// de 2026). Si un cambio de datos o de cálculo las rompe, la web deja de coincidir con el juego.
// La refrigeración del CRD-2R, el ASN-26 y los Banshee se volvió a tomar el 16 de noviembre con el juego
// sin mods: las de octubre llevaban el mod QOL Upgrades 2, que dobla los disipadores del motor.
// La potencia de fuego del juego incluye el cuerpo a cuerpo, que la web muestra aparte.
const GAME_REFERENCE = [
  { id: 'WHM-6D', tons: 69.93, armor: 446, firepower: 56, cooling: 2, speed: 64.8, range: 920 },
  { id: 'CRD-2R', tons: 65, armor: 384, firepower: 108.2, cooling: 1, speed: 64.8, range: 900 },
  { id: 'ASN-26', tons: 40, armor: 208, firepower: 40.6, cooling: 1, speed: 113.4, range: 600 },
  { id: 'HGN-732', tons: 89.98, armor: 555, firepower: 100.9, cooling: 1.2, speed: 48.6, range: 900 },
  { id: 'ARC-2R', tons: 70, armor: 416, firepower: 118, cooling: 1, speed: 64.8, range: 900 },
  { id: 'BNC-SR', tons: 95, armor: 480, firepower: 102.6, cooling: 1.8, speed: 64.8, range: 1500 },
  { id: 'BNC-LM', tons: 95, armor: 560, firepower: 109, cooling: 2.2, speed: 64.8, range: 920 },
  { id: 'HBR-A', tons: 64.84, armor: 256, firepower: 106.6, cooling: 2.6, speed: 81, range: 1518 }
];

describe('cifras del juego', () => {
  it.each(GAME_REFERENCE)('$id coincide con el mechlab del juego', ({ id, ...expected }) => {
    const mech = getMech(id);
    const stock = getStockBuild(mech, allMechs, allItems)!;
    const summary = getBuildSummary(mech, stock.loadout, stock.armor);

    expect({
      tons: truncateTo(summary.totalWeight, 2),
      armor: summary.armorPoints,
      firepower: Math.round((summary.firepower + summary.meleeDamage) * 10) / 10,
      cooling: summary.coolingRate,
      speed: summary.topSpeed,
      range: Math.floor(summary.maxWeaponRange)
    }).toEqual(expected);
  });
});

// Refrigeración del juego con el 'Mech vacío (Strip 'Mech), capturas del 16 de noviembre de 2026 con el
// juego sin mods. Los disipadores del motor enfrían como simples aunque el 'Mech sea de dobles: el juego
// usa el BaseCoolingRate del MDA, con dos decimales. Las capturas del 29 de octubre daban más (el FS9-X1,
// 1,8) porque el mod QOL Upgrades 2 dobla la refrigeración del motor.
const EMPTY_MECH_COOLING = [
  { id: 'MAL-1R', cooling: 1 },
  { id: 'FS9-X1', cooling: 0.84 }
];

describe('refrigeración del juego sin equipo', () => {
  it.each(EMPTY_MECH_COOLING)('$id refrigera $cooling vacío', ({ id, cooling }) => {
    const mech = getMech(id);
    const summary = getBuildSummary(mech, createEmptyLoadout(), createEmptyArmor());

    expect(summary.coolingRate).toBe(cooling);
  });
});

// Fichas de armas por tier en el mechlab del juego (capturas del 16 de noviembre de 2026). Damage_Quirk
// y Cooldown_Quirk suman (el Gauss Rifle de tier 2 hace 15.05, no 15.75); los …Percentage_Quirk
// multiplican, como la Gran espada de asalto (Greatsword), que ya coincidía.
const WEAPON_TIERS: { id: string; tier: string; damage: number; cooldown?: number }[] = [
  { id: 'GaussRifle', tier: '2', damage: 15.05, cooldown: 5.85 },
  { id: 'Katana_Assault', tier: '1', damage: 55, cooldown: 2.55 },
  { id: 'Katana_Assault', tier: '3', damage: 60, cooldown: 2.3 },
  // De la lista del inventario, que no enseña el enfriamiento.
  { id: 'Katana_Assault', tier: '4', damage: 62.5 },
  { id: 'Katana_Assault', tier: '5', damage: 67.5, cooldown: 1.925 },
  { id: 'Claymore_Assault', tier: '1', damage: 70, cooldown: 3.05 },
  { id: 'Claymore_Assault', tier: '3', damage: 75, cooldown: 2.8 },
  { id: 'Greatsword_Assault', tier: '1', damage: 85, cooldown: 4 },
  { id: 'Greatsword_Assault', tier: '2', damage: 90.95, cooldown: 3.8 },
  { id: 'Greatsword_Assault', tier: '4', damage: 103.7, cooldown: 3.4 },
  { id: 'Knuckles_Assault', tier: '1', damage: 30, cooldown: 3.05 },
  { id: 'ArenaFist_Assault', tier: '1', damage: 50, cooldown: 1.75 }
];

describe('armas por tier del juego', () => {
  it.each(WEAPON_TIERS)('$id en tier $tier', ({ id, tier, damage, cooldown }) => {
    const stats = getWeaponStats(getItem(id, { tier }));
    expect(stats.damage).toBeCloseTo(damage, 2);
    // La cadencia del juego sale del enfriamiento; los datos la guardan con un decimal.
    if (cooldown !== undefined) expect(stats.rpm).toBeCloseTo(60 / cooldown, 1);
  });
});

// Ficha del AC/2 RF (Autocannon2_Auto) en el inventario del juego, capturas del 21 de noviembre de 2026. El daño
// y el calor son de la ráfaga (dos disparos de 1.35 y 0.15 en Lost Tech) y la cadencia sale solo del enfriamiento,
// sin la pausa entre los disparos de la ráfaga: 60 / 0.1125 = 533.333. Con el enfriamiento redondeado a tres
// decimales (0.112) la web daba 535.7.
const AC2_RF_CARDS = [
  { tier: '4', damage: 2.44, rpm: 470.588, heat: 0.34, maxRange: 828, speed: 1610 },
  { tier: '5', damage: 2.7, rpm: 533.333, heat: 0.3, maxRange: 900, speed: 1750 }
];

describe('ficha del AC/2 RF del juego', () => {
  it.each(AC2_RF_CARDS)('tier $tier', ({ tier, damage, rpm, heat, maxRange, speed }) => {
    const stats = getWeaponStats(getItem('Autocannon2_Auto', { tier }));
    expect(stats.damage).toBeCloseTo(damage, 2);
    expect(stats.rpm).toBeCloseTo(rpm, 1);
    expect(stats.heat).toBeCloseTo(heat, 2);
    expect(stats.maxRange).toBe(maxRange);
    expect(stats.speed).toBe(speed);
  });
});

// Línea de especificaciones del mechlab del juego con la build de serie. AP sale si la build lleva una sonda
// montada, sin importar la ranura: el HBR-A la lleva (una Clan Active Probe en una ranura normal) y sale con AP
// (captura del 23 de octubre de 2026); el ZEU-SA3 lleva la Black Market Probe en su ranura de sonda y sale
// «320 XL DHS ENDO ECM AP»; el EXE-PRIME no lleva sonda y sale «380 C-XL DHS C-ENDO C-FERRO MOTIVE JJ» sin AP,
// aunque sus datos de importación (MechImportData) traen bBeagleActiveProbe=True (capturas del 22 de noviembre
// de 2026, sin mods). La web no enseña ECM, MOTIVE ni JJ en esta línea. El filtro Active probe mira la ranura.
const SPEC_LINES = [
  { id: 'HBR-A', specs: ['325', 'C-XL', 'DHS', 'C-ENDO', 'C-FERRO', 'AP'], probeSlot: false },
  { id: 'EXE-PRIME', specs: ['380', 'C-XL', 'DHS', 'C-ENDO', 'C-FERRO'], probeSlot: false },
  { id: 'ZEU-SA3', specs: ['320', 'XL', 'DHS', 'ENDO', 'AP'], probeSlot: true }
];

describe('línea de especificaciones del juego', () => {
  it.each(SPEC_LINES)('$id', ({ id, specs, probeSlot }) => {
    const mech = getMech(id);
    const stock = getStockBuild(mech, allMechs, allItems)!;
    expect(getMechSpecs(mech, Object.values(stock.loadout).flat()).map(spec => spec.label)).toEqual(specs);
    expect(hasActiveProbe(mech)).toBe(probeSlot);
  });
});
