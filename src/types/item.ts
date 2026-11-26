import type { EquipRestriction } from '../utils/equipRestrictions';
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
  // Velocidad del proyectil en m/s; los láseres no tienen.
  speed?: number;
  // Fabricante de este tier (la página de equipo lo enseña).
  manufacturer?: string;
}

// Efectos del equipo, en metros y en los multiplicadores del juego (generar_items.py).
export interface JumpJetStats {
  thrust: number;
  burnTime: number;
  regenTime: number;
  mechTonnage: [number, number] | null;
}

export interface EcmStats {
  disruptRange: number;
  counterRange: number;
  shielding: number;
  suppression: number;
  lrmSpread: number;
  streakTracking: number;
  aiAccuracy: number;
}

export interface ProbeStats {
  range: number;
  sensorRange: number;
  distortionReduction: number;
}

export interface MascStats {
  accel: number;
  turn: number;
  damagedParts: string[];
}

export interface TargetingComputerStats {
  sensorRange: number;
  projectileSpeed: number;
  laserRange: number;
}

export interface Item {
  id: string;
  name: string;
  // Las armas se llaman con su nombre abreviado del juego («C-ER L Laser», «AC/10 RF») y guardan aquí el
  // completo («Clan ER Large Laser»), para buscarlas por los dos.
  fullName?: string;
  // Nombre corto del juego de la munición y el equipo, si no es el mismo.
  shortName?: string;
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
  // Capacidad de calor que suma un disipador.
  heatCapacity?: number;
  // MASC y Supercharger: aumento de velocidad mientras se usan (0.5 = +50 %).
  speedBoost?: number;
  capacity?: number;
  ammoType?: string;
  volleyProjectiles?: number;
  volleyHeatShots?: number;
  // Etiqueta del juego del equipo (EquipmentType) y sus restricciones de montaje (docs/specs/equipo-unico.md).
  equipmentTag?: string;
  restrictions?: EquipRestriction[];
  weightClass?: WeightClass;
  techBase?: string;
  ammoPerVolley?: number;
  tiers?: Record<string, ItemTierStats> | null;
  tier?: string;
  dlc?: number;
  description?: string;
  explosionDamagePerRound?: number;
  jumpJet?: JumpJetStats;
  ecm?: EcmStats;
  probe?: ProbeStats;
  masc?: MascStats;
  targetingComputer?: TargetingComputerStats;
}
