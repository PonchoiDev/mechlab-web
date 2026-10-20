import type { Item } from '../types/item';
import type { ComponentData, EquippedItem, Hardpoint, Loadout, Zone } from '../types/mech';
import { getItemSupportedSlotTypes, getItemWeaponType, isAmmoCompatibleWithWeapon, SIZE_RANK } from './items';

const GENERAL_SLOT_TYPE = 'General_SlotType';

let nextInstanceId = 0;

const SLOT_TYPE_LABELS: Record<string, string> = {
  EngineHeatsink_SlotType: 'Engine Heat Sink',
  ECM_SlotType: 'ECM',
  BAP_SlotType: 'Active Probe',
  AMS_SlotType: 'AMS',
  MASC_MKI_SlotType: 'Motive Upgrade MK I',
  MASC_MKII_SlotType: 'Motive Upgrade MK II',
  MASC_MKIII_SlotType: 'Motive Upgrade MK III',
  MASC_MKIV_SlotType: 'Motive Upgrade MK IV',
  MASC_MKV_SlotType: 'Motive Upgrade MK V',
  JumpJetClass1_SlotType: 'Jump Jets Class I',
  JumpJetClass2_SlotType: 'Jump Jets Class II',
  JumpJetClass3_SlotType: 'Jump Jets Class III',
  JumpJetClass4_SlotType: 'Jump Jets Class IV',
  JumpJetClass5_SlotType: 'Jump Jets Class V'
};

export const getSlotTypeLabel = (slotType: string): string =>
  SLOT_TYPE_LABELS[slotType] ?? slotType.replace(/_SlotType$/, '').replace(/_/g, ' ');

export const getUsedGeneralSlots = (equippedItems: Item[]): number =>
  equippedItems
    .filter(item => item.type !== 'weapon' && (item.equippedSlotType ?? GENERAL_SLOT_TYPE) === GENERAL_SLOT_TYPE)
    .reduce((total, item) => total + (item.slots ?? 0), 0);

// Cuerpo a cuerpo: el arma debe ser de la clase de peso del mech. Los antebrazos (S) solo
// admiten Hammerfist (S); las manos (M) y los brazos de arma (L) admiten armas de su tamaño o menores, salvo S.
const fitsMeleeHardpoint = (hardpoint: Hardpoint, weapon: Item): boolean =>
  hardpoint.weightClass === weapon.weightClass &&
  (hardpoint.size === 'small') === (weapon.size === 'small') &&
  SIZE_RANK[hardpoint.size] >= SIZE_RANK[weapon.size];

const fitsHardpoint = (hardpoint: Hardpoint, weapon: Item, weaponType: Hardpoint['type']): boolean =>
  hardpoint.type === weaponType && (
    weaponType === 'melee'
      ? fitsMeleeHardpoint(hardpoint, weapon)
      : SIZE_RANK[hardpoint.size] >= SIZE_RANK[weapon.size]
  );

export const getHardpointOccupancy = (
  hardpoints: Hardpoint[] = [],
  equippedItems: Item[] = []
): { occupiedIndices: Set<number>; weaponAssignments: Map<number, Item> } => {
  const weapons = equippedItems
    .filter((item) => item.type === 'weapon')
    .sort((first, second) => SIZE_RANK[second.size] - SIZE_RANK[first.size]);

  const occupiedIndices = new Set<number>();
  const weaponAssignments = new Map<number, Item>();

  for (const weapon of weapons) {
    const weaponType = getItemWeaponType(weapon);
    if (!weaponType) continue;

    const hardpointIndex = hardpoints.findIndex(
      (hardpoint, index) => !occupiedIndices.has(index) && fitsHardpoint(hardpoint, weapon, weaponType)
    );

    if (hardpointIndex !== -1) {
      occupiedIndices.add(hardpointIndex);
      weaponAssignments.set(hardpointIndex, weapon);
    }
  }

  return { occupiedIndices, weaponAssignments };
};

// Solo para componentes sin specialSlots: los mechs actuales siempre los traen, con una
// única clase de jump jet, y no se debe permitir otra clase usando el total de jumpJetSlots.
const getLegacySlotCapacity = (slotType: string, componentData: ComponentData): number => {
  if (slotType.startsWith('JumpJetClass')) return componentData.jumpJetSlots;
  if (slotType === 'EngineHeatsink_SlotType') return componentData.engineHeatsinkSlots ?? 0;
  return 0;
};

export const getAvailableSlotType = (
  item: Item,
  componentData: ComponentData,
  equippedItems: Item[]
): string | null => {
  for (const slotType of getItemSupportedSlotTypes(item)) {
    if (slotType === GENERAL_SLOT_TYPE) {
      if (getUsedGeneralSlots(equippedItems) + (item.slots ?? 0) <= componentData.maxSlots) return slotType;
      continue;
    }

    const capacity = componentData.specialSlots
      ? componentData.specialSlots[slotType] ?? 0
      : getLegacySlotCapacity(slotType, componentData);
    const usedSlots = equippedItems.filter(equippedItem => equippedItem.equippedSlotType === slotType).length;
    if (usedSlots < capacity) return slotType;
  }

  return null;
};

export const canEquipItem = (item: Item, componentData: ComponentData, equippedItems: Item[]): boolean => {
  if (item.type !== 'weapon') return getAvailableSlotType(item, componentData, equippedItems) !== null;

  const candidateItems = [...equippedItems, item];
  const weaponCount = candidateItems.filter(candidate => candidate.type === 'weapon').length;
  const { weaponAssignments } = getHardpointOccupancy(componentData.hardpoints, candidateItems);

  return weaponAssignments.size === weaponCount;
};

export const createEquippedItem = (item: Item, equippedSlotType?: string): EquippedItem => ({
  ...item,
  ...(equippedSlotType ? { equippedSlotType } : {}),
  instanceId: `item-${++nextInstanceId}`
});

export const getEquippableItems = (
  catalog: Item[],
  componentData: ComponentData,
  loadout: Loadout,
  zone: Zone
): Item[] => {
  const zoneItems = loadout[zone];
  const equippedWeapons = Object.values(loadout).flat().filter(item => item.type === 'weapon');

  return catalog.filter(item => {
    if (!canEquipItem(item, componentData, zoneItems)) return false;
    if (item.type !== 'ammo') return true;

    return equippedWeapons.some(weapon => isAmmoCompatibleWithWeapon(item, weapon));
  });
};

export const getActiveBuiltInMeleeWeapons = (hardpoints: Hardpoint[], equippedItems: Item[]): string[] => {
  const { weaponAssignments } = getHardpointOccupancy(hardpoints, equippedItems);
  return hardpoints
    .filter((hardpoint, index) => hardpoint.defaultWeapon && !weaponAssignments.has(index))
    .map(hardpoint => hardpoint.defaultWeapon as string);
};
