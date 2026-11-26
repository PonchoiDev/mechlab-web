import type { Zone } from '../../types/mech';
import type {
  YamlBuild, YamlCombat, YamlItem, YamlMech, YamlWeaponFamily, YamlWeaponGroup, YamlWeaponTier
} from '../../types/yaml-mechlab';
import { getRangeStep, type RangeProfileEntry } from '../rangeRadar';
import { getYamlItem } from './data';
import { getTraitMultiplier, getTraitPercent } from './traits';
import {
  getArmorPoints, getHeat, getInstalledEquipment, getLoadoutProperties, getQuirkProperties, getStructurePoints, getTopSpeed
} from './stats';

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
const LASER_AMS_TAG = 'Weapon.AMS.LAMS';
// Las etiquetas del juego son jerárquicas (HasTag sin coincidencia exacta).
const hasTag = (tag: string, parent: string) => tag === parent || tag.startsWith(`${parent}.`);
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

const mountedEquipment = getInstalledEquipment;
const quirkProperties = getQuirkProperties;
const loadoutProperties = getLoadoutProperties;

// AddMulti de YAML: los multiplicadores se suman (a + b − 1), no se multiplican.
// El juego calcula en coma flotante de 32 bits, y eso decide los empates al redondear el panel: siete Medium
// Laser de nivel 3 dan 14,1749999 de calor alfa (14.17) y la media de cuerpo a cuerpo del CP-10-P, 64,625 justos
// (64.62, con el redondeo al par de Unreal). Las cuentas de las armas van en float32 (f).
const f = Math.fround;

