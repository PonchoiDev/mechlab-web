import { describe, expect, it } from 'vitest';
import type { Zone } from '../../types/mech';
import { createStockBuild } from './build';
import { findYamlMech, getYamlItem } from './data';
import { getYamlBuildIssues } from './readouts';
import { getDynamicFillers, getTotalFreeGeneralSlots } from './stats';

// Ranuras por ubicación como las deja YAML al cargar, criterios CA26 a CA28 de docs/specs/mechlab-yaml.md. Las
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
      expect(getYamlBuildIssues(mech, createStockBuild(mech)), id).toEqual([]);
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
