import type { EquipRestriction } from '../utils/equipRestrictions';
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
  // Rasgos de 'Mech (mejoras de la cantina) instalados, por id de src/data/traits.json.
  traits?: string[];
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
  // El nombre del chasis en Sarna, si no es el mismo (el Puma es el Adder).
  sarnaName?: string;
  tonnage: number;
  dlc?: number;
  // SuperheavyCheck de YAML: 105 t o más y sin el quirk «ILLEGAL». Cambia las ranuras, los actuadores y el peso.
  superheavy?: boolean;
  quirks: string[];
  zones: Record<Zone, YamlZoneData>;
  stock: YamlBuild;
  movement: YamlMovement;
  // Huecos de rasgo del MDA de YAML (TotalTraitSlots).
  upgradeSlots: number;
  // Para repartir los rellenos dinámicos como BuildFillerEquipmentMapping: el orden en que el loadout guarda sus
  // ubicaciones y sus piezas con rellenos (las ranuras: Armorslot, Structureslot...).
  fillerZoneOrder?: Zone[];
  fillerOwners?: string[];
  // Los rellenos dinámicos que trae el loadout de serie (los de los mods), hasta el primer cambio de la build.
  stockFillers?: { zone: Zone; slotType: string; slots: number }[];
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
  // AMS: misiles destruidos por segundo.
  amsRate?: number;
  // Proyectiles y misiles: la velocidad del asset en m/s, con los quirks del nivel.
  speed?: number;
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
  // Munición que gasta cada salva, si no es 1 (los misiles, uno cada uno).
  ammoPerVolley?: number;
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
  speedMulti?: number;
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
  // Etiqueta del juego (EquipmentType) y restricciones de montaje: solo un computador de puntería, el TSM no va
  // con un MASC... (docs/specs/equipo-unico.md).
  category?: string;
  restrictions?: EquipRestriction[];
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
  sensorRangeBonusLance?: number;
  sensorRangeMultiLance?: number;
  // Sondas: lo que su SensorRangeModifier pasa de 1.
  sensorRangePercent?: number;
  // Armadura y estructura que suma a su ubicación (las armas cuerpo a cuerpo, por ejemplo); no pesan.
  armorComponentFront?: number;
  armorComponentRear?: number;
  structureComponent?: number;
  // Multiplicadores de la altura de salto (equipo y quirks).
  jumpJetFuelBurnTimeMulti?: number;
  jumpJetZAccelMulti?: number;
  // Lo que YAML lee de cada pieza para el peso, la refrigeración y la velocidad (docs/specs/estadisticas-yaml.md):
  // su TechLevel (lo que vale una propiedad que falta: TechLevel / 100) y si es un disipador (MWHeatSinkDataAsset).
  techLevel?: number;
  heatSinkAsset?: boolean;
  roundWeightType?: string;
  roundWeightUp?: number | boolean;
  coolingMulti?: number;
  coolingMultiScope?: string;
  heatCapacityBonus?: number;
  bundledHeatsinks?: number;
  internalHeatsinkBonus?: number;
  // DLCGetInstalledInternals: multiplica las ranuras de disipadores del motor de cada núcleo.
  engineHeatsinkMulti?: number;
  topSpeedMulti?: number;
  engineHealthType?: string;
  armorComponentFrontMulti?: number;
  armorComponentRearMulti?: number;
  structureComponentMulti?: number;
  componentArmorWeightMulti?: number;
  // Retrorreactores: velocidad inicial vertical (cm/s), tiempo de encendido (s) y curva de aceleración vertical
  // (cm/s² por número de retrorreactores montados).
  jumpJet?: { initialVelocityZ: number; burnTime: number; accelZ: [number, number][] };
}

export interface YamlQuirk {
  name: string;
  description: string;
  properties: Record<string, unknown>;
}
