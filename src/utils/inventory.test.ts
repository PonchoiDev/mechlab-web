import { describe, expect, it } from 'vitest';
import {
  autoPlaceItem,
  countByCategory,
  filterInventory,
  getDropTargets,
  getHardpointUsage,
  getNextFreeHardpoint,
  getInventoryCategory,
  INVENTORY_CATEGORIES,
  moveEquippedItem,
  placeItem,
  sortInventory,
  unequipItem,
  type InventoryFilters
} from './inventory';
import { createEquippedItem, getHardpointViews } from './equipment';
import { getWeaponStats } from './calculators';
import { createEmptyLoadout } from './zones';
import { allItems, getItem, getMech } from '../test/fixtures';
import type { EquippedLoadout } from '../types/mech';

const archer = getMech('ARC-2R');
const empty = createEmptyLoadout();
const build = (parts: Partial<EquippedLoadout>): EquippedLoadout => ({ ...createEmptyLoadout(), ...parts });
const weapon = (id: string, hardpointIndex: number, tier?: string) =>
  createEquippedItem(getItem(id, tier ? { tier } : {}), undefined, hardpointIndex);
const filters = (changes: Partial<InventoryFilters> = {}): InventoryFilters =>
  ({ category: 'all', search: '', size: null, fitsOnly: true, ...changes });
const ids = (items: { id: string }[]) => items.map(item => item.id);

describe('categorías del inventario', () => {
  it('CA1: All cuenta todo, las armas se reparten por tipo y el resto en Equipment y Ammo', () => {
    const counts = countByCategory(allItems);
    const weapons = allItems.filter(item => item.type === 'weapon').length;

    expect(INVENTORY_CATEGORIES).toEqual(['all', 'energy', 'ballistic', 'missile', 'artillery', 'ams', 'melee', 'equipment', 'ammo']);
    expect(counts.all).toBe(allItems.length);
    expect(counts.energy + counts.ballistic + counts.missile + counts.artillery + counts.ams + counts.melee).toBe(weapons);
    expect(counts.equipment).toBe(allItems.filter(item => item.type === 'equipment').length);
    expect(counts.ammo).toBe(allItems.filter(item => item.type === 'ammo').length);
    expect(getInventoryCategory(getItem('Autocannon10'))).toBe('ballistic');
    expect(getInventoryCategory(getItem('DoubleHeatSink'))).toBe('equipment');
    expect(getInventoryCategory(getItem('LRM_AmmoEquipment'))).toBe('ammo');
  });
});

describe('filtros del inventario', () => {
  it('CA2: con Fits this \'Mech solo queda lo que se puede colocar en el ARC-2R', () => {
    const shown = ids(filterInventory(allItems, filters(), archer, empty));

    expect(shown).toEqual(expect.arrayContaining(['MediumLaser', 'LRM20', 'DoubleHeatSink', 'Knuckles_Heavy']));
    expect(shown).not.toContain('Autocannon10');
    expect(shown).not.toContain('JumpJet_Class3_Equipment');
    expect(shown).not.toContain('Knuckles_Light');
    expect(shown).not.toContain('LRM_AmmoEquipment');
  });

  it('CA3: la munición aparece cuando hay un arma montada que la usa; sin la casilla aparece toda', () => {
    const withLrm = build({ leftTorso: [weapon('LRM20', 0)] });
    const ammo = filters({ category: 'ammo' });

    expect(ids(filterInventory(allItems, ammo, archer, withLrm))).toContain('LRM_AmmoEquipment');
    expect(filterInventory(allItems, { ...ammo, fitsOnly: false }, archer, empty))
      .toHaveLength(allItems.filter(item => item.type === 'ammo').length);
  });

  it('CA4: buscador y tamaño', () => {
    const all = filters({ fitsOnly: false });

    expect(ids(filterInventory(allItems, { ...all, search: 'ac10' }, archer, empty))).toContain('Autocannon10');
    const large = filterInventory(allItems, { ...all, size: 'large' }, archer, empty);
    expect(large.length).toBeGreaterThan(0);
    expect(large.every(item => item.size === 'large')).toBe(true);
  });
});

