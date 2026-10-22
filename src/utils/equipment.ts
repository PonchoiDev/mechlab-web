import type { Item } from '../types/item';
import type { ComponentData, EquippedItem, Hardpoint, Loadout, Zone } from '../types/mech';
import { getItemSupportedSlotTypes, getItemWeaponType, isAmmoCompatibleWithWeapon, SIZE_RANK } from './items';
import { mapZones } from './zones';

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

export const weaponFitsHardpoint = (hardpoint: Hardpoint, weapon: Item): boolean => {
  const weaponType = getItemWeaponType(weapon);
  return weapon.type === 'weapon' && weaponType !== null && fitsHardpoint(hardpoint, weapon, weaponType);
};

type PlacedItem = Item & { hardpointIndex?: number };

// Las armas con hardpointIndex se quedan en el anclaje donde se equiparon; el resto se reparte
// empezando por las más grandes en el primer anclaje libre compatible.
export const getHardpointOccupancy = (
  hardpoints: Hardpoint[] = [],
  equippedItems: PlacedItem[] = []
): { occupiedIndices: Set<number>; weaponAssignments: Map<number, Item> } => {
  const occupiedIndices = new Set<number>();
  const weaponAssignments = new Map<number, Item>();
  const unplaced: Item[] = [];

  for (const weapon of equippedItems.filter(item => item.type === 'weapon')) {
    const index = weapon.hardpointIndex;
    const hardpoint = index !== undefined ? hardpoints[index] : undefined;
    if (index !== undefined && hardpoint && !occupiedIndices.has(index) && weaponFitsHardpoint(hardpoint, weapon)) {
      occupiedIndices.add(index);
      weaponAssignments.set(index, weapon);
    } else {
      unplaced.push(weapon);
    }
  }

  const weapons = unplaced.sort((first, second) => SIZE_RANK[second.size] - SIZE_RANK[first.size]);

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

export const createEquippedItem = (item: Item, equippedSlotType?: string, hardpointIndex?: number): EquippedItem => ({
  ...item,
  ...(equippedSlotType ? { equippedSlotType } : {}),
  ...(hardpointIndex !== undefined ? { hardpointIndex } : {}),
  instanceId: `item-${++nextInstanceId}`
});

// Anclaje libre donde colocar un arma: el más pequeño que le sirva, para no gastar los grandes.
export const findHardpointForWeapon = (
  hardpoints: Hardpoint[],
  equippedItems: PlacedItem[],
  weapon: Item
): number | null => {
  const { occupiedIndices } = getHardpointOccupancy(hardpoints, equippedItems);
  const candidates = hardpoints
    .map((hardpoint, index) => ({ hardpoint, index }))
    .filter(({ hardpoint, index }) => !occupiedIndices.has(index) && weaponFitsHardpoint(hardpoint, weapon))
    .sort((first, second) => SIZE_RANK[first.hardpoint.size] - SIZE_RANK[second.hardpoint.size] || first.index - second.index);

  return candidates[0]?.index ?? null;
};

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


export interface HardpointView {
  index: number;
  hardpoint: Hardpoint;
  weapon?: Item;
  builtInWeapon?: string;
}

export const getHardpointViews = (hardpoints: Hardpoint[], equippedItems: Item[]): HardpointView[] => {
  const { weaponAssignments } = getHardpointOccupancy(hardpoints, equippedItems);
  return hardpoints.map((hardpoint, index) => {
    const weapon = weaponAssignments.get(index);
    return {
      index,
      hardpoint,
      weapon,
      builtInWeapon: !weapon ? hardpoint.defaultWeapon : undefined
    };
  });
};

export interface SpecialSlotStatus {
  slotType: string;
  used: number;
  capacity: number;
}

export interface ComponentStatus {
  usedSlots: number;
  maxSlots: number;
  freeHardpoints: number;
  freeHardpointIndices: number[];
  specialSlots: SpecialSlotStatus[];
  isOverSlots: boolean;
  hasFreeSpace: boolean;
}

export const getComponentStatus = (componentData: ComponentData, equippedItems: Item[]): ComponentStatus => {
  const usedSlots = getUsedGeneralSlots(equippedItems);
  // Un anclaje con arma especial de serie no se considera libre: si se deja vacío, se usa esa arma.
  const freeHardpointIndices = getHardpointViews(componentData.hardpoints, equippedItems)
    .filter(view => !view.weapon && !view.builtInWeapon)
    .map(view => view.index);
  const freeHardpoints = freeHardpointIndices.length;
  const specialSlots = Object.entries(componentData.specialSlots ?? {})
    .filter(([, capacity]) => capacity > 0)
    .map(([slotType, capacity]) => ({
      slotType,
      capacity,
      used: equippedItems.filter(item => item.equippedSlotType === slotType).length
    }));

  return {
    usedSlots,
    maxSlots: componentData.maxSlots,
    freeHardpoints,
    freeHardpointIndices,
    specialSlots,
    isOverSlots: usedSlots > componentData.maxSlots,
    hasFreeSpace: freeHardpoints > 0 || usedSlots < componentData.maxSlots ||
      specialSlots.some(slot => slot.used < slot.capacity)
  };
};

export const getWeaponsForHardpoint = (
  catalog: Item[],
  componentData: ComponentData,
  equippedItems: PlacedItem[],
  hardpointIndex: number
): Item[] => {
  const hardpoint = componentData.hardpoints[hardpointIndex];
  if (!hardpoint) return [];
  if (getHardpointOccupancy(componentData.hardpoints, equippedItems).occupiedIndices.has(hardpointIndex)) return [];

  return catalog.filter(item => weaponFitsHardpoint(hardpoint, item));
};

export interface AmmoWarning {
  kind: 'missing-ammo' | 'unused-ammo';
  itemName: string;
}

// Armas que usan munición sin ninguna compatible en el mech, y munición que no sirve a ningún arma equipada.
export const getAmmoWarnings = (loadout: Loadout): Record<Zone, AmmoWarning[]> => {
  const equipped = Object.values(loadout).flat();
  const weapons = equipped.filter(item => item.type === 'weapon');
  const ammo = equipped.filter(item => item.type === 'ammo');

  return mapZones(zone => {
    const warnings = new Map<string, AmmoWarning>();
    for (const item of loadout[zone]) {
      if (item.type === 'weapon' && item.ammoType && !ammo.some(bin => isAmmoCompatibleWithWeapon(bin, item))) {
        warnings.set(`missing-${item.name}`, { kind: 'missing-ammo', itemName: item.name });
      }
      if (item.type === 'ammo' && !weapons.some(weapon => isAmmoCompatibleWithWeapon(item, weapon))) {
        warnings.set(`unused-${item.name}`, { kind: 'unused-ammo', itemName: item.name });
      }
    }
    return [...warnings.values()];
  });
};

// Armas que pueden ir en un anclaje concreto, esté libre u ocupado (para sustituir la montada).
export const getReplacementWeapons = (catalog: Item[], componentData: ComponentData, hardpointIndex: number): Item[] => {
  const hardpoint = componentData.hardpoints[hardpointIndex];
  return hardpoint ? catalog.filter(item => weaponFitsHardpoint(hardpoint, item)) : [];
};
