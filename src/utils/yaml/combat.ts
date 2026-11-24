import type { Zone } from '../../types/mech';
import type {
  YamlBuild, YamlCombat, YamlItem, YamlMech, YamlWeaponFamily, YamlWeaponGroup, YamlWeaponTier
} from '../../types/yaml-mechlab';
import { EMPTY_VALUE } from '../format';
import { getRangeStep, type RangeProfileEntry } from '../rangeRadar';
import { getYamlItem, getYamlQuirk } from './data';
import { getArmorPoints, getHeat, getStructurePoints, getTopSpeed } from './stats';

// Las estadísticas de combate del mechlab del juego con YAML (docs/specs/estadisticas-yaml.md). Las
// calcula el propio mod (MechAlphaStats de YAML y YAWFunctionsYAML) con las reglas de Yet Another Weapon:
// las cifras de cada nivel del arma, las bonificaciones de los quirks y del equipo y los ajustes por
// defecto de YAW.

// Ajustes por defecto de Yet Another Weapon (su gui_config.ini).
const GLOBAL_MAX_RANGE_MULTIPLIER = 2;
const PULSE_LASER_DURATION_MULTIPLIER = 0.7;
// YAWBallistic: los Gauss llegan a 1,5 veces el alcance máximo global.
const GAUSS_RANGE_MULTIPLIER = 1.5;
const MIN_COOLDOWN = 0.01;
// AddMulti de YAML: un multiplicador nunca baja de 0,001.
const MIN_MULTIPLIER = 0.001;
// El alcance de sensores de un 'Mech sin bonificaciones (GetSensorRange del juego, 80.000 cm).
const BASE_SENSOR_RANGE = 800;
const PULSE_LASER_TAG = 'Weapon.Energy.Laser.Pulse';
// Las ubicaciones con los nombres que usan los quirks en «mechParts».
const MECH_PART_NAMES: Record<Zone, string> = {
  head: 'Head', centerTorso: 'CenterTorso', leftTorso: 'LeftTorso', rightTorso: 'RightTorso',
  leftArm: 'LeftArm', rightArm: 'RightArm', leftLeg: 'LeftLeg', rightLeg: 'RightLeg'
};

export function getWeaponTiers(itemId: string): string[] {
  return Object.keys(getYamlItem(itemId)?.combat?.tiers ?? {}).sort((a, b) => Number(a) - Number(b));
}

// El nivel que se usa si no se elige otro: el 1 (el asset sin sufijo) o, si el arma no lo tiene, el primero.
export function getDefaultTier(itemId: string): number {
  const tiers = getWeaponTiers(itemId);
  return tiers.includes('1') || tiers.length === 0 ? 1 : Number(tiers[0]);
}

export function getWeaponTierStats(itemId: string, tier?: number): YamlWeaponTier | undefined {
  const tiers = getYamlItem(itemId)?.combat?.tiers;
  if (!tiers) return undefined;
  return tiers[String(tier ?? getDefaultTier(itemId))] ?? tiers[String(getDefaultTier(itemId))];
}

// Multiplicadores de un arma: 1 sin bonificaciones.
export interface YamlWeaponBonuses {
  damage: number;
  heat: number;
  cooldown: number;
  duration: number;
  optimalRange: number;
  maxRange: number;
  heatDamage: number;
  missilesDestroyed: number;
}

const BONUS_FIELDS: Record<keyof YamlWeaponBonuses, string> = {
  damage: 'damagemulti', heat: 'heatmulti', cooldown: 'cooldownmulti', duration: 'durationmulti',
  optimalRange: 'optimalrangemulti', maxRange: 'maxrangemulti', heatDamage: 'heatdamagemulti',
  missilesDestroyed: 'missilesdestroyedmulti'
};

// Lo que lleva montado el 'Mech: las piezas internas (en la ubicación de su ranura propia) y el equipo y la
// munición de las ranuras.
function mountedEquipment(mech: YamlMech, build: YamlBuild): { zone: Zone; item: YamlItem }[] {
  const zones = Object.keys(mech.zones) as Zone[];
  const internals = Object.entries(build.internal).map(([slotType, id]) => ({
    zone: zones.find(zone => (mech.zones[zone].special[slotType] ?? 0) > 0) ?? 'centerTorso',
    item: getYamlItem(id)
  }));
  const slotted = build.items.map(mounted => ({ zone: mounted.zone, item: getYamlItem(mounted.item) }));
  return [...internals, ...slotted].filter((entry): entry is { zone: Zone; item: YamlItem } => !!entry.item);
}

