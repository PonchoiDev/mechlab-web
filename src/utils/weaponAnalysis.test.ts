import { describe, expect, it } from 'vitest';
import { getStockBuild } from './buildCode';
import { getBuildSummary, getHeatTimes, getRangeProfile, getRangeStep, getWeaponRangeState, getWeaponStats } from './calculators';
import { getWeaponLabel } from './items';
import { getUpgrades } from './upgrades';
import { allItems, allMechs, getItem, getMech, makeLoadout } from '../test/fixtures';

// Criterios de aceptación de docs/specs/analisis-armas.md (issue #122).
const stockSummary = (id: string) => {
  const mech = getMech(id);
  const stock = getStockBuild(mech, allMechs, allItems)!;
  return getBuildSummary(mech, stock.loadout, stock.armor);
};

describe('tiempos de calor', () => {
  it('CA1: el DRG-1G-S llega al máximo en 20.8 s y se enfría en 28.2 s', () => {
    const summary = stockSummary('DRG-1G-S');
    expect(summary.heatCapacity).toBe(62);
    expect(summary.coolingRate).toBe(2.2);
    expect(summary.timeToMaxHeat).toBeCloseTo(62 / (summary.heatPerSecond - 2.2), 5);
    expect(Number((summary.timeToMaxHeat as number).toFixed(1))).toBe(20.8);
    expect(Number(summary.timeToCoolDown!.toFixed(1))).toBe(28.2);
  });

  it('CA2: si la refrigeración iguala o supera al calor disparando, no llega nunca', () => {
    expect(getHeatTimes({ heatCapacity: 50, heatPerSecond: 2, coolingRate: 2 }).timeToMaxHeat).toBe('never');
    expect(getHeatTimes({ heatCapacity: 50, heatPerSecond: 1, coolingRate: 2 }).timeToMaxHeat).toBe('never');
    expect(getHeatTimes({ heatCapacity: null, heatPerSecond: 3, coolingRate: 2 })).toEqual({ timeToMaxHeat: null, timeToCoolDown: null });
    expect(getHeatTimes({ heatCapacity: 50, heatPerSecond: 3, coolingRate: null })).toEqual({ timeToMaxHeat: null, timeToCoolDown: null });
  });
});

describe('tonelaje junto al nombre', () => {
  it('CA3: «Autocannon/5 (8t)»', () => {
    expect(getWeaponLabel(getItem('Autocannon5'))).toBe('AC/5 (8t)');
    expect(getWeaponLabel(getItem('MediumLaser'))).toBe('M Laser (1t)');
  });
});

describe('daño potencial de la munición', () => {
  it('CA4: la munición del HGN-732 de serie', () => {
    const summary = stockSummary('HGN-732');
    const gauss = summary.ammunition.find(group => group.label === 'Gauss')!;
    expect(gauss.potentialDamage).toBe(78 * 15);
    const lrm = summary.ammunition.find(group => group.label === 'LRM')!;
    const lrmVolley = summary.weapons.filter(weapon => weapon.item.ammoType === lrm.ammoType).reduce((sum, weapon) => sum + weapon.damage, 0);
    expect(lrm.potentialDamage).toBeCloseTo(lrm.volleys! * lrmVolley, 5);
  });

  it('CA5: una munición que no usa ninguna arma no tiene daño potencial', () => {
    const summary = getBuildSummary(getMech('DRG-1G-S'), makeLoadout({ leftTorso: [getItem('AC20_Standard_AmmoEquipment')] }), stockArmor());
    expect(summary.ammunition[0].potentialDamage).toBeNull();
  });

  it('CA12: cada bala de ametralladora hace el daño por segundo durante un disparo', () => {
    const loadout = makeLoadout({ rightArm: [getItem('MachineGun')], rightTorso: [getItem('MachineGun_Standard_AmmoEquipment')] });
    const [ammo] = getBuildSummary(getMech('DRG-1G-S'), loadout, stockArmor()).ammunition;
    expect(ammo.seconds).toBe(520);
    expect(ammo.potentialDamage).toBeCloseTo(780, 5);
  });
});

