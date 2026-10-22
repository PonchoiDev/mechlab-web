import { describe, expect, it } from 'vitest';
import { decodeBuild, encodeBuild } from './buildCode';
import { createDefaultArmor } from './calculators';
import { createEquippedItem } from './equipment';
import { createEmptyLoadout } from './zones';
import { allItems, allMechs, getItem, getMech } from '../test/fixtures';
import type { EquippedLoadout } from '../types/mech';

const archer = getMech('ARC-2R');
const build = (parts: Partial<EquippedLoadout>): EquippedLoadout => ({ ...createEmptyLoadout(), ...parts });
const strip = (loadout: EquippedLoadout) => Object.fromEntries(Object.entries(loadout).map(([zone, items]) => [
  zone,
  items.map(({ id, tier, hardpointIndex, equippedSlotType }) => ({ id, tier, hardpointIndex, equippedSlotType }))
]));
const toJson = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('enlace de la build', () => {
  const loadout = build({
    leftArm: [createEquippedItem(getItem('MediumLaser', { tier: '4' }), undefined, 0)],
    leftTorso: [createEquippedItem(getItem('LRM15'), undefined, 0), createEquippedItem(getItem('DoubleHeatSink'), 'General_SlotType')],
    leftLeg: [createEquippedItem(getItem('LRM_AmmoEquipment'), 'General_SlotType')]
  });
  const armor = { ...createDefaultArmor(archer.components), head: { front: 12, rear: 0 } };

  it('reconstruye el mech, el anclaje y el tier de cada arma, el equipo y la armadura', () => {
    const code = encodeBuild(archer, loadout, armor, allItems);
    const decoded = decodeBuild(code, allMechs, allItems);

    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decoded?.mech).toBe(archer);
    expect(strip(decoded!.loadout)).toEqual(strip(loadout));
    expect(decoded?.armor).toEqual(armor);
  });

  it('descarta las piezas que ya no existen o no caben', () => {
    const code = toJson([1, 'ARC-2R', [], [[], [], [['LRM15', 0], 'NoExiste'], [], [['MediumLaser', 7]], [], [], []]]);
    const decoded = decodeBuild(code, allMechs, allItems);

    expect(decoded?.loadout.leftTorso.map(item => item.id)).toEqual(['LRM15']);
    expect(decoded?.loadout.leftArm).toEqual([]);
  });

  it('limita la armadura al máximo de cada componente', () => {
    const code = toJson([1, 'ARC-2R', [9999, 9999], [[], [], [], [], [], [], [], []]]);
    const head = decodeBuild(code, allMechs, allItems)?.armor.head;

    expect(head).toEqual({ front: archer.components.head.maxArmor, rear: 0 });
  });

  it('rechaza los enlaces no válidos o de un mech desconocido', () => {
    expect(decodeBuild('no-es-una-build', allMechs, allItems)).toBeNull();
    expect(decodeBuild(toJson([1, 'NO-EXISTE', [], []]), allMechs, allItems)).toBeNull();
    expect(decodeBuild(toJson([99, 'ARC-2R', [], []]), allMechs, allItems)).toBeNull();
  });
});