function quirkProperties(mech: YamlMech): Record<string, unknown>[] {
  return mech.quirks.map(id => getYamlQuirk(id)?.properties ?? {});
}

// Las bonificaciones al movimiento y a los sensores salen de todo lo montado y de los quirks.
function loadoutProperties(mech: YamlMech, build: YamlBuild): Record<string, unknown>[] {
  return [...mountedEquipment(mech, build).map(({ item }) => item as unknown as Record<string, unknown>), ...quirkProperties(mech)];
}

// AddMulti de YAML: los multiplicadores se suman (a + b − 1), no se multiplican.
function addMultipliers(values: number[]): number {
  return Math.max(MIN_MULTIPLIER, values.reduce((total, value) => total + value - 1, 1));
}

function sumMultiplier(properties: Record<string, unknown>[], ...names: string[]): number {
  return addMultipliers(properties.flatMap(entry => names.map(name => entry[name]).filter((value): value is number => typeof value === 'number')));
}

const startsWithAny = (prefixes: string[] | undefined, value: string) => (prefixes ?? []).some(prefix => value.startsWith(prefix));

// GetTotalWeaponBonusesForWeapon: un grupo vale para el arma si su etiqueta o su tecnología empiezan por una de
// sus etiquetas, o si su nombre sin nivel está entre ellas, salvo que la excluya igual.
function groupApplies(group: YamlWeaponGroup, itemId: string, combat: YamlCombat): boolean {
  const matches = (tags: string[] | undefined) =>
    startsWithAny(tags, combat.weaponType) || startsWithAny(tags, combat.techBase) || (tags ?? []).includes(itemId);
  return matches(group.tags) && !matches(group.excludeTags);
}

function weaponGroups(mech: YamlMech, build: YamlBuild, zone: Zone): YamlWeaponGroup[] {
  // Los quirks valen para todas las ubicaciones, salvo los grupos con «mechParts».
  const fromQuirks = quirkProperties(mech).flatMap(properties => {
    const weapons = properties.weapons as { groups?: YamlWeaponGroup[] } | undefined;
    return (weapons?.groups ?? []).filter(group => !group.mechParts?.length || group.mechParts.includes(MECH_PART_NAMES[zone]));
  });
  // El equipo vale para todo el 'Mech, salvo con scope «component», que solo vale en su ubicación.
  const fromEquipment = mountedEquipment(mech, build).flatMap(({ zone: itemZone, item }) =>
    item.weapons && (item.weapons.scope.toLowerCase() !== 'component' || itemZone === zone) ? item.weapons.groups : []);
  return [...fromQuirks, ...fromEquipment];
}

export function getWeaponBonuses(mech: YamlMech, build: YamlBuild, zone: Zone, itemId: string): YamlWeaponBonuses {
  const combat = getYamlItem(itemId)?.combat;
  const groups = combat ? weaponGroups(mech, build, zone).filter(group => groupApplies(group, itemId, combat)) : [];
  // Las claves del JSON no distinguen mayúsculas (un grupo de los mods escribe «damagemulti»).
  const lowered = groups.map(group => Object.fromEntries(Object.entries(group).map(([key, value]) => [key.toLowerCase(), value])));
  return Object.fromEntries(Object.entries(BONUS_FIELDS).map(([field, key]) => [field, sumMultiplier(lowered, key)])) as unknown as YamlWeaponBonuses;
}

export interface YamlWeaponPerformance {
  zone: Zone;
  hardpoint: string;
  item: string;
  name: string;
  tier: number;
  family: YamlWeaponFamily;
  // Daño y calor por disparo (por segundo en los rayos sin duración).
  damage: number;
  heat: number;
  cooldown: number;
  duration: number;
  dps: number;
  heatPerSecond: number;
  optimalRange: number;
  maxRange: number;
  // AMS: misiles destruidos por segundo.
  amsRate: number;
}

function maxRangeOf(combat: YamlCombat, stats: YamlWeaponTier, optimal: number, bonuses: YamlWeaponBonuses): number {
  switch (combat.rangeRule) {
    case 'double': return optimal * GLOBAL_MAX_RANGE_MULTIPLIER;
    case 'optimal': return optimal;
    case 'gauss': return optimal * GLOBAL_MAX_RANGE_MULTIPLIER * GAUSS_RANGE_MULTIPLIER;
    // Su óptimo ya lleva el multiplicador (optimalRangeOf).
    case 'gaussImproved': return optimal;
    case 'max': return stats.maxRange * bonuses.maxRange;
  }
}

