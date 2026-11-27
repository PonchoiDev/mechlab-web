import { describe, expect, it } from 'vitest';
import type { Zone } from '../../types/mech';
import { createStockBuild, mountItem, mountWeapon, removeWeapon, setInternal } from './build';
import { getYamlStatsPanel } from './combat';
import { distributeDynamicFillerGroups } from './board';
import { findYamlMech, getYamlItem } from './data';
import { getBuildIssues } from './board';
import { getBuildTonnage, getCritSplitFillers, getDynamicFillers, getFixedFillers, getFreeGeneralSlots, getGeneralSlots, getTotalFreeGeneralSlots } from './stats';

// Ranuras por ubicación como las deja YAML al cargar, criterios CA26 a CA39 de docs/specs/mechlab-yaml.md. Las
// ranuras libres salen de contar las filas vacías de las capturas del mechlab del juego.
const generalSlots = (id: string) => {
  const zones = findYamlMech(id)!.zones;
  return Object.fromEntries((Object.keys(zones) as Zone[]).map(zone => [zone, zones[zone].general]));
};
const freeAfterFillers = (id: string) => {
  const mech = findYamlMech(id)!;
  const build = createStockBuild(mech);
  return getTotalFreeGeneralSlots(mech, build) - getDynamicFillers(build);
};

describe('Ranuras por ubicación', () => {
  it('CA26: los MDA de YAML siguen con las ranuras del juego de mesa', () => {
    const tabletop = { head: 1, centerTorso: 2, leftTorso: 12, rightTorso: 12, leftArm: 8, rightArm: 8, leftLeg: 2, rightLeg: 2 };
    expect(generalSlots('NSR-9J')).toEqual(tabletop);
    expect(generalSlots('GHR-5J')).toEqual(tabletop);
  });

  it('CA27: los MDA del juego base suben al mínimo de YAML, como en las capturas', () => {
    expect(generalSlots('WHM-DNC')).toMatchObject({ leftTorso: 12, rightTorso: 12, leftArm: 9, rightArm: 9 });
    expect(generalSlots('KFX-C')).toMatchObject({ leftTorso: 12, rightTorso: 12, leftArm: 8, rightArm: 8 });
    expect(generalSlots('INC-A')).toMatchObject({ leftTorso: 12, rightTorso: 12, leftArm: 8, rightArm: 8 });
    expect(freeAfterFillers('WHM-DNC')).toBe(8);
    expect(freeAfterFillers('KFX-C')).toBe(8);
    expect(freeAfterFillers('INC-A')).toBe(22);
    for (const id of ['WHM-DNC', 'KFX-C', 'INC-A']) {
      const mech = findYamlMech(id)!;
      expect(errors(mech, createStockBuild(mech)), id).toEqual([]);
    }
  });
});

describe('Equipo de ranuras ocultas', () => {
  it('CA28: el ECM, la sonda, el MASC y los retrorreactores van en las ranuras generales', () => {
    for (const id of ['GuardianECM', 'ClanECM', 'BeagleActiveProbe', 'MASC_MKIII', 'JumpJet_Class3_Equipment']) {
      expect(getYamlItem(id)!.slotTypes, id).toEqual(['General_SlotType']);
    }
    const kitFox = createStockBuild(findYamlMech('KFX-C')!);
    const ecm = kitFox.items.find(mounted => getYamlItem(mounted.item)?.category?.startsWith('Equipment.ECM'));
    expect(ecm).toMatchObject({ zone: 'rightArm', slotType: 'General_SlotType' });
  });
});

describe('Piezas propias y armas cuerpo a cuerpo', () => {
  it('CA29: el giroscopio y el tipo de motor ocupan sus Slots en el torso central', () => {
    const nightstar = findYamlMech('NSR-9J')!;
    const stock = createStockBuild(nightstar);
    const centerTorso = (build: ReturnType<typeof createStockBuild>) => getGeneralSlots(nightstar, build, 'centerTorso');
    expect(centerTorso(stock)).toBe(2);
    expect(centerTorso(setInternal(stock, 'Gyro', 'GYRO_COMPACT'))).toBe(4);
    expect(centerTorso(setInternal(stock, 'Gyro', 'GYRO_XL'))).toBe(0);
    const light = setInternal(stock, 'EngineTypeSlot', 'ENGINE_LIGHT');
    expect(centerTorso(light)).toBe(2);
    expect(getFixedFillers(light, 'leftTorso')).toBe(2);
    expect(getFixedFillers(light, 'rightTorso')).toBe(2);
  });

  it('CA34: la Claymore del CP-10-P ocupa 5 de las 8 ranuras de su brazo y deja 3 libres, como en el juego', () => {
    const cyclops = findYamlMech('CP-10-P')!;
    expect(getYamlItem('Claymore_Assault')!.slots).toBe(5);
    expect(getGeneralSlots(cyclops, createStockBuild(cyclops), 'leftArm')).toBe(8);
    expect(getFreeGeneralSlots(cyclops, createStockBuild(cyclops), 'leftArm')).toBe(3);
  });

  it('CA30: un arma cuerpo a cuerpo ocupa el tamaño de su ranura menos 1', () => {
    expect(getYamlItem('Lance_Medium')!.slots).toBe(2);
    expect(getYamlItem('ArenaFist_Assault')!.slots).toBe(0);
    expect(freeAfterFillers('HBK-VEST')).toBe(0);
    expect(freeAfterFillers('CRD-5M')).toBe(10);
    const hunchback = findYamlMech('HBK-VEST')!;
    expect(errors(hunchback, createStockBuild(hunchback))).toEqual([]);
  });
});

