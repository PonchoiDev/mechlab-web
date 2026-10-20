import type { Item, ItemSize, WeaponType, WeightClass } from './item';

export interface Hardpoint {
  type: WeaponType;
  size: ItemSize;
  weightClass?: WeightClass;
  defaultWeapon?: string;
}

export interface ComponentData {
  maxSlots: number;
  jumpJetSlots: number;
  engineHeatsinkSlots?: number;
  specialSlots?: Record<string, number>;
  maxArmor: number;
  structure: number;
  hasRearArmor: boolean;
  hardpoints: Hardpoint[];
}

export interface MechComponents {
  head: ComponentData;
  centerTorso: ComponentData;
  leftTorso: ComponentData;
  rightTorso: ComponentData;
  leftArm: ComponentData;
  rightArm: ComponentData;
  leftLeg: ComponentData;
  rightLeg: ComponentData;
}

export type Zone = keyof MechComponents;

export interface Mech {
  id: string;
  name: string;
  variant: string;
  tonnageMax: number;
  baseTonnage: number;
  baseSpeed: number;
  BaseCoolingRate?: number;
  sarnaName?: string;
  techBase?: string;
  components: MechComponents;
}

export interface EquippedItem extends Item {
  instanceId: string;
  hardpointIndex?: number;
}

export type Loadout<T extends Item = Item> = Record<Zone, T[]>;

export type EquippedLoadout = Loadout<EquippedItem>;

export type ArmorState = Record<Zone, { front: number; rear: number }>;
