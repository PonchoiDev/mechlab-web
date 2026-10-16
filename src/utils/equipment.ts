import type { Item } from '../types/item';
import type { ComponentData, Hardpoint } from '../types/mech';
import { getItemSupportedSlotTypes, getItemWeaponType, SIZE_RANK } from './items';

const GENERAL_SLOT_TYPE = 'General_SlotType';

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
    .reduce((total, item) => total + item.slots, 0);

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
      (hardpoint, index) =>
        !occupiedIndices.has(index) &&
        hardpoint.type === weaponType &&
        (weaponType === 'melee' || SIZE_RANK[hardpoint.size] >= SIZE_RANK[weapon.size])
    );

    if (hardpointIndex !== -1) {
      occupiedIndices.add(hardpointIndex);
      weaponAssignments.set(hardpointIndex, weapon);
    }
  }

  return { occupiedIndices, weaponAssignments };
};

export const getAvailableSlotType = (
  item: Item,
  componentData: ComponentData,
  equippedItems: Item[]
): string | null => {
  for (const slotType of getItemSupportedSlotTypes(item)) {
    if (slotType === GENERAL_SLOT_TYPE) {
      if (getUsedGeneralSlots(equippedItems) + item.slots <= componentData.maxSlots) return slotType;
      continue;
    }

    const fallbackCapacity = slotType.startsWith('JumpJetClass')
      ? componentData.jumpJetSlots
      : slotType === 'EngineHeatsink_SlotType'
        ? componentData.engineHeatsinkSlots ?? 0
        : 0;
    const capacity = componentData.specialSlots?.[slotType] ?? fallbackCapacity;
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