// Los Gauss mejorados y los railguns llegan con todo su daño hasta el alcance máximo de los demás Gauss.
function optimalRangeOf(combat: YamlCombat, stats: YamlWeaponTier, bonuses: YamlWeaponBonuses): number {
  const optimal = stats.optimalRange * bonuses.optimalRange;
  return combat.rangeRule === 'gaussImproved' ? optimal * GLOBAL_MAX_RANGE_MULTIPLIER * GAUSS_RANGE_MULTIPLIER : optimal;
}

function weaponPerformance(mech: YamlMech, build: YamlBuild, zone: Zone, hardpoint: string, itemId: string, tier: number): YamlWeaponPerformance | null {
  const item = getYamlItem(itemId);
  const combat = item?.combat;
  const stats = getWeaponTierStats(itemId, tier);
  if (!item || !combat || !stats) return null;
  const bonuses = getWeaponBonuses(mech, build, zone, itemId);
  const optimalRange = optimalRangeOf(combat, stats, bonuses);
  const base = {
    zone, hardpoint, item: itemId, name: item.name, tier, family: combat.family,
    optimalRange, maxRange: maxRangeOf(combat, stats, optimalRange, bonuses), amsRate: 0
  };
  const cooldown = Math.max(MIN_COOLDOWN, stats.cooldown * bonuses.cooldown);
  if (combat.family === 'ams') {
    return { ...base, damage: 0, heat: 0, cooldown, duration: 0, dps: 0, heatPerSecond: 0, amsRate: (stats.amsRate ?? 0) * bonuses.missilesDestroyed };
  }
  if (combat.family === 'melee') {
    const damage = stats.damage * bonuses.damage;
    const meleeCooldown = stats.cooldown * bonuses.cooldown;
    const duration = stats.duration ?? 0;
    return { ...base, damage, heat: 0, cooldown: meleeCooldown, duration, dps: damage / (duration + meleeCooldown), heatPerSecond: 0 };
  }
  const heat = stats.heat * bonuses.heat;
  if (combat.family === 'trace') {
    const damage = stats.damage * bonuses.damage;
    // Rayos sin duración (ametralladoras, lanzallamas): su daño y su calor ya son por segundo.
    if (!stats.duration) return { ...base, damage, heat, cooldown: 0, duration: 0, dps: damage, heatPerSecond: heat };
    const pulse = combat.weaponType === PULSE_LASER_TAG || combat.weaponType.startsWith(`${PULSE_LASER_TAG}.`);
    const duration = stats.duration * bonuses.duration * (pulse ? PULSE_LASER_DURATION_MULTIPLIER : 1);
    const cycle = cooldown + duration;
    return { ...base, damage, heat, cooldown, duration, dps: damage / cycle, heatPerSecond: heat / cycle };
  }
  // YAWBallistic multiplica también el daño de balísticas y PPC por heatDamageMulti; YAWMissile no.
  const damage = stats.damage * bonuses.damage * (combat.family === 'projectile' ? bonuses.heatDamage : 1);
  const cycle = cooldown + (combat.volleyTime ?? 0);
  return { ...base, damage, heat, cooldown, duration: 0, dps: damage / cycle, heatPerSecond: heat / cycle };
}

// Las armas montadas, sin los ataques de los actuadores (manos y antebrazos), que el juego no cuenta.
export function getWeaponPerformance(mech: YamlMech, build: YamlBuild): YamlWeaponPerformance[] {
  return build.weapons
    .filter(mounted => !getYamlItem(mounted.item)?.actuator)
    .map(mounted => weaponPerformance(mech, build, mounted.zone, mounted.hardpoint, mounted.item, mounted.tier ?? getDefaultTier(mounted.item)))
    .filter((performance): performance is YamlWeaponPerformance => performance !== null);
}

const isRanged = (weapon: YamlWeaponPerformance) => weapon.family !== 'melee' && weapon.family !== 'ams';

// El daño de un arma a una distancia: todo hasta su alcance óptimo y en línea recta hasta 0 en el máximo
// (GlobalDamageScaleAtMaxRange de YAW es 0).
function damageAt(weapon: YamlWeaponPerformance, distance: number): number {
  if (distance <= weapon.optimalRange) return weapon.damage;
  if (distance >= weapon.maxRange) return 0;
  return weapon.damage * (weapon.maxRange - distance) / (weapon.maxRange - weapon.optimalRange);
}

export function getYamlDamageAt(weapons: YamlWeaponPerformance[], distance: number): number {
  return weapons.filter(isRanged).reduce((total, weapon) => total + damageAt(weapon, distance), 0);
}

