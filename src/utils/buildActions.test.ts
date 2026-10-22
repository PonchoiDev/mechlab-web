import { describe, expect, it } from 'vitest';
import {
  addAmmoForWeapon,
  changeAllWeaponsTier,
  changeWeaponTier,
  countFreeHardpointsFor,
  describeReplaced,
  duplicateEquipment,
  duplicateWeaponTo,
  fillWeaponInZones,
  getAmmoOnlyUsedBy,
  getReplaceAllPreview,
  LEGS,
  MIRROR_ZONES,
  moveAllEquipment,
  moveEquipment,
  removeWeaponAndAmmo,
  replaceAllCompatible,
  replaceWeapon
} from './buildActions';
import { createEquippedItem, getHardpointViews } from './equipment';
import { createEmptyLoadout, ZONE_KEYS } from './zones';
import { allItems, getItem, getMech } from '../test/fixtures';
import type { EquippedItem, EquippedLoadout, Zone } from '../types/mech';

const archer = getMech('ARC-2R');
const weapon = (id: string, hardpointIndex: number, tier?: string) =>
  createEquippedItem(getItem(id, tier ? { tier } : {}), undefined, hardpointIndex);
const general = (id: string) => createEquippedItem(getItem(id), 'General_SlotType');
const build = (parts: Partial<EquippedLoadout>): EquippedLoadout => ({ ...createEmptyLoadout(), ...parts });
const idsIn = (loadout: EquippedLoadout, zone: Zone) => loadout[zone].map(item => item.id);
const weaponsIn = (loadout: EquippedLoadout, zone: Zone) =>
  getHardpointViews(archer.components[zone].hardpoints, loadout[zone]).map(view => view.weapon?.id ?? null);

describe('tiers', () => {
  it('sube y baja el tier de un arma', () => {
    const laser = weapon('MediumLaser', 0, '2');
    const loadout = build({ leftArm: [laser] });

    expect(changeWeaponTier(loadout, 'leftArm', laser.instanceId, 1).loadout.leftArm[0].tier).toBe('3');
    expect(changeWeaponTier(loadout, 'leftArm', laser.instanceId, -1).loadout.leftArm[0].tier).toBe('1');
  });

  it('no pasa de Lost Tech ni de tier 0', () => {
    const top = weapon('MediumLaser', 0, '5');
    const bottom = weapon('MediumLaser', 0, '0');

    expect(changeWeaponTier(build({ leftArm: [top] }), 'leftArm', top.instanceId, 1).message).toBe('No tier available');
    expect(changeWeaponTier(build({ leftArm: [bottom] }), 'leftArm', bottom.instanceId, -1).message).toBe('No tier available');
  });

  it('las armas Clan no cambian de tier', () => {
    const clan = weapon('C-ERMediumLaser', 0);
    expect(changeWeaponTier(build({ leftArm: [clan] }), 'leftArm', clan.instanceId, 1).message).toBe('No tier available');
  });

  it('cambia todas las armas iguales al tier siguiente del arma elegida', () => {
    const left = weapon('MediumLaser', 0, '2');
    const right = weapon('MediumLaser', 0, '4');
    const other = weapon('SmallLaser', 0, '1');
    const result = changeAllWeaponsTier(build({ leftArm: [left], rightArm: [right], centerTorso: [other] }), 'leftArm', left.instanceId, 1);

    expect(result.loadout.leftArm[0].tier).toBe('3');
    expect(result.loadout.rightArm[0].tier).toBe('3');
    expect(result.loadout.centerTorso[0].tier).toBe('1');
    expect(result.message).toBe('2× Medium Laser → Tier 3');
  });
});

describe('duplicar armas', () => {
  const laser = weapon('MediumLaser', 0, '3');

  it('duplica al componente simétrico manteniendo el tier', () => {
    const result = duplicateWeaponTo(archer, build({ leftArm: [laser] }), 'leftArm', laser.instanceId, MIRROR_ZONES.leftArm!);

    expect(weaponsIn(result.loadout, 'rightArm')).toEqual(['MediumLaser', null]);
    expect(result.loadout.rightArm[0].tier).toBe('3');
    expect(result.loadout.rightArm[0].instanceId).not.toBe(laser.instanceId);
  });

  it('rellena los anclajes libres de un componente', () => {
    const result = fillWeaponInZones(archer, build({ leftArm: [laser] }), 'leftArm', laser.instanceId, ['centerTorso']);

    expect(weaponsIn(result.loadout, 'centerTorso')).toEqual(['MediumLaser', 'MediumLaser']);
    expect(result.message).toBe('Added 2× Medium Laser: Center torso ×2');
  });

  it('rellena todos los anclajes libres compatibles del mech', () => {
    const loadout = build({ leftArm: [laser] });
    expect(countFreeHardpointsFor(archer, loadout, ZONE_KEYS, laser)).toBe(3);

    const result = fillWeaponInZones(archer, loadout, 'leftArm', laser.instanceId, ZONE_KEYS);
    expect(Object.values(result.loadout).flat().filter(item => item.id === 'MediumLaser')).toHaveLength(4);
    expect(countFreeHardpointsFor(archer, result.loadout, ZONE_KEYS, laser)).toBe(0);
  });

  it('no duplica si no hay anclaje compatible libre', () => {
    const lrm = weapon('LRM15', 0);
    const result = duplicateWeaponTo(archer, build({ leftTorso: [lrm] }), 'leftTorso', lrm.instanceId, 'leftArm');

    expect(result.loadout.leftArm).toEqual([]);
    expect(result.message).toBe('No free hardpoint for LRM 15 in Left arm');
  });

  it('sustituye las armas montadas en anclajes compatibles, salvo las que ya son iguales', () => {
    const small = weapon('SmallLaser', 0);
    const sameLaser = weapon('MediumLaser', 0, '3');
    const loadout = build({ leftArm: [laser], centerTorso: [small], rightArm: [sameLaser] });

    const preview = getReplaceAllPreview(archer, loadout, laser);
    expect(preview.added).toBe(2);
    expect(describeReplaced(preview.replaced)).toBe('1× Small Laser');

    const result = replaceAllCompatible(archer, loadout, 'leftArm', laser.instanceId);
    expect(weaponsIn(result.loadout, 'centerTorso')).toEqual(['MediumLaser', 'MediumLaser']);
    expect(result.loadout.rightArm).toEqual([sameLaser]);
    expect(result.message).toBe('Placed 2× Medium Laser, replacing 1 weapon');
  });
});

