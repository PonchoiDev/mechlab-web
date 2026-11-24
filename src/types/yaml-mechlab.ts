import type { Zone } from './mech';

// MechLab con las reglas del mod Yet Another Mechlab (YAML). Los datos salen de tools/generar_yaml.py;
// las reglas, de docs/specs/mechlab-yaml.md.

export type YamlHardpointType = 'ballistic' | 'energy' | 'missile' | 'omni' | 'ams' | 'melee' | 'artillery';

export interface YamlHardpoint {
  id: string;
  type: YamlHardpointType;
}

export interface YamlZoneData {
  // Ranuras generales (General_SlotType): las armas, la munición, los disipadores y los rellenos.
  general: number;
  // Actuadores fijos (hombro, brazo, antebrazo y mano; cadera, muslo, pierna y pie).
  actuators: string[];
  // Ranuras propias de cada tipo: motor, giroscopio, cabina, armadura, estructura, kit de refrigeración...
  special: Record<string, number>;
  hardpoints: YamlHardpoint[];
  maxArmor: number;
  structure: number;
  rear: boolean;
}

export interface YamlMountedItem {
  zone: Zone;
  slotType: string;
  item: string;
}

export interface YamlMountedWeapon {
  zone: Zone;
  hardpoint: string;
  item: string;
  tier?: number;
}

export interface YamlBuild {
  // La pieza de cada ranura propia (Engine, EngineTypeSlot, Gyro, cockpit, Armorslot, Structureslot,
  // enginecooling...); si falta, la estándar. Sin «Engine», el 'Mech no lleva núcleo de motor.
  internal: Record<string, string>;
  items: YamlMountedItem[];
  weapons: YamlMountedWeapon[];
  armor: Record<Zone, { front: number; rear: number }>;
}

// Movimiento del MDA: giro (°/s), giro del torso (°/s) y ángulos máximos del torso y los brazos (°).
export interface YamlMovement {
  turnSpeed: number;
  torsoTwistRate: number;
  torsoYaw: number;
  armYaw: number;
}

export interface YamlMech {
  id: string;
  chassis: string;
  variant: string;
  tonnage: number;
  dlc?: number;
  quirks: string[];
  zones: Record<Zone, YamlZoneData>;
  stock: YamlBuild;
  movement: YamlMovement;
}

export type YamlItemKind = 'weapon' | 'ammo' | 'equipment';

// Cifras de un nivel de un arma, con los quirks del nivel: daño y calor por disparo (por segundo en los rayos
// sin duración, como las ametralladoras), enfriamiento, duración del rayo o del golpe y alcances en metros.
export interface YamlWeaponTier {
  damage: number;
  heat: number;
  cooldown: number;
  duration?: number;
  optimalRange: number;
  maxRange: number;
}

export type YamlWeaponFamily = 'trace' | 'projectile' | 'missile' | 'ams' | 'melee';
// Cómo sale el alcance máximo (docs/specs/estadisticas-yaml.md): el doble o el triple del óptimo, el óptimo,
// el de los Gauss mejorados (el óptimo ya es el triple) o el máximo del asset.
export type YamlRangeRule = 'double' | 'optimal' | 'gauss' | 'gaussImproved' | 'max';

export interface YamlCombat {
  family: YamlWeaponFamily;
  weaponType: string;
  techBase: string;
  rangeRule: YamlRangeRule;
  // Por nivel: "1" es el asset sin sufijo y "0", "2"... los _LvlN.
  tiers: Record<string, YamlWeaponTier>;
  // Lo que dura la salva (ráfagas y misiles), que se suma al ciclo de disparo.
  volleyTime?: number;
  // AMS: misiles destruidos por segundo.
  amsRate?: number;
}

// Un grupo de bonificaciones de armas de un quirk o del equipo (Equipment_Properties.json).
export interface YamlWeaponGroup {
  tags: string[];
  excludeTags?: string[];
  mechParts?: string[];
  cooldownMulti?: number;
  heatMulti?: number;
  damageMulti?: number;
  durationMulti?: number;
  optimalRangeMulti?: number;
  maxRangeMulti?: number;
  missilesDestroyedMulti?: number;
}

export interface YamlItem {
  name: string;
  // Mod del que viene (yet-another-mechlab...); las del juego base no lo llevan.
  mod?: string;
  // Color propio en el mechlab (Equipment_Properties), si lo tiene.
  color?: string;
  kind: YamlItemKind;
  tons: number;
  slots: number;
  // Armas: el tipo de anclaje y el tipo de ranura que fija su tamaño.
  hardpoint?: YamlHardpointType;
  slotType?: string;
  // Armas: la munición que usan; munición: su tipo. Una caja sirve a las armas que usan su tipo.
  ammoTypes?: string[];
  ammoType?: string;
  // Cuerpo a cuerpo: el daño y el enfriamiento del golpe; las de los actuadores (la mano o el antebrazo) no
  // ocupan ranuras generales.
  meleeDamage?: number;
  cooldown?: number;
  actuator?: boolean;
  // Munición y equipo: los tipos de ranura donde se monta.
  slotTypes?: string[];
  category?: string;
  // Núcleos de motor: su potencia.
  rating?: number;
  // Ranuras de relleno: dinámicas (en cualquier ubicación) y fijas por ubicación.
  fillerSlots?: Partial<Record<Zone | 'dynamic', number>>;
  engineRelativeWeight?: number;
  relativeWeight?: number;
  structureWeightMulti?: number;
  structureMulti?: number;
  armorWeightMulti?: number;
  armorPerTon?: number;
  armorMulti?: number;
  engineHeatsinkEfficiency?: number;
  engineHeatsinkCapacity?: number;
  heatEfficiency?: number;
  cooling?: number;
  heatCapacity?: number;
  capacity?: number;
  fixed?: boolean;
  // Armas: sus estadísticas de combate por nivel.
  combat?: YamlCombat;
  // Equipo: bonificaciones a las armas (para todo el 'Mech o, con scope "component", para su ubicación), al
  // movimiento y a los sensores; las sondas y los computadores de puntería, su porcentaje de sensores.
  weapons?: { scope: string; groups: YamlWeaponGroup[] };
  turnSpeedMulti?: number;
  torsoTwistRateMulti?: number;
  torsoTwistRateYawMulti?: number;
  torsoTwistAngleMulti?: number;
  torsoTwistAngleYawMulti?: number;
  armTwistAngleMulti?: number;
  armTwistAngleYawMulti?: number;
  sensorRangeBonus?: number;
  sensorRangeMulti?: number;
  sensorRangePercent?: number;
}

export interface YamlQuirk {
  name: string;
  description: string;
  properties: Record<string, unknown>;
}
