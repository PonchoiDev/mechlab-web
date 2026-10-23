import { describe, expect, it } from 'vitest';
import { getStockBuild } from './buildCode';
import { getBuildSummary, truncateTo } from './calculators';
import { allItems, allMechs, getMech } from '../test/fixtures';

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
