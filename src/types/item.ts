export type WeaponType = 'energy' | 'ballistic' | 'missile' | 'ams' | 'melee';

export type ItemSize = 'small' | 'medium' | 'large';

export interface ItemTierStats {
  damage: number;
  heatPerShot?: number;
  heat?: number;
  cooldown?: number;
  range?: number;
  rpm?: number;
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'equipment' | 'ammo';
  equipmentType?: 'jumpJet';
  specialSlotTypes?: string[];
  equippedSlotType?: string;
  weaponType?: WeaponType | null;
  size: ItemSize;
  tonnage: number;
  slots: number;
  damage?: number;
  heat?: number;
  cooling?: number;
  capacity?: number;
  tiers?: Record<string, ItemTierStats> | null;
  tier?: string;
}