describe('Armas repartidas', () => {
  it('CA31: las armas de más de 7 ranuras llevan el resto a la ubicación contigua, como en las capturas', () => {
    const sunder = findYamlMech('SD1-O')!;
    expect(getCritSplitFillers(sunder, createStockBuild(sunder))).toEqual([
      { zone: 'leftTorso', from: 'leftArm', item: 'Autocannon20', slots: 1 }
    ]);
    const naga = findYamlMech('NGA-PRIME')!;
    expect(getCritSplitFillers(naga, createStockBuild(naga)).map(({ zone, from, slots }) => ({ zone, from, slots }))).toEqual([
      { zone: 'leftTorso', from: 'leftArm', slots: 2 },
      { zone: 'rightTorso', from: 'rightArm', slots: 2 }
    ]);
    for (const mech of [sunder, naga]) expect(errors(mech, createStockBuild(mech)), mech.id).toEqual([]);
  });

  it('CA32: sin sitio en ninguna ubicación contigua, el arma no se puede montar', () => {
    const nightstar = findYamlMech('NSR-9J')!;
    const stock = createStockBuild(nightstar);
    // Sin la Gauss quedan 7 ranuras en el brazo derecho y el torso derecho de serie está lleno.
    const gauss = stock.weapons.find(weapon => weapon.zone === 'rightArm' && weapon.item === 'GaussRifle')!;
    const result = mountWeapon(nightstar, removeWeapon(stock, gauss.hardpoint), 'rightArm', 'Autocannon20');
    expect(result.error).toMatch(/adjacent/i);
  });
});

describe('Equipo de serie sin ranura', () => {
  it('CA33: el retrorreactor del torso central del JR7-IIC-FY no llega al mechlab, como en la captura', () => {
    const jenner = findYamlMech('JR7-IIC-FY')!;
    const stock = createStockBuild(jenner);
    expect(stock.items.filter(mounted => getYamlItem(mounted.item)?.jumpJet)).toHaveLength(6);
    expect(getBuildTonnage(jenner, stock)).toBe(34.43);
    expect(errors(jenner, stock)).toEqual([]);
  });
});

