import { describe, expect, it } from 'vitest';
import { decodeBuild, encodeBuild, getStockBuild } from './buildCode';
import {
  calculateHeatCapacity,
  createDefaultArmor,
  formatArmorPoints,
  formatCoolingRate,
  formatTurnRate,
  getArmorScale,
  getBuildSummary,
  scaleArmorPoints,
  unscaleArmorPoints
} from './calculators';
import { canInstallUpgrade, getUpgradeModifiers, getUpgrades, sanitizeUpgrades } from './upgrades';
import { mapZones } from './zones';
import { allItems, allMechs, getMech } from '../test/fixtures';

const dragon = getMech('DRG-1G-S');
const stock = getStockBuild(dragon, allMechs, allItems)!;

// La build de las capturas del juego: la de fábrica con 4 Medium Pulse Laser de tier 5 (el Large
// Laser cambiado por otro), un SRM 4 de tier 4 y otro de tier 5, y la armadura al máximo.
const mediumPulseLaser = allItems.find(item => item.id === 'MediumPulseLaser')!;
let srmCount = 0;
const capturedLoadout = mapZones(zone => stock.loadout[zone].map(item => {
  if (item.id === 'LargeLaser') return { ...item, ...mediumPulseLaser, tier: '5' };
  if (item.id === 'MediumPulseLaser') return { ...item, tier: '5' };
  if (item.id === 'SRM4') return { ...item, tier: srmCount++ === 0 ? '4' : '5' };
  return item;
}));
const capturedArmor = createDefaultArmor(dragon.components);
const summaryWith = (ids: string[]) => getBuildSummary(dragon, capturedLoadout, capturedArmor, getUpgrades(ids));

// Capturas del juego con el Grand Dragon DRG-1G-S. El juego suma el cuerpo a cuerpo (2 Heavy Lower
// Arm de 10) al daño total: 76,6 = 56,6 a distancia + 20 cuerpo a cuerpo.
describe('mejoras de la cantina en el juego', () => {
  it('8 ranuras de mejora', () => {
    expect(dragon.upgradeSlots).toBe(8);
  });

  it('Enhanced Energy Output I: Medium Pulse Laser 7,8 -> 8,19 y daño total 76,6 -> 78,2', () => {
    const base = summaryWith([]);
    const upgraded = summaryWith(['IncreasedEnergyDamage_Trait1']);
    expect(base.firepower + base.meleeDamage).toBeCloseTo(76.6, 1);
    expect(upgraded.weapons.find(weapon => weapon.item.id === 'MediumPulseLaser')?.damage).toBeCloseTo(8.19, 2);
    expect(upgraded.firepower + upgraded.meleeDamage).toBeCloseTo(78.2, 1);
  });

  it('Enhanced Energy Output I y II se suman: 7,8 -> 8,97 y daño total 81,3', () => {
    const upgraded = summaryWith(['IncreasedEnergyDamage_Trait1', 'IncreasedEnergyDamage_Trait2']);
    expect(upgraded.weapons.find(weapon => weapon.item.id === 'MediumPulseLaser')?.damage).toBeCloseTo(8.97, 2);
    expect(upgraded.firepower + upgraded.meleeDamage).toBeCloseTo(81.3, 1);
  });

  it('Refined Armor I: 414/414 -> 424/424,35 sin cambiar el peso', () => {
    const base = summaryWith([]);
    const upgraded = summaryWith(['IncreasedArmor_Trait1']);
    expect(base.armorPoints).toBe(414);
    expect(Math.floor(upgraded.armorPoints)).toBe(424);
    expect(upgraded.maxArmorPoints).toBeCloseTo(424.35, 2);
    expect(upgraded.totalWeight).toBe(base.totalWeight);
  });
});

// Captura del juego con un Battlemaster BLR-1P con 528 de armadura: cada lado de cada componente se
// multiplica y se trunca, y el total de arriba no se trunca.
describe('Refined Armor por componente en el juego', () => {
  const scale = getArmorScale(getUpgrades(['IncreasedArmor_Trait1']));

  it('lados y máximos: 56 -> 57, 16 -> 16, 86 -> 88, 22 -> 22, 67 -> 68, 30 -> 30, 72 -> 73, 108 -> 110', () => {
    expect([56, 16, 86, 22, 67, 30, 72, 108].map(points => scaleArmorPoints(points, scale))).toEqual([57, 16, 88, 22, 68, 30, 73, 110]);
  });

  it('un valor escrito con la mejora se guarda como el punto base más bajo que lo alcanza', () => {
    expect([57, 88, 30, 68].map(shown => unscaleArmorPoints(shown, scale))).toEqual([56, 86, 30, 67]);
  });

  it('total: 528 -> 541,2', () => {
    expect(formatArmorPoints(528 * scale)).toBe('541.2');
    expect(formatArmorPoints(414 * scale)).toBe('424.35');
    expect(formatArmorPoints(528)).toBe('528');
  });
});

// Captura del juego con un Battlemaster BLR-1P de 2,1 heat/s: Faster Cooling sube la refrigeración total.
describe('Faster Cooling en el juego', () => {
  it('2,1 -> 2,21 heat/s', () => {
    const battlemaster = { ...getMech('BLR-1P'), BaseCoolingRate: 2.1, heatSinkType: 'single' as const };
    const empty = mapZones(() => []);
    const armor = createDefaultArmor(battlemaster.components);
    expect(getBuildSummary(battlemaster, empty, armor).coolingRate).toBe(2.1);
    const upgraded = getBuildSummary(battlemaster, empty, armor, getUpgrades(['IncreasedHeatCooling_Trait1']));
    expect(upgraded.coolingRate).toBe(2.21);
    expect(formatCoolingRate(upgraded.coolingRate!)).toBe('2.21');
    expect(formatCoolingRate(3)).toBe('3.0');
  });
});

