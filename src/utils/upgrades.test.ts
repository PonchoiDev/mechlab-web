import { describe, expect, it } from 'vitest';
import { decodeBuild, encodeBuild, getStockBuild } from './buildCode';
import { createDefaultArmor, getBuildSummary } from './calculators';
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
    expect(modifiers.damage).toEqual({ artillery: 0.05, ballistic: 0.05, energy: 0.1, melee: 0.05, missile: 0.05 });
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
