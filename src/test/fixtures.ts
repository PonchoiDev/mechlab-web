import itemsData from '../data/items.json';
import mechsData from '../data/mechs.json';
import type { Item } from '../types/item';
import type { ComponentData, Mech } from '../types/mech';
import type { EquippedLoadout } from '../utils/calculators';

export const allItems = Object.values(itemsData) as Item[];
export const allMechs = mechsData as unknown as Mech[];

export const getItem = (id: string, overrides: Partial<Item> = {}): Item => {
  const item = allItems.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Item ${id} no existe en items.json`);
  return { ...item, ...overrides };
};

export const getMech = (id: string): Mech => {
  const mech = allMechs.find(candidate => candidate.id === id);
  if (!mech) throw new Error(`Mech ${id} no existe en mechs.json`);
  return mech;
};

export const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'TestItem',
  name: 'Test Item',
  type: 'equipment',
  size: 'small',
  tonnage: 1,
  slots: 1,
  ...overrides
});

export const makeComponent = (overrides: Partial<ComponentData> = {}): ComponentData => ({
  maxSlots: 0,
  jumpJetSlots: 0,
  maxArmor: 0,
  structure: 0,
  hasRearArmor: false,
  hardpoints: [],
  ...overrides
});

export const makeLoadout = (overrides: Partial<EquippedLoadout> = {}): EquippedLoadout => ({
  head: [],
  centerTorso: [],
  leftTorso: [],
  rightTorso: [],
  leftArm: [],
  rightArm: [],
  leftLeg: [],
  rightLeg: [],
  ...overrides
});