describe('Rellenos dinámicos', () => {
  // Por ubicación, cuántos rellenos pide cada ranura de pieza (Armorslot: Ferro, Structureslot: Endo).
  const fillers = (id: string, build = createStockBuild(findYamlMech(id)!)) => {
    const groups = distributeDynamicFillerGroups(findYamlMech(id)!, build);
    return Object.fromEntries(Object.entries(groups).filter(([, list]) => list.length > 0)
      .map(([zone, list]) => [zone, Object.fromEntries(list.map(group => [group.slotType, group.slots]))]));
  };

  it('CA35: sin rellenos en el loadout, uno por ubicación en cada vuelta, como en las capturas', () => {
    expect(fillers('WHM-DNC')).toEqual({
      centerTorso: { Armorslot: 2 }, leftTorso: { Armorslot: 2 }, rightTorso: { Armorslot: 3 }, leftLeg: { Armorslot: 1 },
      rightLeg: { Armorslot: 1 }, leftArm: { Armorslot: 2 }, rightArm: { Armorslot: 2 }, head: { Armorslot: 1 }
    });
    expect(fillers('INC-A')).toEqual({
      centerTorso: { Armorslot: 2 }, leftTorso: { Armorslot: 2 }, rightTorso: { Armorslot: 2 },
      leftLeg: { Armorslot: 1, Structureslot: 1 }, rightLeg: { Structureslot: 2 }, leftArm: { Structureslot: 2 },
      rightArm: { Structureslot: 1 }, head: { Structureslot: 1 }
    });
  });

  it('CA36: la build de serie de un loadout con rellenos los tiene donde los trae, como en las capturas', () => {
    expect(fillers('HBK-VEST')).toEqual({
      leftTorso: { Structureslot: 2 }, rightTorso: { Structureslot: 1 }, centerTorso: { Structureslot: 2 },
      leftArm: { Structureslot: 2 }, rightArm: { Structureslot: 7 }
    });
    expect(fillers('KFX-C')).toEqual({
      leftTorso: { Structureslot: 3 }, rightArm: { Structureslot: 2 }, rightTorso: { Structureslot: 2 },
      leftLeg: { Armorslot: 2 }, rightLeg: { Armorslot: 2 }, leftArm: { Armorslot: 2 }, head: { Armorslot: 1 }
    });
  });

  it('CA42: los rellenos del motor del loadout no son equipo: el PXH-7S, como en la captura', () => {
    const phoenixHawk = findYamlMech('PXH-7S')!;
    const stock = createStockBuild(phoenixHawk);
    expect(stock.items.some(mounted => /filler$/i.test(mounted.item))).toBe(false);
    expect(getFixedFillers(stock, 'leftTorso')).toBe(2);
    expect(getFixedFillers(stock, 'rightTorso')).toBe(2);
    expect(fillers('PXH-7S')).toEqual({
      leftTorso: { Structureslot: 8 }, rightTorso: { Structureslot: 6, Armorslot: 2 },
      leftArm: { Armorslot: 6 }, rightArm: { Armorslot: 6 }
    });
    expect(errors(phoenixHawk, stock)).toEqual([]);
    expect(getBuildTonnage(phoenixHawk, stock)).toBe(44.87);
    const panel = Object.fromEntries(getYamlStatsPanel(phoenixHawk, stock).flat().map(cell => [cell.key, cell.value]));
    expect(panel).toMatchObject({ armor: '318', structure: '159', alphaDamage: '35', speed: '97.2', jumpHeight: '82' });
  });

  it('CA43: al cargar, los rellenos que no caben se quedan fuera sin avisar, como en las capturas', () => {
    expect(fillers('CN9-CALM')).toEqual({
      head: { Armorslot: 2 }, leftTorso: { Structureslot: 3 }, rightTorso: { Structureslot: 3 },
      leftArm: { Structureslot: 4, Armorslot: 4 }, rightArm: { Armorslot: 4 }, leftLeg: { Structureslot: 2 }, rightLeg: { Structureslot: 2 }
    });
    expect(fillers('WHM-IIC-3')).toEqual({
      leftTorso: { Structureslot: 4 }, rightTorso: { Structureslot: 1 }, leftArm: { Armorslot: 4 }, rightArm: { Armorslot: 3, Structureslot: 1 }
    });
    for (const id of ['CN9-CALM', 'WHM-IIC-3']) {
      const mech = findYamlMech(id)!;
      expect(errors(mech, createStockBuild(mech)), id).toEqual([]);
    }
    const centurion = findYamlMech('CN9-CALM')!;
    expect(mountItem(centurion, createStockBuild(centurion), 'leftLeg', 'SingleHeatSink').error).toBeDefined();
  });

  it('CA37: con cualquier cambio, los rellenos se vuelven a poner uno por ubicación en cada vuelta', () => {
    const hunchback = findYamlMech('HBK-VEST')!;
    const stock = createStockBuild(hunchback);
    const headLaser = stock.weapons.find(weapon => weapon.zone === 'head')!;
    const changed = fillers('HBK-VEST', removeWeapon(stock, headLaser.hardpoint));
    const total = Object.values(changed).reduce((sum, slots) => sum + (slots.Structureslot ?? 0), 0);
    expect(total).toBe(14);
    expect(changed.rightArm.Structureslot).toBeLessThan(7);
    expect(changed.head).toEqual({ Structureslot: 1 });
  });
});

describe('Equipo de actuadores', () => {
  it('CA38: el Compact Actuators Hand deja 3 ranuras más en el brazo y ocupa el hombro', () => {
    const nightstar = findYamlMech('NSR-9J')!;
    const stock = createStockBuild(nightstar);
    expect(getGeneralSlots(nightstar, stock, 'leftArm')).toBe(8);
    const compact = mountItem(nightstar, stock, 'leftArm', 'COMPACT_ACTUATOR_HAND_QS').build!;
    expect(getGeneralSlots(nightstar, compact, 'leftArm')).toBe(11);
    expect(getFreeGeneralSlots(nightstar, compact, 'leftArm')).toBe(getFreeGeneralSlots(nightstar, stock, 'leftArm') + 3);
    expect(mountItem(nightstar, compact, 'leftArm', 'SHOULDER_ARMORED').error).toBeDefined();
    expect(mountItem(nightstar, stock, 'leftArm', 'SHOULDER_ARMORED').build).toBeDefined();
  });

  it('CA39: sin actuador de mano no cabe el Compact Actuators Hand; los Improved Actuators no cambian las ranuras', () => {
    const warhammer = findYamlMech('WHM-DNC')!;
    const stock = createStockBuild(warhammer);
    expect(mountItem(warhammer, stock, 'leftArm', 'COMPACT_ACTUATOR_HAND_QS').error).toBeDefined();
    const improved = mountItem(warhammer, stock, 'leftArm', 'IMPROVED_ACTUATORS').build!;
    expect(getGeneralSlots(warhammer, improved, 'leftArm')).toBe(getGeneralSlots(warhammer, stock, 'leftArm'));
  });
});

// Las builds de serie no tienen errores; los avisos (armadura por debajo del máximo...) son normales.
function errors(...args: Parameters<typeof getBuildIssues>) {
  return getBuildIssues(...args).filter(issue => issue.severity === 'error');
}
