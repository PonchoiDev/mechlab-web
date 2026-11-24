import { describe, expect, it } from 'vitest';
import type { YamlBuild } from '../../types/yaml-mechlab';
import { createStockBuild, mountItem, mountWeapon, removeWeapon, setInternal, stripBuild } from './build';
import { findYamlMech, getYamlItem } from './data';
import {
  getArmorPoints, getBuildTonnage, getDynamicFillers, getHeat, getStructurePoints, getTopSpeed
} from './stats';

// Cifras de capturas del mechlab del juego con YAML 0.99.4.3 y sus mods de apoyo (Nightstar NSR-9J, 95 t),
// como gameReference.test.ts del MechLab de MW5: si el MechLab y el juego no coinciden, manda el juego.
// Criterios CA1 a CA14 de docs/specs/mechlab-yaml.md.
const nightstar = findYamlMech('NSR-9J')!;
const stock = createStockBuild(nightstar);

// El juego calcula en float32 y enseña dos decimales: se compara a dos decimales.
const twoDecimals = (value: number) => Number(value.toFixed(2));
const heatOf = (mech: Parameters<typeof getHeat>[0], current: YamlBuild) => {
  const { cooling, capacity } = getHeat(mech, current);
  return { cooling: twoDecimals(cooling), capacity: twoDecimals(capacity) };
};

function build(result: { build?: YamlBuild; error?: string }): YamlBuild {
  expect(result.error).toBeUndefined();
  return result.build!;
}

function withoutWeapon(current: YamlBuild, zone: string, item: string): YamlBuild {
  const weapon = current.weapons.find(mounted => mounted.zone === zone && mounted.item === item)!;
  return removeWeapon(current, weapon.hardpoint);
}

// El 'Mech vacío de las capturas: «Strip 'Mech», con la armadura de serie y sin núcleo de motor.
function emptyWithoutCore(): YamlBuild {
  return setInternal(setInternal(stripBuild(stock), 'Engine', null), 'enginecooling', 'SHS_KIT_FIXED');
}