describe('orden del inventario', () => {
  it('CA5: por daño, hacia abajo y hacia arriba, con el equipo al final', () => {
    const items = [getItem('MediumLaser'), getItem('DoubleHeatSink'), getItem('LRM20'), getItem('SmallLaser')];
    const damage = (id: string) => getWeaponStats(getItem(id)).damage;
    const [most, least] = [...['MediumLaser', 'LRM20', 'SmallLaser']].sort((a, b) => damage(b) - damage(a))
      .filter((_, index, list) => index === 0 || index === list.length - 1);

    const descending = sortInventory(items, 'damage', 'desc');
    const ascending = sortInventory(items, 'damage', 'asc');
    expect(descending[0].id).toBe(most);
    expect(ascending[0].id).toBe(least);
    expect(descending.at(-1)?.id).toBe('DoubleHeatSink');
    expect(ascending.at(-1)?.id).toBe('DoubleHeatSink');
  });
});

describe('destinos del arrastre', () => {
  it('CA6: un arma resalta los anclajes que la admiten y los componentes con uno libre', () => {
    const loadout = build({ leftArm: [weapon('MediumLaser', 0)] });
    const targets = getDropTargets(archer, loadout, getItem('MediumLaser'));

    expect(targets.leftArm).toEqual({ component: false, hardpoints: [0] });
    expect(targets.rightArm).toEqual({ component: true, hardpoints: [0] });
    expect(targets.centerTorso).toEqual({ component: true, hardpoints: [0, 1] });
    expect(targets.leftTorso).toEqual({ component: false, hardpoints: [] });
    expect(targets.leftLeg).toEqual({ component: false, hardpoints: [] });
  });

  it('CA7: el equipo resalta los componentes con sitio y ningún anclaje', () => {
    const targets = getDropTargets(archer, empty, getItem('DoubleHeatSink'));
    const accepting = Object.entries(targets).filter(([, target]) => target.component).map(([zone]) => zone).sort();

    expect(accepting).toEqual(['centerTorso', 'leftArm', 'leftTorso', 'rightArm', 'rightTorso']);
    expect(Object.values(targets).every(target => target.hardpoints.length === 0)).toBe(true);
  });
});

describe('colocar desde el inventario', () => {
  it('CA8: el arma se monta en el anclaje con el tier elegido', () => {
    const result = placeItem(archer, empty, 'rightArm', getItem('MediumLaser', { tier: '3' }), 0);
    const [view] = getHardpointViews(archer.components.rightArm.hardpoints, result.loadout.rightArm);

    expect(view.weapon?.id).toBe('MediumLaser');
    expect(view.weapon?.tier).toBe('3');
    expect(result.replaced).toBe(false);
  });

  it('CA9: un arma que no cabe en el anclaje no cambia la build', () => {
    const loadout = build({ leftArm: [weapon('MediumLaser', 0)] });
    const result = placeItem(archer, loadout, 'leftArm', getItem('LargeLaser'), 0);

    expect(result.loadout).toBe(loadout);
    expect(result.message).toMatch(/does not fit/);
  });

  it('CA10: soltar sobre un anclaje ocupado reemplaza el arma y lo avisa', () => {
    const loadout = build({ leftArm: [weapon('MediumLaser', 0)] });
    const result = placeItem(archer, loadout, 'leftArm', getItem('SmallLaser'), 0);

    expect(ids(result.loadout.leftArm)).toEqual(['SmallLaser']);
    expect(result.message).toBe('Replaced M Laser with S Laser in Left arm');
    expect(result.replaced).toBe(true);
  });

  it('CA11: un destino que no admite el objeto no cambia la build y dice por qué', () => {
    const cannon = placeItem(archer, empty, 'rightArm', getItem('Autocannon10'), null);
    const sink = placeItem(archer, empty, 'head', getItem('DoubleHeatSink'), null);

    expect(cannon.loadout).toBe(empty);
    expect(cannon.message).toBe('No free hardpoint in Right arm fits AC/10');
    expect(sink.loadout).toBe(empty);
    expect(sink.message).toBe('No room for Double Heat Sink in Head');
  });

  it('CA12: el equipo soltado en un componente ocupa una ranura libre', () => {
    const result = placeItem(archer, empty, 'leftTorso', getItem('DoubleHeatSink'), null);

    expect(result.loadout.leftTorso.map(item => [item.id, item.equippedSlotType])).toEqual([['DoubleHeatSink', 'General_SlotType']]);
    expect(result.message).toBe('Added Double Heat Sink to Left torso');
  });

  it('soltar el equipo sobre un anclaje lo coloca en las ranuras del componente', () => {
    const result = placeItem(archer, empty, 'leftArm', getItem('DoubleHeatSink'), 0);

    expect(ids(result.loadout.leftArm)).toEqual(['DoubleHeatSink']);
  });

  it('soltar un arma en el componente usa el primer anclaje libre que encaja', () => {
    const result = placeItem(archer, empty, 'centerTorso', getItem('MediumLaser'), null);

    expect(result.loadout.centerTorso[0].hardpointIndex).toBe(0);
    expect(result.message).toBe('Added M Laser to Center torso');
  });
});