function addMultipliers(values: number[]): number {
  return Math.max(MIN_MULTIPLIER, values.reduce((total, value) => f(total + f(f(value) - 1)), 1));
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
  // Segundos entre salva y salva disparando sin parar: el ciclo del daño por segundo o, en los rayos sin
  // duración, el enfriamiento (cada uno gasta una bala).
  cycle: number;
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
  const cooldown = Math.max(MIN_COOLDOWN, f(f(stats.cooldown) * bonuses.cooldown));
  // GetAlphaStrikeStats: disparos por minuto = 60 / ciclo, y por segundo, × valor / 60.
  const perSecond = (value: number, cycle: number) => f(f(value * f(60 / cycle)) / 60);
  if (combat.family === 'ams') {
    return { ...base, damage: 0, heat: 0, cooldown, duration: 0, dps: 0, heatPerSecond: 0, cycle: cooldown, amsRate: f(f(stats.amsRate ?? 0) * bonuses.missilesDestroyed) };
  }
  if (combat.family === 'melee') {
    const damage = f(f(stats.damage) * bonuses.damage);
    const meleeCooldown = f(f(stats.cooldown) * bonuses.cooldown);
    const duration = f(stats.duration ?? 0);
    const cycle = f(duration + meleeCooldown);
    return { ...base, damage, heat: 0, cooldown: meleeCooldown, duration, dps: perSecond(damage, cycle), heatPerSecond: 0, cycle };
  }
  const heat = f(f(stats.heat) * bonuses.heat);
  if (combat.family === 'trace') {
    const damage = f(f(stats.damage) * bonuses.damage);
    // Rayos sin duración (ametralladoras, lanzallamas): su daño y su calor ya son por segundo.
    if (!stats.duration) return { ...base, damage, heat, cooldown: 0, duration: 0, dps: damage, heatPerSecond: heat, cycle: cooldown };
    // YAWTrace: los láseres de pulsos y los AMS láser ofensivos (YAWCE AMS Type 0, nombre con «Offensive»).
    const pulse = hasTag(combat.weaponType, PULSE_LASER_TAG) || (hasTag(combat.weaponType, LASER_AMS_TAG) && /offensive/i.test(itemId));
    const duration = f(f(f(stats.duration) * bonuses.duration) * f(pulse ? PULSE_LASER_DURATION_MULTIPLIER : 1));
    const cycle = f(cooldown + duration);
    return { ...base, damage, heat, cooldown, duration, dps: perSecond(damage, cycle), heatPerSecond: perSecond(heat, cycle), cycle };
  }
  // YAWBallistic multiplica también el daño de balísticas y PPC por heatDamageMulti; YAWMissile no.
  const damage = f(f(f(stats.damage) * bonuses.damage) * (combat.family === 'projectile' ? bonuses.heatDamage : 1));
  const cycle = f(cooldown + f(combat.volleyTime ?? 0));
  return { ...base, damage, heat, cooldown, duration: 0, dps: perSecond(damage, cycle), heatPerSecond: perSecond(heat, cycle), cycle };
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
export interface YamlAmmunitionGroup {
  ammoType: string;
  label: string;
  bins: number;
  capacity: number;
  // Como en el MechLab de MW5 (groupAmmunition): salvas disparando a la vez todas las armas que la usan, segundos
  // de fuego sin parar y el daño de todas las salvas. null si no la usa ningún arma montada.
  volleys: number | null;
  seconds: number | null;
  potentialDamage: number | null;
}

// Las ametralladoras hacen su daño por segundo pero gastan una bala cada enfriamiento: cada bala hace lo de
// un enfriamiento. El MML usa dos municiones y cuenta en las dos, como si disparara cada una.
export function getYamlAmmunition(mech: YamlMech, build: YamlBuild): YamlAmmunitionGroup[] {
  const byType = new Map<string, { label: string; bins: number; capacity: number }>();
  for (const mounted of build.items) {
    const item = getYamlItem(mounted.item);
    if (item?.kind !== 'ammo') continue;
    const key = item.ammoType ?? mounted.item;
    const entry = byType.get(key) ?? { label: item.name, bins: 0, capacity: 0 };
    byType.set(key, { ...entry, bins: entry.bins + 1, capacity: entry.capacity + (item.capacity ?? 0) });
  }
  const weapons = byType.size > 0 ? getWeaponPerformance(mech, build) : [];
  return [...byType.entries()].map(([ammoType, entry]) => {
    const users = weapons.filter(weapon => getYamlItem(weapon.item)?.ammoTypes?.includes(ammoType));
    const perVolley = (weapon: YamlWeaponPerformance) => getYamlItem(weapon.item)?.combat?.ammoPerVolley ?? 1;
    const ammoPerVolley = users.reduce((sum, weapon) => sum + perVolley(weapon), 0);
    const ammoPerSecond = users.reduce((sum, weapon) => sum + (weapon.cycle > 0 ? perVolley(weapon) / weapon.cycle : 0), 0);
    const volleyDamage = users.reduce((sum, weapon) => sum + (weapon.family === 'trace' && weapon.duration === 0 ? weapon.damage * weapon.cycle : weapon.damage), 0);
    const volleys = ammoPerVolley > 0 ? Math.floor(entry.capacity / ammoPerVolley) : null;
    return {
      ammoType, ...entry, volleys,
      seconds: ammoPerSecond > 0 ? Math.round(entry.capacity / ammoPerSecond) : null,
      potentialDamage: volleys === null ? null : volleys * volleyDamage
    };
  });
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
  jumpHeight: number;
  speed: number;
  torsoYaw: number;
  weaponRange: number;
  sensorRange: number;
  armYaw: number;
  amsIntercept: number;
  amsRange: number;
  ammo: number;
}

// Una curva lineal de Unreal: interpola entre sus claves y, fuera de ellas, se queda en la primera o la última.
function evalLinearCurve(keys: [number, number][], x: number): number {
  if (keys.length === 0) return 0;
  if (x <= keys[0][0]) return keys[0][1];
  for (let index = 1; index < keys.length; index++) {
    const [x1, y1] = keys[index];
    if (x <= x1) {
      const [x0, y0] = keys[index - 1];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return keys[keys.length - 1][1];
}

// La altura de salto en metros. EstimateMaxJumpJetHeight, código nativo del juego desensamblado del ejecutable,
// es el tiro vertical h = v0·t + ½·a·t² en cm, truncado: v0 es la velocidad inicial vertical del retrorreactor, t
// su tiempo de encendido y a su curva de aceleración evaluada en el número de retrorreactores montados (con la
// de los rasgos del 'Mech: × (1 + Jump Jet Thrust)). Si hay varios tipos, cuenta el último que recorre. YAML
// (EstimateJumpJetHeightFromLoadout) la multiplica por las bonificaciones de combustible y empuje vertical y la
// redondea, y el panel la pasa a metros con una división entera.
function getJumpHeight(equipment: YamlItem[], properties: Record<string, unknown>[], traitMulti: number): number {
  const jets = equipment.filter(item => item.jumpJet);
  if (jets.length === 0) return 0;
  const { initialVelocityZ, burnTime, accelZ } = jets[jets.length - 1].jumpJet!;
  const time = f(burnTime);
  const acceleration = f(f(evalLinearCurve(accelZ, jets.length)) * traitMulti);
  const estimate = Math.trunc(f(f(f(f(time * time) * acceleration) * 0.5) + f(time * f(initialVelocityZ))));
  const centimetres = Math.round(f(f(sumMultiplier(properties, 'jumpJetFuelBurnTimeMulti') * estimate) * sumMultiplier(properties, 'jumpJetZAccelMulti')));
  return Math.trunc(centimetres / 100);
}

// DecimalRounder de YAML: a un decimal.
const roundToTenth = (value: number) => Math.round(value * 10) / 10;
// VictoryFloatPlusEquals: sumas en float32.
const sum = (values: number[]) => values.reduce((total, value) => f(total + value), 0);
const average = (values: number[]) => values.length > 0 ? f(sum(values) / values.length) : 0;

export function getYamlMechStats(mech: YamlMech, build: YamlBuild): YamlMechStats {
  const weapons = getWeaponPerformance(mech, build);
  const ranged = weapons.filter(isRanged);
  const melee = weapons.filter(weapon => weapon.family === 'melee');
  const ams = weapons.filter(weapon => weapon.family === 'ams');
  const properties = loadoutProperties(mech, build);
  const armor = getArmorPoints(mech, build);
  const heat = getHeat(mech, build);
  const equipment = mountedEquipment(mech, build).map(({ item }) => item);
  // GetSensorRange del juego: la base (MW.TargetSystem.DefaultSensorRange, 80.000 cm) × (1 + los rasgos con
  // UI_GetIncreasedSensorRangePercent). Solo recorre los InstalledTraits del loadout, los de la cantina: el rasgo
  // de los computadores de puntería lo da su pieza y no cuenta.
  // GetSensorBonusesFromLoadout de YAML suma los sensorRangeBonus del equipo y los quirks (también los de lanza) y
  // suma sus multiplicadores.
  const gameSensorRange = f(BASE_SENSOR_RANGE * Math.max(0, 1 + getTraitPercent(build, 'sensorRange')));
  const numberOf = (entry: Record<string, unknown>, key: string) => typeof entry[key] === 'number' ? entry[key] as number : 0;
  const sensorBonus = sum(properties.flatMap(entry => [numberOf(entry, 'sensorRangeBonus'), numberOf(entry, 'sensorRangeBonusLance')]));
  const sensorBase = f(f(gameSensorRange + sensorBonus) * sumMultiplier(properties, 'sensorRangeMulti', 'sensorRangeMultiLance'));
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
    // GetTurnSpeed y GetTorsoTwistSpeed del juego llevan ya los rasgos; YAML multiplica por sus bonificaciones.
    turnRate: roundToTenth(f(movement.turnSpeed * getTraitMultiplier(build, 'turnSpeed')) * sumMultiplier(properties, 'turnSpeedMulti')),
    torsoTwistRate: roundToTenth(f(movement.torsoTwistRate * getTraitMultiplier(build, 'torsoTwist')) * sumMultiplier(properties, 'torsoTwistRateMulti', 'torsoTwistRateYawMulti')),
    torsoYaw: movement.torsoYaw >= 360 ? 360 : roundToTenth(movement.torsoYaw * sumMultiplier(properties, 'torsoTwistAngleMulti', 'torsoTwistAngleYawMulti')),
    armYaw: roundToTenth(movement.armYaw * sumMultiplier(properties, 'armTwistAngleMulti', 'armTwistAngleYawMulti')),
    jumpHeight: getJumpHeight(equipment, properties, getTraitMultiplier(build, 'jumpAccelZ')),
    speed: getTopSpeed(mech, build),
    // El juego redondea a centímetros y divide entre 100 como entero: 2.395,8 m es 2.395.
    weaponRange: Math.max(0, ...ranged.map(weapon => Math.trunc(Math.round(weapon.maxRange * 100) / 100))),
    // DLCMechSensorRange de YAML: las sondas suman sobre el resto lo que su SensorRangeModifier pasa de 1.
    sensorRange: f(sensorBase + f(sensorBase * sum(equipment.map(item => item.sensorRangePercent ?? 0)))),
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

// Como MechStatWidget del mechlab (Conv_FloatToText: HalfToEven, separador de miles y de 0 a 2 decimales):
// 62.1, 16.47, 2,395. Un empate exacto va al par (64,625 es 64.62); lo que el float32 deja un poco por encima o
// por debajo, no (4,025000095 es 4.03).
const STAT_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const formatYamlStat = (value: number) => {
  const scaled = value * 100;
  const floor = Math.floor(scaled);
  const rounded = scaled - floor === 0.5 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(scaled);
  return STAT_FORMAT.format(rounded / 100);
};

export function getYamlStatsPanel(mech: YamlMech, build: YamlBuild): YamlStatCell[][] {
  const stats = getYamlMechStats(mech, build);
  return PANEL.map(row => row.map(({ key, label, max }) => {
    const value = stats[key];
    const ratio = max === null ? (value > 0 ? 1 : 0) : Math.min(1, Math.max(0, value / max));
    return { key, label, value: formatYamlStat(value), ratio };
  }));
}