describe('pico de calor con mejoras', () => {
  it('CA13: Reduced Heat Spikes baja el pico de calor del DRG-1G-S', () => {
    const mech = getMech('DRG-1G-S');
    const stock = getStockBuild(mech, allMechs, allItems)!;
    const base = getBuildSummary(mech, stock.loadout, stock.armor);
    const upgraded = getBuildSummary(mech, stock.loadout, stock.armor, getUpgrades(['ReducedHeatGeneration_Trait1']));
    expect(upgraded.heatSpike).toBeLessThan(base.heatSpike);
  });
});

describe('daño por tonelada', () => {
  it('CA6: con el tonelaje del arma, sin la munición', () => {
    const perTon = (id: string) => {
      const item = getItem(id);
      return Number((getWeaponStats(item).damage / item.tonnage).toFixed(2));
    };
    expect([perTon('MediumLaser'), perTon('Autocannon20'), perTon('LRM20')]).toEqual([5, 1.43, 2.4]);
    const summary = getBuildSummary(getMech('DRG-1G-S'), makeLoadout({ rightArm: [getItem('MediumLaser'), getItem('Autocannon20')] }), stockArmor());
    expect(summary.weapons.map(weapon => Number(weapon.damagePerTon!.toFixed(2)))).toEqual([5, 1.43]);
    // El total: el daño por salva de todas las armas a distancia entre su tonelaje.
    expect(summary.damagePerTon).toBeCloseTo(25 / 15, 5);
  });

  it('CA7: el daño por tonelada y el daño potencial usan el daño con las mejoras de la cantina', () => {
    const loadout = makeLoadout({ rightArm: [getItem('Autocannon20')], leftLeg: [getItem('AC20_Standard_AmmoEquipment')] });
    const base = getBuildSummary(getMech('DRG-1G-S'), loadout, stockArmor());
    const upgraded = getBuildSummary(getMech('DRG-1G-S'), loadout, stockArmor(), getUpgrades(['IncreasedBallisticDamage_Trait1']));
    expect(upgraded.weapons[0].damage).toBeGreaterThan(base.weapons[0].damage);
    expect(upgraded.weapons[0].damagePerTon).toBeCloseTo(upgraded.weapons[0].damage / 14, 5);
    expect(upgraded.ammunition[0].potentialDamage).toBeCloseTo(upgraded.ammunition[0].volleys! * upgraded.weapons[0].damage, 5);
  });
});

describe('daño por alcance', () => {
  it('CA8: el HGN-732 de serie, con la caída de daño entre el alcance óptimo y el máximo', () => {
    const profile = getRangeProfile(stockSummary('HGN-732').weapons);
    expect(profile.map(entry => entry.distance)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
    const at = (distance: number) => profile.find(entry => entry.distance === distance)!.damage;
    expect(at(100)).toBeCloseTo(63.4, 2);
    expect(at(300)).toBeCloseTo(24 + 15 + 2 * 5 * 105 / 135, 2);
    expect(at(900)).toBeCloseTo(24, 2);
    expect(profile.every(entry => entry.belowMin === 0)).toBe(true);
  });

  it('CA9: los anillos se espacian para que el alcance máximo quepa en 10 o menos', () => {
    expect(getRangeStep(405)).toBe(50);
    expect(getRangeStep(1500)).toBe(150);
    expect(getRangeStep(5625)).toBe(750);
  });
});

describe('armas de cada anillo del radar', () => {
  it('CA11: el HGN-732 a 400 m', () => {
    const states = stockSummary('HGN-732').weapons.map(weapon => [weapon.item.id, getWeaponRangeState(weapon, 400)]);
    expect(states).toEqual(expect.arrayContaining([
      ['LRM20', 'full'],
      ['GaussRifle', 'full'],
      ['MediumLaser', 'falloff'],
      ['SRM6', 'out']
    ]));
    expect(states.filter(([id]) => id === 'MediumLaser').every(([, state]) => state === 'falloff')).toBe(true);
  });
});

function stockArmor() {
  const mech = getMech('DRG-1G-S');
  return getStockBuild(mech, allMechs, allItems)!.armor;
}
