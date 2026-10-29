import { describe, expect, it } from 'vitest';
import { getStockBuild } from './buildCode';
import { getBuildSummary, truncateTo } from './calculators';
import { allItems, allMechs, getMech } from '../test/fixtures';
import { createEmptyArmor, createEmptyLoadout } from './zones';

// Cifras del mechlab del juego con el loadout por defecto de cada mech (capturas del 23 de octubre
// de 2026). Si un cambio de datos o de cálculo las rompe, la web deja de coincidir con el juego.
// La potencia de fuego del juego incluye el cuerpo a cuerpo, que la web muestra aparte.
const GAME_REFERENCE = [
  { id: 'WHM-6D', tons: 69.93, armor: 446, firepower: 56, cooling: 2, speed: 64.8, range: 920 },
  { id: 'CRD-2R', tons: 65, armor: 384, firepower: 108.2, cooling: 2, speed: 64.8, range: 900 },
  { id: 'ASN-26', tons: 40, armor: 208, firepower: 40.6, cooling: 2, speed: 113.4, range: 600 },
  { id: 'HGN-732', tons: 89.98, armor: 555, firepower: 100.9, cooling: 1.2, speed: 48.6, range: 900 },
  { id: 'ARC-2R', tons: 70, armor: 416, firepower: 118, cooling: 1, speed: 64.8, range: 900 },
  { id: 'BNC-SR', tons: 95, armor: 480, firepower: 102.6, cooling: 2.8, speed: 64.8, range: 1500 },
  { id: 'BNC-LM', tons: 95, armor: 560, firepower: 109, cooling: 3.2, speed: 64.8, range: 920 },
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

// Refrigeración del juego con el 'Mech vacío (Strip 'Mech), capturas del 29 de octubre de 2026, ya
// con el parche. Con dobles, el motor manda: el JVN-11A y el BJ-3 (motor 180) dan 1,4 con bases
// distintas, el CTF-3L y el KGC-A (base 2,0) no pasan de 2,0, el FS9-X1 (motor 245) se queda en 1,8,
// el FLE-RCX (motor 120) se queda en su base y el ADR-A, de Clan, sube de 1,4 a 1,6.
const EMPTY_MECH_COOLING = [
  { id: 'JVN-11A', cooling: 1.4 },
  { id: 'BJ-3', cooling: 1.4 },
  { id: 'CTF-3L', cooling: 2 },
  { id: 'KGC-A', cooling: 2 },
  { id: 'FS9-X1', cooling: 1.8 },
  { id: 'FLE-RCX', cooling: 1 },
  { id: 'ADR-A', cooling: 1.6 }
];

describe('refrigeración del juego sin equipo', () => {
  it.each(EMPTY_MECH_COOLING)('$id refrigera $cooling vacío', ({ id, cooling }) => {
    const mech = getMech(id);
    const summary = getBuildSummary(mech, createEmptyLoadout(), createEmptyArmor());

    expect(summary.coolingRate).toBe(cooling);
  });
});