export type YamlRangeState = 'full' | 'falloff' | 'out';

export function getYamlRangeState(weapon: YamlWeaponPerformance, distance: number): YamlRangeState {
  if (!isRanged(weapon)) return 'out';
  return distance <= weapon.optimalRange ? 'full' : distance < weapon.maxRange ? 'falloff' : 'out';
}

export function getYamlRangeProfile(weapons: YamlWeaponPerformance[]): RangeProfileEntry[] {
  const maxRange = Math.max(0, ...weapons.filter(isRanged).map(weapon => weapon.maxRange));
  if (maxRange === 0) return [];
  const step = getRangeStep(maxRange);
  return Array.from({ length: Math.ceil(maxRange / step) }, (_, index) => {
    const distance = (index + 1) * step;
    return { distance, damage: getYamlDamageAt(weapons, distance), belowMin: 0 };
  });
}

// Las cajas de munición montadas por tipo: cuántas y cuántos disparos suman, como en el análisis de MW5.
export function getYamlAmmunition(build: YamlBuild): { ammoType: string; label: string; bins: number; capacity: number }[] {
  const byType = new Map<string, { label: string; bins: number; capacity: number }>();
  for (const mounted of build.items) {
    const item = getYamlItem(mounted.item);
    if (item?.kind !== 'ammo') continue;
    const key = item.ammoType ?? mounted.item;
    const entry = byType.get(key) ?? { label: item.name, bins: 0, capacity: 0 };
    byType.set(key, { ...entry, bins: entry.bins + 1, capacity: entry.capacity + (item.capacity ?? 0) });
  }
  return [...byType.entries()].map(([ammoType, entry]) => ({ ammoType, ...entry }));
}

export interface YamlMechStats {
  armor: number;
  structure: number;
  meleeDamage: number;
  alphaDamage: number;
  dps: number;
  meleeDps: number;
  heatPerSecond: number;
  cooling: number;
  turnRate: number;
  alphaHeat: number;
  heatCapacity: number;
  torsoTwistRate: number;
  // Sin cifra con retrorreactores: el juego la estima con su empuje y aún no está calibrada.
  jumpHeight: number | null;
  speed: number;
  torsoYaw: number;
  weaponRange: number;
  sensorRange: number;
  armYaw: number;
  amsIntercept: number;
  amsRange: number;
  ammo: number;
}

// DecimalRounder de YAML: a un decimal.
const roundToTenth = (value: number) => Math.round(value * 10) / 10;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const average = (values: number[]) => values.length > 0 ? sum(values) / values.length : 0;

export function getYamlMechStats(mech: YamlMech, build: YamlBuild): YamlMechStats {
  const weapons = getWeaponPerformance(mech, build);
  const ranged = weapons.filter(isRanged);
  const melee = weapons.filter(weapon => weapon.family === 'melee');
  const ams = weapons.filter(weapon => weapon.family === 'ams');
  const properties = loadoutProperties(mech, build);
  const armor = getArmorPoints(mech, build);
  const heat = getHeat(mech, build);
  const equipment = mountedEquipment(mech, build).map(({ item }) => item);
  const sensorBase = (BASE_SENSOR_RANGE + sum(properties.map(entry => typeof entry.sensorRangeBonus === 'number' ? entry.sensorRangeBonus : 0)))
    * sumMultiplier(properties, 'sensorRangeMulti');
  const { movement } = mech;
  return {
    armor: armor.installed + armor.bonus,
    structure: getStructurePoints(mech, build).total,
    meleeDamage: average(melee.map(weapon => weapon.damage)),
    meleeDps: average(melee.map(weapon => weapon.dps)),
    alphaDamage: sum(ranged.map(weapon => weapon.damage)),
    alphaHeat: sum(ranged.map(weapon => weapon.heat)),
    dps: sum(ranged.map(weapon => weapon.dps)),
    heatPerSecond: sum(ranged.map(weapon => weapon.heatPerSecond)),
    cooling: heat.cooling,
    heatCapacity: heat.capacity,
    turnRate: roundToTenth(movement.turnSpeed * sumMultiplier(properties, 'turnSpeedMulti')),
    torsoTwistRate: roundToTenth(movement.torsoTwistRate * sumMultiplier(properties, 'torsoTwistRateMulti', 'torsoTwistRateYawMulti')),
    torsoYaw: movement.torsoYaw >= 360 ? 360 : roundToTenth(movement.torsoYaw * sumMultiplier(properties, 'torsoTwistAngleMulti', 'torsoTwistAngleYawMulti')),
    armYaw: roundToTenth(movement.armYaw * sumMultiplier(properties, 'armTwistAngleMulti', 'armTwistAngleYawMulti')),
    jumpHeight: equipment.some(item => item.slotTypes?.some(slotType => /jumpjet/i.test(slotType))) ? null : 0,
    speed: getTopSpeed(mech, build),
    // El juego redondea a centímetros y divide entre 100 como entero: 2.395,8 m es 2.395.
    weaponRange: Math.max(0, ...ranged.map(weapon => Math.trunc(Math.round(weapon.maxRange * 100) / 100))),
    // DLCMechSensorRange: las sondas y los computadores de puntería suman su porcentaje sobre el resto.
    sensorRange: sensorBase * (1 + sum(equipment.map(item => item.sensorRangePercent ?? 0))),
    amsIntercept: sum(ams.map(weapon => weapon.amsRate)),
    amsRange: Math.max(0, ...ams.map(weapon => weapon.maxRange)),
    ammo: sum(build.items.map(mounted => getYamlItem(mounted.item)).filter(item => item?.kind === 'ammo').map(item => item?.capacity ?? 0))
  };
}

