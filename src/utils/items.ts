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

export const getItemAmmoType = (item: Item): WeaponType | null => {
  if (item.id.toLowerCase().startsWith('ams_') || item.name.toLowerCase().includes('ams ammo')) {
    return 'ams';
  }
  return item.weaponType ?? null;
};

const AMMO_FAMILY_BY_ID: Record<string, string> = {
  AC10_LBX: 'lbx-ac10',
  AC10_Standard: 'ac10',
  AC20_Standard: 'ac20',
  AC2_Standard: 'ac2',
  AC5_Standard: 'ac5',
  AC5_Ultra: 'ultra-ac5',
  AMS: 'ams',
  Gauss_Standard: 'gauss',
  HeavyRifle: 'heavy-rifle',
  LightRifle: 'light-rifle',
  LRM: 'lrm',
  LRM_Artemis: 'lrm-artemis',
  LargeChemLaser: 'large-chemical-laser',
  MachineGun_Standard: 'machine-gun',
  MediumChemLaser: 'medium-chemical-laser',
  MediumRifle: 'medium-rifle',
  NARC: 'narc',
  SmallChemLaser: 'small-chemical-laser',
  SRM: 'srm',
  SRM_Artemis: 'srm-artemis',
  SRM_Streak: 'streak-srm'
};

const WEAPON_FAMILY_PREFIXES: [string, string][] = [
  ['LBXAutocannon10', 'lbx-ac10'],
  ['UltraAutocannon5', 'ultra-ac5'],
  ['Autocannon10', 'ac10'],
  ['Autocannon20', 'ac20'],
  ['Autocannon2', 'ac2'],
  ['Autocannon5', 'ac5'],
  ['AntiMissileSystem', 'ams'],
  ['GaussRifle', 'gauss'],
  ['HeavyRifle', 'heavy-rifle'],
  ['LightRifle', 'light-rifle'],
  ['LargeChemicalLaser', 'large-chemical-laser'],
  ['MachineGun', 'machine-gun'],
  ['MediumChemicalLaser', 'medium-chemical-laser'],
  ['MediumRifle', 'medium-rifle'],
  ['NarcBeacon', 'narc'],
  ['SmallChemicalLaser', 'small-chemical-laser'],
  ['LRM', 'lrm'],
  ['SRM', 'srm'],
  ['StreakSRM', 'streak-srm']
];

const AMMO_FAMILY_LABELS: Record<string, string> = {
  'lbx-ac10': 'LB 10-X AC',
  ac10: 'AC/10',
  ac20: 'AC/20',
  ac2: 'AC/2',
  ac5: 'AC/5',
  'ultra-ac5': 'Ultra AC/5',
  ams: 'AMS',
  gauss: 'Gauss Rifle',
  'heavy-rifle': 'Heavy Rifle',
  'light-rifle': 'Light Rifle',
  lrm: 'LRM',
  'lrm-artemis': 'LRM Artemis',
  'large-chemical-laser': 'Large Chemical Laser',
  'machine-gun': 'Machine Gun',
  'medium-chemical-laser': 'Medium Chemical Laser',
  'medium-rifle': 'Medium Rifle',
  narc: 'NARC',
  'small-chemical-laser': 'Small Chemical Laser',
  srm: 'SRM',
  'srm-artemis': 'SRM Artemis',
  'streak-srm': 'Streak SRM'
};

export const getItemAmmoFamily = (item: Item): string | null => {
  if (item.type === 'ammo') {
    const ammoId = item.id.replace(/_(?:Half_)?AmmoEquipment$/, '');
    return AMMO_FAMILY_BY_ID[ammoId] ?? null;
  }

  if (/^LRM\d+_Artemis(?:_|$)/.test(item.id)) return 'lrm-artemis';
  if (/^SRM\d+_Artemis(?:_|$)/.test(item.id)) return 'srm-artemis';

  return WEAPON_FAMILY_PREFIXES.find(([prefix]) => item.id.startsWith(prefix))?.[1] ?? null;
};

export const getItemAmmoFamilyLabel = (item: Item): string => {
  const family = getItemAmmoFamily(item);
  return family ? AMMO_FAMILY_LABELS[family] ?? family : item.name;
};

export const isAmmoCompatibleWithWeapon = (ammo: Item, weapon: Item): boolean => {
  if (ammo.type !== 'ammo' || weapon.type !== 'weapon') return false;

  const ammoType = getItemAmmoType(ammo);
  const ammoFamily = getItemAmmoFamily(ammo);
  return ammoType !== null &&
    ammoType === getItemWeaponType(weapon) &&
    ammoFamily !== null &&
    ammoFamily === getItemAmmoFamily(weapon);
};
