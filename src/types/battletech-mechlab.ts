import type { Zone } from './mech';

// Tipos del MechLab de BATTLETECH (src/data/battletech/mechs.json, items.json y constants.json). Las
// ubicaciones usan las mismas claves que el MechLab de MW5 (head, centerTorso…).
export type BtSource = 'base' | 'heavymetal' | 'flashpoint' | 'urbanwarfare';
export type BtHardpoint = 'energy' | 'ballistic' | 'missile' | 'support';
export type BtItemKind = 'weapon' | 'ammo' | 'heatSink' | 'jumpJet' | 'upgrade';
export type BtWeightClass = 'light' | 'medium' | 'heavy' | 'assault';
export type BtUpgradeGroup = 'actuator' | 'cockpit' | 'gyro' | 'targeting' | 'electronic' | 'artillery' | 'general';

export interface BtEffect {
  stat: string;
  operation: string;
  value: number | string;
  target?: string;
  category?: string;
}

export interface BtWeaponStats {
  type: string;
  subType: string;
  damage: number;
  shots: number;
  heat: number;
  heatDamage: number;
  instability: number;
  accuracy: number;
  critChance: number;
  minRange: number;
  rangeSplit: number[];
  maxRange: number;
  ammoCategory: string | null;
  internalAmmo: number;
  indirectFire: boolean;
  refire: number;
  structureDamage?: number;
  evasionIgnored?: number;
}

export interface BtItem {
  id: string;
  name: string;
  baseName: string;
  plus: number;
  kind: BtItemKind;
  source: BtSource;
  manufacturer: string;
  tonnage: number;
  slots: number;
  locations: Zone[];
  cost: number;
  rarity: number;
  purchasable: boolean;
  bonuses: string[];
  lostech?: boolean;
  builtIn?: boolean;
  hardpoint?: BtHardpoint;
  weapon?: BtWeaponStats;
  ammo?: { category: string | null; capacity: number };
  heatSink?: { dissipation: number; maxHeat: number; overheat: number; weaponHeatMultiplier: number };
  jumpJet?: { capacity: number; minTonnage: number; maxTonnage: number };
  group?: BtUpgradeGroup;
  effects?: BtEffect[];
}

export interface BtLocation {
  hardpoints: BtHardpoint[];
  slots: number;
  maxArmor: number;
  maxRearArmor: number | null;
  structure: number;
}

export interface BtMech {
  id: string;
  chassisId: string;
  name: string;
  variant: string;
  source: BtSource;
  tonnage: number;
  initialTonnage: number;
  weightClass: BtWeightClass;
  role: string;
  description: string;
  icon: string | null;
  maxJumpJets: number;
  chassisHeatsinks: number;
  stability: number;
  melee: { damage: number; instability: number };
  dfa: { damage: number; selfDamage: number; instability: number };
  walk: number | null;
  sprint: number | null;
  chassisCost: number;
  stockCost: number;
  tags: string[];
  locations: Record<Zone, BtLocation>;
  fixed: [Zone, string][];
  stock: { armor: Record<Zone, [number, number]>; items: [Zone, string][] };
}

export interface BtConstants {
  internalHeatSinks: number;
  internalHeatSinkDissipation: number;
  maxHeat: number;
  overheatLevel: number;
  jumpHeatMin: number;
  jumpHeatUnitSize: number;
  jumpHeatPerUnit: number;
  tonnagePerArmorPoint: number;
  armorStep: number;
  cbillsPerArmorPoint: number;
  armorRatios: Record<Zone, [number, number]>;
}

// El equipo montado por ubicación, como ids del catálogo y sin el equipo fijo del chasis.
export type BtLoadout = Record<Zone, string[]>;
export type BtArmor = Record<Zone, { front: number; rear: number }>;
export type BtArmorSide = 'front' | 'rear';

export interface BtBuild {
  mech: BtMech;
  loadout: BtLoadout;
  armor: BtArmor;
}