// El panel de estadísticas del mechlab del juego (MechLabStatsPanelWidget): sus 21 cifras con sus títulos, en
// su orden de 7 filas de 3, y el tope de la barra de cada una. Las de calor llevan el tope en negativo en el
// juego (menos es mejor); aquí cuenta su valor absoluto. La munición llena siempre su barra.
interface PanelStat {
  key: keyof YamlMechStats;
  label: string;
  max: number | null;
}

const PANEL: PanelStat[][] = [
  [{ key: 'armor', label: 'Armor', max: 626 }, { key: 'structure', label: 'Structure', max: 300 }, { key: 'meleeDamage', label: 'Melee dmg avg', max: 300 }],
  [{ key: 'alphaDamage', label: 'Alpha damage', max: 150 }, { key: 'dps', label: 'Damage/s', max: 45 }, { key: 'meleeDps', label: 'Melee dmg/s avg', max: 150 }],
  [{ key: 'heatPerSecond', label: 'Weapon heat/s', max: 15 }, { key: 'cooling', label: 'Cooling heat/s', max: 6 }, { key: 'turnRate', label: 'Turn rate °/s', max: 250 }],
  [{ key: 'alphaHeat', label: 'Alpha heat', max: 75 }, { key: 'heatCapacity', label: 'Heat capacity', max: 100 }, { key: 'torsoTwistRate', label: 'Torso twist °/s', max: 300 }],
  [{ key: 'jumpHeight', label: 'Jump height (m)', max: 100 }, { key: 'speed', label: 'Speed (km/h)', max: 150 }, { key: 'torsoYaw', label: 'Torso yaw °', max: 160 }],
  [{ key: 'weaponRange', label: 'Weapon range (m)', max: 2000 }, { key: 'sensorRange', label: 'Sensor range (m)', max: 1500 }, { key: 'armYaw', label: 'Arm yaw °', max: 45 }],
  [{ key: 'amsIntercept', label: 'AMS intercept/s', max: 15 }, { key: 'amsRange', label: 'AMS range (m)', max: 300 }, { key: 'ammo', label: 'Ammo', max: null }]
];

export interface YamlStatCell {
  key: keyof YamlMechStats;
  label: string;
  value: string;
  // Lo lleno de la barra, de 0 a 1.
  ratio: number;
}

// Hasta dos decimales, sin ceros de más: 62.1, 16.47, 950. Como el texto de Unreal, los empates van al par
// (64,625 es 64.62 en el panel del CP-10-P), pero no lo que pasa un poco del empate (la cadencia del AMS de
// nivel 3, 4,025000095, es 4.03). El margen solo absorbe los errores de coma flotante de las cuentas.
export const formatYamlStat = (value: number) => {
  const scaled = value * 100;
  const floor = Math.floor(scaled);
  const isTie = Math.abs(scaled - floor - 0.5) < 1e-9;
  const rounded = isTie ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(scaled);
  return String(Number((rounded / 100).toFixed(2)));
};

export function getYamlStatsPanel(mech: YamlMech, build: YamlBuild): YamlStatCell[][] {
  const stats = getYamlMechStats(mech, build);
  return PANEL.map(row => row.map(({ key, label, max }) => {
    const value = stats[key];
    const ratio = value === null ? 0 : max === null ? (value > 0 ? 1 : 0) : Math.min(1, Math.max(0, value / max));
    return { key, label, value: value === null ? EMPTY_VALUE : formatYamlStat(value), ratio };
  }));
}
