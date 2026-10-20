import type { Item, ItemSize, WeaponType } from '../types/item';

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

export const getSizeLabel = (item: Item): string => item.size.charAt(0).toUpperCase();

export const getSlotsLabel = (item: Item): string => {
  const slots = item.slots ?? 0;
  return `${slots} ${slots === 1 ? 'slot' : 'slots'}`;
};