describe('orden por calor y RPM', () => {
  it('CA14: hacia abajo, primero el arma de más calor o de más RPM, con el equipo al final', () => {
    const items = [getItem('MediumLaser'), getItem('DoubleHeatSink'), getItem('LRM20'), getItem('Autocannon10')];
    const weapons = items.filter(item => item.type === 'weapon');
    const top = (stat: 'heat' | 'rpm') =>
      [...weapons].sort((a, b) => getWeaponStats(b)[stat] - getWeaponStats(a)[stat])[0].id;

    expect(sortInventory(items, 'heat', 'desc')[0].id).toBe(top('heat'));
    expect(sortInventory(items, 'rpm', 'desc')[0].id).toBe(top('rpm'));
    expect(sortInventory(items, 'heat', 'desc').at(-1)?.id).toBe('DoubleHeatSink');
    expect(sortInventory(items, 'rpm', 'asc').at(-1)?.id).toBe('DoubleHeatSink');
  });
});

describe('objetos equipados', () => {
  it('CA15: desequipar quita el objeto y lo avisa', () => {
    const laser = weapon('MediumLaser', 0);
    const result = unequipItem(build({ leftArm: [laser] }), 'leftArm', laser.instanceId);

    expect(result.loadout.leftArm).toEqual([]);
    expect(result.message).toBe('Removed M Laser from Left arm');
  });

  it('CA16: un arma arrastrada cuenta su propio anclaje como libre y se mueve con su tier', () => {
    const laser = weapon('MediumLaser', 0, '3');
    const loadout = build({ leftArm: [laser] });
    const origin = { zone: 'leftArm' as const, instanceId: laser.instanceId };

    expect(getDropTargets(archer, loadout, laser, origin).leftArm).toEqual({ component: true, hardpoints: [0] });
    const result = moveEquippedItem(archer, loadout, origin, 'rightArm', 0);
    expect(result.loadout.leftArm).toEqual([]);
    expect(result.loadout.rightArm.map(item => [item.id, item.tier, item.hardpointIndex])).toEqual([['MediumLaser', '3', 0]]);
    expect(result.replaced).toBe(false);
  });

  it('CA17: moverla a un anclaje ocupado reemplaza su arma', () => {
    const laser = weapon('MediumLaser', 0);
    const loadout = build({ leftArm: [laser], rightArm: [weapon('SmallLaser', 0)] });
    const result = moveEquippedItem(archer, loadout, { zone: 'leftArm', instanceId: laser.instanceId }, 'rightArm', 0);

    expect(result.loadout.leftArm).toEqual([]);
    expect(ids(result.loadout.rightArm)).toEqual(['MediumLaser']);
    expect(result.replaced).toBe(true);
    expect(result.message).toBe('Replaced S Laser with M Laser in Right arm');
  });

  it('CA18: moverla a donde no cabe no cambia nada', () => {
    const laser = weapon('MediumLaser', 0);
    const loadout = build({ leftArm: [laser] });
    const result = moveEquippedItem(archer, loadout, { zone: 'leftArm', instanceId: laser.instanceId }, 'leftLeg', null);

    expect(result.loadout).toBe(loadout);
    expect(result.message).toBe('No free hardpoint in Left leg fits M Laser');
  });
});

describe('equipar con el clic derecho', () => {
  it('CA19: cada objeto va a su lugar adecuado', () => {
    expect(autoPlaceItem(archer, empty, getItem('MediumLaser')).message).toBe('Added M Laser to Center torso');
    expect(autoPlaceItem(archer, empty, getItem('LRM20')).message).toBe('Added LRM 20 to Left torso');

    const first = autoPlaceItem(archer, empty, getItem('DoubleHeatSink'));
    expect(first.loadout.centerTorso.map(item => item.equippedSlotType)).toEqual(['EngineHeatsink_SlotType']);
    const second = autoPlaceItem(archer, first.loadout, getItem('DoubleHeatSink'));
    expect(second.loadout.leftTorso.map(item => item.equippedSlotType)).toEqual(['General_SlotType']);
  });

  it('CA20: si no cabe en ningún sitio, no cambia nada y lo avisa', () => {
    const result = autoPlaceItem(archer, empty, getItem('Autocannon10'));

    expect(result.loadout).toBe(empty);
    expect(result.message).toBe("No room for AC/10 in this 'Mech");
  });
});