describe('quitar un arma con su munición', () => {
  it('quita la munición solo si ninguna otra arma la usa', () => {
    const left = weapon('LRM15', 0);
    const right = weapon('LRM15', 0);
    const ammo = general('LRM_AmmoEquipment');

    expect(getAmmoOnlyUsedBy(build({ leftTorso: [left], rightTorso: [right], leftLeg: [ammo] }), 'leftTorso', left.instanceId)).toEqual([]);

    const single = build({ leftTorso: [left], leftLeg: [ammo, general('LRM_AmmoEquipment')] });
    const result = removeWeaponAndAmmo(single, 'leftTorso', left.instanceId);
    expect(Object.values(result.loadout).flat()).toEqual([]);
    expect(result.message).toBe('Removed LRM 15 and 2 t of its ammo');
  });
});

describe('añadir munición', () => {
  const lrm = weapon('LRM15', 0);

  it('reparte la munición entre las dos piernas', () => {
    const result = addAmmoForWeapon(archer, build({ leftTorso: [lrm] }), allItems, lrm, 3, LEGS);

    expect(idsIn(result.loadout, 'leftLeg')).toEqual(['LRM_AmmoEquipment', 'LRM_AmmoEquipment']);
    expect(idsIn(result.loadout, 'rightLeg')).toEqual(['LRM_AmmoEquipment']);
    expect(result.message).toBe('Added 3 t of LRM Ammo: Left leg ×2, Right leg');
  });

  it('usa media tonelada cuando hace falta', () => {
    const result = addAmmoForWeapon(archer, build({ leftTorso: [lrm] }), allItems, lrm, 1.5, LEGS);

    expect([...idsIn(result.loadout, 'leftLeg'), ...idsIn(result.loadout, 'rightLeg')].sort())
      .toEqual(['LRM_AmmoEquipment', 'LRM_Half_AmmoEquipment']);
  });

  it('avisa de las toneladas que no caben', () => {
    const result = addAmmoForWeapon(archer, build({ leftTorso: [lrm] }), allItems, lrm, 5, LEGS);

    expect(result.loadout.leftLeg.length + result.loadout.rightLeg.length).toBe(4);
    expect(result.message).toBe('Added 4 t of LRM Ammo: Left leg ×2, Right leg ×2 · 1 t did not fit');
  });

  it('no cambia nada si no hay hueco', () => {
    const full = build({ leftTorso: [lrm], leftLeg: [general('LRM_AmmoEquipment'), general('LRM_AmmoEquipment')] });
    const result = addAmmoForWeapon(archer, full, allItems, lrm, 1, ['leftLeg']);

    expect(result.loadout).toBe(full);
    expect(result.message).toBe('No free slots for LRM Ammo — 1 t not assigned');
  });
});

describe('equipo', () => {
  it('mueve todos los contenedores iguales a las piernas', () => {
    const bins = [general('LRM_AmmoEquipment'), general('LRM_AmmoEquipment'), general('LRM_AmmoEquipment')];
    const result = moveAllEquipment(archer, build({ leftTorso: bins }), 'leftTorso', 'LRM Ammo', LEGS);

    expect(result.loadout.leftTorso).toEqual([]);
    expect(result.loadout.leftLeg).toHaveLength(2);
    expect(result.loadout.rightLeg).toHaveLength(1);
  });

  it('duplica y mueve respetando los slots libres', () => {
    const sink = general('DoubleHeatSink');
    const loadout = build({ leftTorso: [sink] });

    expect(duplicateEquipment(archer, loadout, 'leftTorso', sink.instanceId, 'rightTorso').loadout.rightTorso).toHaveLength(1);
    expect(moveEquipment(archer, loadout, 'leftTorso', sink.instanceId, 'leftLeg').message)
      .toBe('No room for Double Heat Sink in Left leg');

    const moved = moveEquipment(archer, loadout, 'leftTorso', sink.instanceId, 'rightTorso').loadout;
    expect(moved.leftTorso).toEqual([]);
    expect((moved.rightTorso[0] as EquippedItem).equippedSlotType).toBe('General_SlotType');
  });
});

describe('sustituir el arma de un anclaje', () => {
  it('cambia el arma montada por otra en el mismo anclaje', () => {
    const laser = weapon('MediumLaser', 0, '3');
    const result = replaceWeapon(archer, build({ leftArm: [laser] }), 'leftArm', 0, getItem('MediumPulseLaser'));

    expect(weaponsIn(result.loadout, 'leftArm')).toEqual(['MediumPulseLaser', null]);
    expect(result.message).toBe('Replaced Medium Laser with Medium Pulse Laser');
  });

  it('no sustituye por un arma que no cabe en el anclaje', () => {
    const laser = weapon('MediumLaser', 0);
    const loadout = build({ leftArm: [laser] });
    const result = replaceWeapon(archer, loadout, 'leftArm', 0, getItem('LRM15'));

    expect(result.loadout).toBe(loadout);
  });
});
