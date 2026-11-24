import { describe, expect, it } from 'vitest';
import type { YamlBuild } from '../../types/yaml-mechlab';
import { createStockBuild, mountItem, mountWeapon, removeWeapon, setInternal, setWeaponTier, stripBuild } from './build';
import { decodeYamlBuild, encodeYamlBuild } from './buildCode';
import {
  getWeaponBonuses, getWeaponPerformance, getWeaponTiers, getWeaponTierStats, getYamlDamageAt, getYamlRangeProfile,
  getYamlStatsPanel
} from './combat';
import { findYamlMech, getYamlItem } from './data';
import { getYamlInventoryItems } from './inventory';
import { getBuildTonnage, getHeat } from './stats';

// Estadísticas del MechLab de YAML (docs/specs/estadisticas-yaml.md). La build de referencia es la de la
// captura del mechlab del juego: el NSR-9J de serie con sus seis armas en nivel 3 y el Royal DHS Kit.
const nightstar = findYamlMech('NSR-9J')!;
const stock = createStockBuild(nightstar);
const reference = stock.weapons
  .filter(weapon => !getYamlItem(weapon.item)?.actuator)
  .reduce((current, weapon) => setWeaponTier(current, weapon.hardpoint, 3), setInternal(stock, 'enginecooling', 'ROYAL_DHS_KIT'));

function panelValues(build: YamlBuild): Record<string, string> {
  return Object.fromEntries(getYamlStatsPanel(nightstar, build).flat().map(cell => [cell.label, cell.value]));
}

function weapon(build: YamlBuild, item: string) {
  return getWeaponPerformance(nightstar, build).find(performance => performance.item === item)!;
}