describe('inventario apuntando a un componente o a un anclaje', () => {
  const withLaser = build({ leftArm: [weapon('MediumLaser', 0)] });

  it('CA21: con el brazo izquierdo como destino, solo lo que cabe en él', () => {
    const shown = ids(filterInventory(allItems, filters({ target: { zone: 'leftArm', hardpointIndex: null } }), archer, withLaser));

    expect(shown).toEqual(expect.arrayContaining(['Knuckles_Heavy', 'DoubleHeatSink']));
    expect(shown).not.toContain('SmallLaser');
    expect(shown).not.toContain('LRM20');
  });

  it('CA22: con un anclaje ocupado como destino, solo las armas que lo admiten, como reemplazo', () => {
    const shown = ids(filterInventory(allItems, filters({ target: { zone: 'leftArm', hardpointIndex: 0 } }), archer, withLaser));

    expect(shown).toContain('SmallLaser');
    expect(shown).not.toContain('LRM20');
    expect(shown).not.toContain('Knuckles_Heavy');
    expect(shown).not.toContain('DoubleHeatSink');
  });

  it('CA23: tras equipar en un anclaje, el destino pasa al siguiente libre', () => {
    const one = build({ centerTorso: [weapon('MediumLaser', 0)] });
    const both = build({ centerTorso: [weapon('MediumLaser', 0), weapon('MediumLaser', 1)] });

    expect(getNextFreeHardpoint(archer, one, 'centerTorso', 0)).toBe(1);
    expect(getNextFreeHardpoint(archer, both, 'centerTorso', 1)).toBeNull();
    expect(getNextFreeHardpoint(archer, withLaser, 'leftArm', 0)).toBe(1);
  });
});

describe('anclajes de cada tarjeta', () => {
  it('CA24: por tipo, con los ocupados, solo los que tiene el componente', () => {
    const loadout = build({ leftArm: [weapon('MediumLaser', 0)] });

    expect(getHardpointUsage(archer.components.leftArm, loadout.leftArm)).toEqual([
      { type: 'energy', used: 1, capacity: 1 },
      { type: 'melee', used: 0, capacity: 1 }
    ]);
    expect(getHardpointUsage(archer.components.centerTorso, loadout.centerTorso)).toEqual([{ type: 'energy', used: 0, capacity: 2 }]);
    expect(getHardpointUsage(archer.components.leftLeg, loadout.leftLeg)).toEqual([]);
  });
});

// docs/specs/equipo-unico.md
describe('un solo computador de puntería', () => {
  const withComputer = build({ leftTorso: [createEquippedItem(getItem('TargetingComputer_Mk1'), 'General_SlotType')] });

  it('CA2: no se equipa un segundo computador y el aviso dice por qué', () => {
    const result = placeItem(archer, withComputer, 'rightTorso', getItem('TargetingComputer_Mk5'), null);
    expect(result.loadout).toBe(withComputer);
    expect(result.message).toBe("Only one Targeting Computer per 'Mech");
    expect(Object.values(getDropTargets(archer, withComputer, getItem('TargetingComputer_Mk5'))).some(target => target.component)).toBe(false);
    expect(autoPlaceItem(archer, withComputer, getItem('TargetingComputer_Mk5')).loadout).toBe(withComputer);
  });

  it('CA3: el computador montado se puede mover a otra ubicación', () => {
    const [computer] = withComputer.leftTorso;
    const result = moveEquippedItem(archer, withComputer, { zone: 'leftTorso', instanceId: computer.instanceId }, 'rightTorso', null);
    expect(ids(result.loadout.rightTorso)).toEqual(['TargetingComputer_Mk1']);
    expect(result.loadout.leftTorso).toEqual([]);
    expect(getDropTargets(archer, withComputer, computer, { zone: 'leftTorso', instanceId: computer.instanceId }).rightTorso.component).toBe(true);
  });

  it('CA9: tampoco se montan dos sondas activas', () => {
    const withProbe = build({ leftTorso: [createEquippedItem(getItem('BeagleActiveProbe'), 'General_SlotType')] });
    const result = placeItem(archer, withProbe, 'rightTorso', getItem('ClanActiveProbe'), null);
    expect(result.loadout).toBe(withProbe);
    expect(result.message).toBe("Only one active probe per 'Mech");
  });

  it('CA6: sin computador se equipa uno', () => {
    expect(ids(placeItem(archer, empty, 'rightTorso', getItem('TargetingComputer_Mk5'), null).loadout.rightTorso)).toEqual(['TargetingComputer_Mk5']);
  });
});
