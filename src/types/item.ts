// La artillería (Arrow IV) solo va en sus propios anclajes, ni en los de misiles ni en los omni.
export type WeaponType = 'energy' | 'ballistic' | 'missile' | 'artillery' | 'ams' | 'melee';

// Los anclajes omni de los omnimechs admiten armas de energía, balísticas o de misiles.
export type HardpointType = WeaponType | 'omni';

export type ItemSize = 'small' | 'medium' | 'large';

export type WeightClass = 'light' | 'medium' | 'heavy' | 'assault';

export interface ItemTierStats {
  damage: number;
  heatPerShot?: number;
  heat?: number;
  cooldown?: number;
  range?: number;
  maxRange?: number;
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
  slots?: number;
  damage?: number;
  heat?: number;
  cooling?: number;
  // MASC y Supercharger: aumento de velocidad mientras se usan (0.5 = +50 %).
  speedBoost?: number;
  capacity?: number;
  ammoType?: string;
  volleyProjectiles?: number;
  volleyHeatShots?: number;
  weightClass?: WeightClass;
  techBase?: string;
  ammoPerVolley?: number;
  tiers?: Record<string, ItemTierStats> | null;
  tier?: string;
}