describe('estadísticas del MechLab de YAML', () => {
  it('CA1: el panel de la build de referencia da las cifras del juego', () => {
    expect(panelValues(reference)).toEqual({
      'Armor': '599', 'Structure': '304', 'Melee dmg avg': '0',
      'Alpha damage': '62.1', 'Damage/s': '16.47', 'Melee dmg/s avg': '0',
      'Weapon heat/s': '4.02', 'Cooling heat/s': '3', 'Turn rate °/s': '53.9',
      'Alpha heat': '13.99', 'Heat capacity': '58', 'Torso twist °/s': '67.5',
      'Jump height (m)': '0', 'Speed (km/h)': '48.6', 'Torso yaw °': '95',
      'Weapon range (m)': '2,395', 'Sensor range (m)': '950', 'Arm yaw °': '30',
      'AMS intercept/s': '0', 'AMS range (m)': '0', 'Ammo': '182'
    });
  });

  it('CA2: el panel tiene las 21 cifras del juego en su orden, 7 filas de 3', () => {
    const rows = getYamlStatsPanel(nightstar, reference).map(row => row.map(cell => cell.label));
    expect(rows).toEqual([
      ['Armor', 'Structure', 'Melee dmg avg'],
      ['Alpha damage', 'Damage/s', 'Melee dmg/s avg'],
      ['Weapon heat/s', 'Cooling heat/s', 'Turn rate °/s'],
      ['Alpha heat', 'Heat capacity', 'Torso twist °/s'],
      ['Jump height (m)', 'Speed (km/h)', 'Torso yaw °'],
      ['Weapon range (m)', 'Sensor range (m)', 'Arm yaw °'],
      ['AMS intercept/s', 'AMS range (m)', 'Ammo']
    ]);
    for (const cell of getYamlStatsPanel(nightstar, reference).flat()) {
      expect(cell.ratio).toBeGreaterThanOrEqual(0);
      expect(cell.ratio).toBeLessThanOrEqual(1);
    }
  });

  it('CA3: las cifras de cada nivel salen del asset con los quirks del nivel', () => {
    // Los datos guardan el error de los float32 del juego (2,024999997): se comparan a cuatro decimales.
    const tierStats = (id: string, tier?: number) =>
      Object.fromEntries(Object.entries(getWeaponTierStats(id, tier)!).map(([key, value]) => [key, Number(value.toFixed(4))]));
    expect(tierStats('GaussRifle', 3)).toMatchObject({ damage: 17.1, heat: 0.9, cooldown: 5.7, optimalRange: 726 });
    expect(tierStats('ERPPC', 3)).toMatchObject({ damage: 11.4, heat: 9.9, cooldown: 4.75, optimalRange: 825 });
    expect(tierStats('MediumPulseLaser', 3)).toMatchObject({ damage: 6.6, heat: 2.34, cooldown: 3.0875, duration: 0.585, optimalRange: 242 });
    expect(tierStats('GaussRifle', 1)).toMatchObject({ damage: 15, heat: 1, cooldown: 6, optimalRange: 660 });
    expect(getWeaponTierStats('GaussRifle')).toEqual(getWeaponTierStats('GaussRifle', 1));
  });

  it('CA4: las bonificaciones de los quirks y del equipo se suman', () => {
    const bonuses = getWeaponBonuses(nightstar, reference, 'rightArm', 'GaussRifle');
    expect(bonuses.cooldown).toBeCloseTo(0.8);
    expect(bonuses.heat).toBeCloseTo(0.82);
    expect(bonuses.optimalRange).toBeCloseTo(1.1);
    expect(bonuses.maxRange).toBeCloseTo(1.1);
    expect(bonuses.damage).toBeCloseTo(1);
  });

  it('CA5: daño por segundo y alcance de cada arma con las reglas de YAW', () => {
    const gauss = weapon(reference, 'GaussRifle');
    expect(gauss.dps).toBeCloseTo(3.75);
    expect(gauss.maxRange).toBeCloseTo(2395.8);
    const ppc = weapon(reference, 'ERPPC');
    expect(ppc.dps).toBeCloseTo(3);
    expect(ppc.maxRange).toBeCloseTo(1815);
    const pulse = weapon(reference, 'MediumPulseLaser');
    expect(pulse.duration).toBeCloseTo(0.4095);
    expect(pulse.dps).toBeCloseTo(2.292, 3);
    expect(pulse.maxRange).toBeCloseTo(532.4);
  });

  it('CA6: un arma de un mod sale una vez en el inventario, con sus niveles', () => {
    const catalog = getYamlInventoryItems();
    expect(catalog.filter(({ id }) => id.startsWith('CEERPPC79'))).toHaveLength(1);
    expect(getYamlItem('CEERPPC79_Lvl3')).toBeUndefined();
    expect(getWeaponTiers('CEERPPC79')).toEqual(['1', '2', '3', '4', '5']);
  });

  it('CA7: el nivel se guarda al montar el arma y en el código de la build', () => {
    const gauss = stock.weapons.find(mounted => mounted.zone === 'rightArm' && mounted.item === 'GaussRifle')!;
    const withoutGauss = removeWeapon(stock, gauss.hardpoint);
    const tier1 = mountWeapon(nightstar, withoutGauss, 'rightArm', 'GaussRifle').build!;
    const tier3 = mountWeapon(nightstar, withoutGauss, 'rightArm', 'GaussRifle', undefined, 3).build!;
    expect(tier3.weapons.find(mounted => mounted.item === 'GaussRifle' && mounted.zone === 'rightArm')?.tier).toBe(3);
    expect(decodeYamlBuild(encodeYamlBuild(nightstar.id, tier3))?.build).toEqual(tier3);
    expect(panelValues(tier3)['Alpha damage']).not.toBe(panelValues(tier1)['Alpha damage']);
  });

  it('CA8: daño por alcance, todo hasta el óptimo y en línea recta hasta 0 en el máximo', () => {
    const weapons = getWeaponPerformance(nightstar, reference);
    // A 500 m: las Gauss y el ER PPC enteros, los Medium Pulse Laser bajando y el Small Laser fuera.
    const pulseFraction = 1 - (500 - 266.2) / (532.4 - 266.2);
    expect(getYamlDamageAt(weapons, 500)).toBeCloseTo(17.1 * 2 + 11.4 + 6.6 * 2 * pulseFraction, 2);
    expect(getYamlDamageAt(weapons, 2400)).toBe(0);
    const profile = getYamlRangeProfile(weapons);
    // Diez anillos de 250 m, como el radar del MechLab de MW5.
    expect(profile.map(entry => entry.distance)).toEqual([250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500]);
    for (const entry of profile) expect(entry.damage).toBeCloseTo(getYamlDamageAt(weapons, entry.distance));
  });

  it('CA9: las filas del análisis suman las cifras del panel', () => {
    const ranged = getWeaponPerformance(nightstar, reference).filter(performance => performance.family !== 'melee');
    const sum = (key: 'damage' | 'dps' | 'heat') => ranged.reduce((total, performance) => total + performance[key], 0);
    expect(sum('damage')).toBeCloseTo(62.1);
    expect(sum('dps')).toBeCloseTo(16.47, 2);
    expect(sum('heat')).toBeCloseTo(13.99, 2);
  });

  it('CA10: el GHR-5J con misiles, AMS, motor estándar y retrorreactores da las cifras del juego', () => {
    const grasshopper = findYamlMech('GHR-5J')!;
    const ghrStock = createStockBuild(grasshopper);
    const ghr = ghrStock.weapons
      .filter(mounted => !getYamlItem(mounted.item)?.actuator)
      .reduce((current, mounted) => setWeaponTier(current, mounted.hardpoint, 3), ghrStock);
    const values = Object.fromEntries(getYamlStatsPanel(grasshopper, ghr).flat().map(cell => [cell.label, cell.value]));
    expect(values).toEqual({
      'Armor': '416', 'Structure': '223', 'Melee dmg avg': '0',
      'Alpha damage': '27.28', 'Damage/s': '7.03', 'Melee dmg/s avg': '0',
      'Weapon heat/s': '3.27', 'Cooling heat/s': '2.2', 'Turn rate °/s': '85.9',
      'Alpha heat': '15.12', 'Heat capacity': '52', 'Torso twist °/s': '108',
      'Jump height (m)': '66', 'Speed (km/h)': '64.8', 'Torso yaw °': '120',
      'Weapon range (m)': '1,485', 'Sensor range (m)': '800', 'Arm yaw °': '30',
      'AMS intercept/s': '4.03', 'AMS range (m)': '220', 'Ammo': '5,640'
    });
  });

  it('CA11: el CP-10-P con gran espada y nudilleras da las cifras de cuerpo a cuerpo del juego', () => {
    const cyclops = findYamlMech('CP-10-P')!;
    const cpStock = createStockBuild(cyclops);
    // La gran espada va en el anclaje de la claymore. Se pone sin mountWeapon: la web aún no da al brazo las
    // ranuras que le añade YAML (docs/specs/estadisticas-yaml.md, pendiente).
    const withSword: YamlBuild = {
      ...cpStock,
      weapons: cpStock.weapons.map(mounted => mounted.item === 'Claymore_Assault' ? { ...mounted, item: 'Greatsword_Assault', tier: 1 } : mounted)
    };
    const withKnuckles = mountWeapon(cyclops, withSword, 'rightArm', 'Knuckles_Assault', undefined, 2).build!;
    const values = (build: YamlBuild) => Object.fromEntries(getYamlStatsPanel(cyclops, build).flat().map(cell => [cell.label, cell.value]));
    const ranged = {
      'Alpha damage': '36.6', 'Damage/s': '10.16', 'Weapon heat/s': '3.14', 'Cooling heat/s': '1', 'Turn rate °/s': '71.6',
      'Alpha heat': '11.55', 'Heat capacity': '40', 'Torso twist °/s': '90', 'Jump height (m)': '0', 'Speed (km/h)': '64.8',
      'Torso yaw °': '80', 'Weapon range (m)': '900', 'Sensor range (m)': '900', 'Arm yaw °': '20',
      'AMS intercept/s': '0', 'AMS range (m)': '0', 'Ammo': '880'
    };
    expect(values(withKnuckles)).toEqual({ ...ranged, 'Armor': '376', 'Structure': '325', 'Melee dmg avg': '64.62', 'Melee dmg/s avg': '12.82' });
    expect(values(withSword)).toEqual({ ...ranged, 'Armor': '366', 'Structure': '317', 'Melee dmg avg': '93.5', 'Melee dmg/s avg': '17.48' });
  });

  it('CA12: el JVN-11A con siete Medium Laser de nivel 3 redondea el calor alfa como el juego', () => {
    const javelin = findYamlMech('JVN-11A')!;
    const jvnStock = createStockBuild(javelin);
    const jvn = jvnStock.weapons
      .filter(mounted => !getYamlItem(mounted.item)?.actuator)
      .reduce((current, mounted) => setWeaponTier(current, mounted.hardpoint, 3), jvnStock);
    const values = Object.fromEntries(getYamlStatsPanel(javelin, jvn).flat().map(cell => [cell.label, cell.value]));
    expect(values).toEqual({
      'Armor': '179', 'Structure': '111', 'Melee dmg avg': '0',
      'Alpha damage': '38.5', 'Damage/s': '8.19', 'Melee dmg/s avg': '0',
      // 7 × 2,0249999 en float32: 14,1749999, por debajo del empate.
      'Weapon heat/s': '3.02', 'Cooling heat/s': '2', 'Turn rate °/s': '126.8',
      'Alpha heat': '14.17', 'Heat capacity': '50', 'Torso twist °/s': '150.7',
      'Jump height (m)': '82', 'Speed (km/h)': '97.2', 'Torso yaw °': '110',
      'Weapon range (m)': '594', 'Sensor range (m)': '800', 'Arm yaw °': '35',
      'AMS intercept/s': '0', 'AMS range (m)': '0', 'Ammo': '0'
    });
  });

  it('CA13: la altura de salto, con la fórmula del juego y los datos de cada retrorreactor', () => {
    const grasshopper = findYamlMech('GHR-5J')!;
    const ghrStock = createStockBuild(grasshopper);
    const jumpJet = (index: number) => getYamlItem(ghrStock.items[index].item)?.slotTypes?.some(slotType => /jumpjet/i.test(slotType));
    // Uno menos en cada pierna.
    const removed = new Set(['leftLeg', 'rightLeg'].map(zone => ghrStock.items.findIndex((mounted, index) => mounted.zone === zone && jumpJet(index))));
    const twoJets = { ...ghrStock, items: ghrStock.items.filter((_, index) => !removed.has(index)) };
    const jump = (build: YamlBuild) => getYamlStatsPanel(grasshopper, build).flat().find(cell => cell.key === 'jumpHeight')!.value;
    expect(jump(twoJets)).toBe('50');
    expect(jump(ghrStock)).toBe('66');
    expect(jump({ ...ghrStock, items: ghrStock.items.filter((_, index) => !jumpJet(index)) })).toBe('0');
    // Los mejorados de YAEC (850 cm/s y 5 s): 850 × 5 + ½ × 840 × 5² = 14.750 cm.
    const improved = { ...ghrStock, items: ghrStock.items.map((mounted, index) => jumpJet(index) ? { ...mounted, item: 'ImprovedJumpJet_Class3_Equipment' } : mounted) };
    expect(jump(improved)).toBe('147');
  });

  it('CA14: la velocidad aplica el topSpeedMulti de los quirks (Clan, +6,7 %)', () => {
    const adder = findYamlMech('ADR-A')!;
    expect(getYamlStatsPanel(adder, createStockBuild(adder)).flat().find(cell => cell.key === 'speed')!.value).toBe('103.71');
  });

  it('CA15: el peso se iguala al máximo si falta menos de un punto de armadura, como el JVN-11A del juego (30/30)', () => {
    const javelin = findYamlMech('JVN-11A')!;
    expect(getBuildTonnage(javelin, createStockBuild(javelin))).toBe(30);
  });

  it('CA16: el daño mostrado suma la explosión (Heavy Gauss, 25 + 5,5)', () => {
    expect(getWeaponTierStats('HeavyGaussRifle', 1)!.damage).toBe(30.5);
  });

  it('CA17: el equipo con relativeWeight pesa una parte del tonelaje, a cuartos de tonelada', () => {
    const withShoulder: YamlBuild = { ...stock, items: [...stock.items, { zone: 'rightArm', slotType: 'Shoulder_SlotType', item: 'SHOULDER_ARMORED' }] };
    // 0,01 × 95 = 0,95, redondeado a 1.
    expect(getBuildTonnage(nightstar, withShoulder) - getBuildTonnage(nightstar, stock)).toBeCloseTo(1);
  });

  it('CA18: el computador de puntería multiplica la base de sensores antes de los bonus de los quirks', () => {
    const withComputer = mountItem(nightstar, stripBuild(stock), 'leftTorso', 'TargetingComputer_Mk3').build!;
    // (800 × 1,14) + 50 + 100.
    expect(panelValues(withComputer)['Sensor range (m)']).toBe('1,062');
  });

  it('CA19: coolingMulti de una ubicación multiplica la refrigeración de sus disipadores', () => {
    const lines = mountItem(nightstar, stripBuild(stock), 'rightTorso', 'COOLING_LINES').build!;
    const before = getHeat(nightstar, lines).cooling;
    const withHeatSink = mountItem(nightstar, lines, 'rightTorso', 'DoubleHeatSink').build!;
    expect(getHeat(nightstar, withHeatSink).cooling - before).toBeCloseTo(0.2 * 1.4);
  });
});
