import type { HardpointType, Item, ItemSize, WeaponType } from '../types/item';

export const SIZE_RANK: Record<ItemSize, number> = {
  small: 1,
  medium: 2,
  large: 3
};

export const isJumpJet = (item: Item): boolean => {
  return (
    item.equipmentType === 'jumpJet' ||
    item.id.toLowerCase().startsWith('jumpjet') ||
    item.name.toLowerCase().includes('jump jet')
  );
};

export const getItemSupportedSlotTypes = (item: Item): string[] => {
  if (item.specialSlotTypes?.length) return item.specialSlotTypes;

  const jumpJetClass = item.id.match(/^JumpJet_Class([1-5])_Equipment$/i);
  if (jumpJetClass) return [`JumpJetClass${jumpJetClass[1]}_SlotType`];

  if (item.id === 'SingleHeatSink' || item.id === 'DoubleHeatSink') {
    return ['EngineHeatsink_SlotType', 'General_SlotType'];
  }

  const motiveUpgrade = item.id.match(/^Supercharger_Arena_MK(I{1,3}|IV|V)$/i);
  if (motiveUpgrade) return [`MASC_MK${motiveUpgrade[1].toUpperCase()}_SlotType`];

  return ['General_SlotType'];
};

export const getItemWeaponType = (item: Item): WeaponType | null => {
  if (
    item.id === 'AntiMissileSystem' ||
    item.id.toLowerCase().startsWith('antimissilesystem') ||
    item.name.toUpperCase() === 'AMS'
  ) {
    return 'ams';
  }
  return item.weaponType ?? null;
};

export const getAmmoLabel = (ammo: Item): string => ammo.name.replace(/\s*(?:Half\s+)?Ammo$/i, '');

export const isAmmoCompatibleWithWeapon = (ammo: Item, weapon: Item): boolean =>
  ammo.type === 'ammo' &&
  weapon.type === 'weapon' &&
  ammo.ammoType !== undefined &&
  ammo.ammoType === weapon.ammoType;

const SIZE_NAMES: Record<ItemSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };

const WEAPON_TYPE_NAMES: Record<HardpointType, string> = {
  energy: 'Energy',
  ballistic: 'Ballistic',
  missile: 'Missile',
  artillery: 'Artillery',
  ams: 'AMS',
  melee: 'Melee',
  omni: 'Omni'
};

export const getSizeName = (size: ItemSize): string => SIZE_NAMES[size];

export const getWeaponTypeName = (weaponType: HardpointType): string => WEAPON_TYPE_NAMES[weaponType];

export const isClanTech = (item: Item): boolean => item.techBase === 'Clan';

export const getTierName = (item: Item): string | null => {
  if (item.type !== 'weapon' || !item.tiers) return null;
  // Las armas Clan tienen un único nivel, que el juego muestra como tier Clan.
  if (isClanTech(item)) return 'Clan tier';
  const tier = item.tier ?? '1';
  if (tier.toLowerCase() === 'clan') return 'Clan tier';
  return tier === '5' ? 'Lost Tech tier' : `Tier ${tier}`;
};

const TECH_BASE_NAMES: Record<string, string> = {
  InnerSphere: 'Inner Sphere',
  LosTech: 'LosTech'
};

export const getTechBaseName = (techBase: string): string => TECH_BASE_NAMES[techBase] ?? techBase;

export interface ItemFilters {
  search?: string;
  techBase?: string | null;
  weaponType?: WeaponType | null;
}

export const filterItems = (items: Item[], { search = '', techBase = null, weaponType = null }: ItemFilters): Item[] => {
  const query = search.trim().toLowerCase();
  return items.filter(item =>
    (!query || item.name.toLowerCase().includes(query)) &&
    (!techBase || item.techBase === techBase) &&
    (!weaponType || getItemWeaponType(item) === weaponType)
  );
};

export const getSlotsLabel = (item: Item): string => {
  const slots = item.slots ?? 0;
  return `${slots} ${slots === 1 ? 'slot' : 'slots'}`;
};
