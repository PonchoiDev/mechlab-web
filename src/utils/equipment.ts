import type { ComponentData } from '../types/mech';
import { getItemSupportedSlotTypes, SIZE_RANK, type Item } from '../types/item';

export const getAvailableSlotType = (
  item: Item,
  componentData: ComponentData,
  equippedItems: Item[]
): string | null => {
  for (const slotType of getItemSupportedSlotTypes(item)) {
    if (slotType === 'General_SlotType') {
      const usedSlots = equippedItems
        .filter(equippedItem => equippedItem.type !== 'weapon' &&
          (equippedItem.equippedSlotType ?? 'General_SlotType') === 'General_SlotType')
        .reduce((total, equippedItem) => total + equippedItem.slots, 0);
      if (usedSlots + item.slots <= componentData.maxSlots) return slotType;
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

export const canEquipItem = (item: Item, componentData: ComponentData, equippedItems: Item[]) => {
  if (item.type !== 'weapon') return getAvailableSlotType(item, componentData, equippedItems) !== null;

  const weapons = [...equippedItems, item]
    .filter(equippedItem => equippedItem.type === 'weapon')
    .sort((first, second) => SIZE_RANK[second.size] - SIZE_RANK[first.size]);
  const usedHardpoints = new Set<number>();

  for (const weapon of weapons) {
    if (!weapon.weaponType) return false;

    const hardpointIndex = componentData.hardpoints.findIndex((hardpoint, index) =>
      !usedHardpoints.has(index) &&
      hardpoint.type.toLowerCase() === weapon.weaponType?.toLowerCase() &&
      (weapon.weaponType === 'melee' || SIZE_RANK[hardpoint.size] >= SIZE_RANK[weapon.size])
    );

    if (hardpointIndex === -1) return false;
    usedHardpoints.add(hardpointIndex);
  }

  return true;
};