describe('referencia del juego: Nightstar NSR-9J con YAML', () => {
  it('CA1: la build de serie pesa 95 de 95 t, va a 48,6 km/h y lleva núcleo 285 con motor XL', () => {
    expect(getBuildTonnage(nightstar, stock)).toBe(95);
    expect(twoDecimals(getTopSpeed(nightstar, stock))).toBe(48.6);
    expect(getArmorPoints(nightstar, stock)).toEqual({ installed: 592, bonus: 7 });
    expect(getStructurePoints(nightstar, stock).total).toBe(304);
    expect(stock.internal.Engine).toBe('std285');
    expect(stock.internal.EngineTypeSlot).toBe('ENGINE_XL');
    expect(getYamlItem('ENGINE_XL')!.fillerSlots).toEqual({ leftTorso: 3, rightTorso: 3 });
  });

  it('CA2: sin sus tres láseres, como el «Default loadout» del juego, pesa 90,5 t', () => {
    let current = withoutWeapon(stock, 'head', 'SmallLaser');
    current = withoutWeapon(current, 'leftArm', 'MediumPulseLaser');
    current = withoutWeapon(current, 'rightArm', 'MediumPulseLaser');
    expect(getBuildTonnage(nightstar, current)).toBe(90.5);
  });

  it('CA3: ranuras generales y actuadores de cada ubicación', () => {
    const general = Object.fromEntries(Object.entries(nightstar.zones).map(([zone, data]) => [zone, data.general]));
    expect(general).toEqual({
      head: 1, centerTorso: 2, leftTorso: 12, rightTorso: 12, leftArm: 8, rightArm: 8, leftLeg: 2, rightLeg: 2
    });
    expect(nightstar.zones.rightArm.actuators).toHaveLength(4);
    expect(nightstar.zones.leftLeg.actuators).toHaveLength(4);
  });

  it('CA4: tamaño y peso de las armas del inventario', () => {
    const weapons = Object.fromEntries([
      'Autocannon10', 'Autocannon2', 'Autocannon20', 'Autocannon5_Burst', 'MachineGun', 'GaussRifle',
      'LightGaussRifle', 'LBXAutocannon2', 'LBXAutocannon20', 'ERPPC'
    ].map(id => [id, [getYamlItem(id)!.slots, getYamlItem(id)!.tons]]));
    expect(weapons).toEqual({
      Autocannon10: [7, 12], Autocannon2: [1, 6], Autocannon20: [10, 14], Autocannon5_Burst: [4, 8],
      MachineGun: [1, 0.5], GaussRifle: [7, 15], LightGaussRifle: [5, 12], LBXAutocannon2: [3, 6],
      LBXAutocannon20: [11, 14], ERPPC: [3, 7]
    });
  });

  it('CA5: cambiar las dos Gauss por dos AC/2 deja 77 t', () => {
    let current = withoutWeapon(withoutWeapon(stock, 'leftArm', 'GaussRifle'), 'rightArm', 'GaussRifle');
    current = build(mountWeapon(nightstar, current, 'leftArm', 'Autocannon2'));
    current = build(mountWeapon(nightstar, current, 'rightArm', 'Autocannon2'));
    expect(getBuildTonnage(nightstar, current)).toBe(77);
  });

  it('CA6: sin las Gauss ni el láser del brazo derecho, con un AC/10 y un AC/2, pesa 81 t', () => {
    let current = withoutWeapon(withoutWeapon(stock, 'leftArm', 'GaussRifle'), 'rightArm', 'GaussRifle');
    current = withoutWeapon(current, 'rightArm', 'MediumPulseLaser');
    current = build(mountWeapon(nightstar, current, 'rightArm', 'Autocannon10'));
    current = build(mountWeapon(nightstar, current, 'leftArm', 'Autocannon2'));
    expect(getBuildTonnage(nightstar, current)).toBe(81);
  });

  it('CA7: con armadura Primitive pesa 104,16 t', () => {
    expect(getBuildTonnage(nightstar, setInternal(stock, 'Armorslot', 'ARMOR_PRIMITIVE'))).toBe(104.16);
  });

  it('CA8: con estructura reforzada pesa 100 t y tiene 603 puntos de estructura', () => {
    const reinforced = setInternal(stock, 'Structureslot', 'RSTRUCT');
    expect(getBuildTonnage(nightstar, reinforced)).toBe(100);
    expect(getStructurePoints(nightstar, reinforced).total).toBe(603);
  });

  it('CA9: vacío, sin núcleo y con Heavy Ferro pesa 27,42 t con 21 rellenos dinámicos', () => {
    const heavyFerro = setInternal(setInternal(emptyWithoutCore(), 'Armorslot', 'HEAVY_FERRO'), 'EngineTypeSlot', 'ENGINE_FIXED');
    expect(getBuildTonnage(nightstar, heavyFerro)).toBe(27.42);
    expect(getDynamicFillers(heavyFerro)).toBe(21);
  });

  it('CA10: vacío, sin núcleo, con Endo y armadura estándar pesa 26,5 t con 14 rellenos dinámicos', () => {
    const endo = setInternal(setInternal(emptyWithoutCore(), 'Structureslot', 'ENDO'), 'EngineTypeSlot', 'ENGINE_FIXED');
    expect(getBuildTonnage(nightstar, endo)).toBe(26.5);
    expect(getDynamicFillers(endo)).toBe(14);
  });

  it('CA11: vacío con motor XL, giroscopio estándar y sin núcleo pesa 31 t, con 0 de refrigeración y 30 de capacidad', () => {
    const empty = emptyWithoutCore();
    expect(getBuildTonnage(nightstar, empty)).toBe(31);
    expect(heatOf(nightstar, empty)).toEqual({ cooling: 0, capacity: 30 });
  });

  it('CA12: con el núcleo 285 pesa 42,5 t; con el giroscopio Agility, igual; con el XL, 41 t', () => {
    const core285 = setInternal(emptyWithoutCore(), 'Engine', 'std285');
    expect(getBuildTonnage(nightstar, core285)).toBe(42.5);
    expect(twoDecimals(getTopSpeed(nightstar, core285))).toBe(48.6);
    expect(heatOf(nightstar, core285)).toEqual({ cooling: 1, capacity: 40 });
    expect(getBuildTonnage(nightstar, setInternal(core285, 'Gyro', 'GYRO2'))).toBe(42.5);
    expect(getBuildTonnage(nightstar, setInternal(core285, 'Gyro', 'GYRO_XL'))).toBe(41);
  });

  it('CA13: con el núcleo 105 pesa 29 t, o 28 con el giroscopio XL, y el motor XL ahorra 1,5 t', () => {
    const core105 = setInternal(emptyWithoutCore(), 'Engine', 'std105');
    expect(getBuildTonnage(nightstar, core105)).toBe(29);
    expect(getBuildTonnage(nightstar, setInternal(core105, 'Gyro', 'GYRO_XL'))).toBe(28);
    expect(twoDecimals(getTopSpeed(nightstar, core105))).toBe(17.91);
    expect(heatOf(nightstar, core105)).toEqual({ cooling: 0.4, capacity: 34 });
    expect(getBuildTonnage(nightstar, setInternal(core105, 'EngineTypeSlot', 'ENGINE_FIXED'))).toBe(30.5);
  });

  it('CA14: los kits de disipadores dobles con el núcleo 285', () => {
    const core285 = setInternal(emptyWithoutCore(), 'Engine', 'std285');
    const doubleKit = setInternal(core285, 'enginecooling', 'Cooling_diss100');
    expect(getBuildTonnage(nightstar, doubleKit)).toBe(42.5);
    expect(heatOf(nightstar, doubleKit)).toEqual({ cooling: 2, capacity: 50 });
    const royal = setInternal(core285, 'enginecooling', 'ROYAL_DHS_KIT');
    expect(heatOf(nightstar, royal)).toEqual({ cooling: 2.2, capacity: 50 });
    const withHeatSink = build(mountItem(nightstar, royal, 'rightTorso', 'DoubleHeatSink'));
    expect(getBuildTonnage(nightstar, withHeatSink)).toBe(43.5);
    expect(heatOf(nightstar, withHeatSink).capacity).toBe(52);
  });

  it('la build de serie con los disipadores de sus torsos: 3 de refrigeración y 58 de capacidad con el Royal DHS Kit', () => {
    const royal = setInternal(stock, 'enginecooling', 'ROYAL_DHS_KIT');
    expect(heatOf(nightstar, royal)).toEqual({ cooling: 3, capacity: 58 });
    expect(heatOf(nightstar, setInternal(stock, 'enginecooling', 'SHS_KIT_FIXED'))).toEqual({ cooling: 1.8, capacity: 48 });
  });
});