// Resumen de la pantalla de mejoras del juego: DRG-1G-S y BLR-1P.
describe('resumen del mech en el juego', () => {
  const battlemaster = getMech('BLR-1P');
  const summaryOf = (mech: typeof dragon, ids: string[] = []) =>
    getBuildSummary(mech, mapZones(() => []), createDefaultArmor(mech.components), getUpgrades(ids));

  it('estructura total: 207 y 269', () => {
    expect(summaryOf(dragon).structurePoints).toBe(207);
    expect(summaryOf(battlemaster).structurePoints).toBe(269);
  });

  it('giro de pie y del torso: 108, 135, 84 y 64,7, 85,5, 53,4', () => {
    const turns = (mech: typeof dragon) => {
      const { turnSpeed, torsoYaw, torsoPitch } = summaryOf(mech);
      return [turnSpeed!, torsoYaw!, torsoPitch!].map(formatTurnRate);
    };
    expect(turns(dragon)).toEqual(['108', '135', '84']);
    expect(turns(battlemaster)).toEqual(['64.7', '85.5', '53.4']);
  });

  it('Anchor Turn I y II se suman: 108 -> 116 -> 132', () => {
    expect(formatTurnRate(summaryOf(dragon, ['IncreasedTurnSpeed_Trait1']).turnSpeed!)).toBe('116');
    expect(formatTurnRate(summaryOf(dragon, ['IncreasedTurnSpeed_Trait1', 'IncreasedTurnSpeed_Trait2']).turnSpeed!)).toBe('132');
  });

  it('capacidad de calor: la del chasis más 2 por disipador doble y 1 por simple (66 y 51)', () => {
    const sinks = (doubles: number, singles: number) => mapZones(zone => zone === 'centerTorso'
      ? [...Array(doubles).fill(allItems.find(item => item.id === 'DoubleHeatSink')!), ...Array(singles).fill(allItems.find(item => item.id === 'SingleHeatSink')!)]
      : []);
    expect(calculateHeatCapacity(dragon, sinks(6, 4))).toBe(66);
    expect(calculateHeatCapacity(battlemaster, sinks(3, 5))).toBe(51);
  });

  it('sensor y fijación de blanco: 800 m, 2 s y 1,35 s', () => {
    const { sensorRange, lockRetentionTime, loseLockTime } = summaryOf(dragon);
    expect([sensorRange, lockRetentionTime, loseLockTime]).toEqual([800, 2, 1.35]);
  });

  it('velocidad del SRM 4: 460 m/s en tier 4 y 500 en tier 5', () => {
    const srm = allItems.find(item => item.id === 'SRM4')!;
    expect([srm.tiers?.['4']?.speed, srm.tiers?.['5']?.speed]).toEqual([460, 500]);
  });
});

describe('reglas de instalación', () => {
  const [energyI, energyII] = getUpgrades(['IncreasedEnergyDamage_Trait1', 'IncreasedEnergyDamage_Trait2']);

  it('cada mejora una vez, pero la I y la II juntas', () => {
    expect(canInstallUpgrade(dragon, [energyI], energyI)).toBe(false);
    expect(canInstallUpgrade(dragon, [energyI], energyII)).toBe(true);
  });

  it('no pasan de las ranuras de mejora del mech', () => {
    const full = getUpgrades(['IncreasedArmor_Trait2', 'IncreasedStructure_Trait2', 'IncreasedBallisticDamage_Trait2', 'IncreasedMissileDamage_Trait1']);
    expect(full.reduce((total, upgrade) => total + upgrade.slots, 0)).toBe(7);
    expect(canInstallUpgrade(dragon, full, energyI)).toBe(true);
    expect(canInstallUpgrade(dragon, full, energyII)).toBe(false);
  });

  it('sanitizeUpgrades quita las repetidas, las que no existen y las que no caben', () => {
    expect(sanitizeUpgrades(dragon, ['IncreasedEnergyDamage_Trait1', 'IncreasedEnergyDamage_Trait1', 'NoExiste', 42]))
      .toEqual(['IncreasedEnergyDamage_Trait1']);
    expect(sanitizeUpgrades(dragon, 'no es una lista')).toEqual([]);
  });

  it('Damage Tuning cuenta para todos los tipos de arma, también el cuerpo a cuerpo', () => {
    const modifiers = getUpgradeModifiers(getUpgrades(['IncreasedWeaponDamage_Trait1', 'IncreasedEnergyDamage_Trait1']));
    expect(modifiers.weapon.damage).toEqual({ artillery: 0.05, ballistic: 0.05, energy: 0.1, melee: 0.05, missile: 0.05 });
  });
});

describe('mejoras en el enlace de la build', () => {
  it('se guardan y se recuperan', () => {
    const ids = ['IncreasedEnergyDamage_Trait1', 'IncreasedTopSpeed_Trait1'];
    const decoded = decodeBuild(encodeBuild(dragon, stock.loadout, stock.armor, allItems, ids), allMechs, allItems);
    expect(decoded?.upgrades).toEqual(ids);
  });

  it('sin mejoras el código no cambia, así que los enlaces de antes siguen igual', () => {
    expect(encodeBuild(dragon, stock.loadout, stock.armor, allItems, [])).toBe(encodeBuild(dragon, stock.loadout, stock.armor, allItems));
    expect(getStockBuild(dragon, allMechs, allItems)?.upgrades).toEqual([]);
  });
});
