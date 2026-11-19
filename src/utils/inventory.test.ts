import { describe, expect, it } from 'vitest';
import {
  countByCategory,
  filterInventory,
  getDropTargets,
  getInventoryCategory,
  INVENTORY_CATEGORIES,
  placeItem,
  sortInventory,
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
const weapon = (id: string, hardpointIndex: number) => createEquippedItem(getItem(id), undefined, hardpointIndex);
const filters = (changes: Partial<InventoryFilters> = {}): InventoryFilters =>
  ({ category: 'all', search: '', techBase: null, size: null, fitsOnly: true, ...changes });
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

  it('CA4: buscador, tecnología y tamaño', () => {
    const all = filters({ fitsOnly: false });

    expect(ids(filterInventory(allItems, { ...all, search: 'ac10' }, archer, empty))).toContain('Autocannon10');
    const clan = filterInventory(allItems, { ...all, techBase: 'Clan' }, archer, empty);
    expect(clan.length).toBeGreaterThan(0);
    expect(clan.every(item => item.techBase === 'Clan')).toBe(true);
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
