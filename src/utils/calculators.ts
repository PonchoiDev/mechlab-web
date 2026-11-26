import type { Item } from '../types/item';
import type { ArmorState, Loadout, Mech, MechComponents, Zone } from '../types/mech';
import type { Upgrade } from '../types/upgrade';
import { getHardpointViews } from './equipment';
import { getAmmoLabel, isJumpJet } from './items';
import { getUpgradeModifiers, getWeaponBonus, NO_UPGRADE_MODIFIERS, type UpgradeModifiers } from './upgrades';
import { getRangeStep } from './rangeRadar';
import { mapZones } from './zones';

const ARMOR_POINTS_PER_TON = 32;
// Comprobado en el juego con el HGN-732 (Esfera Interior) y el HBR-A (Clan): 12 % más que la estándar.
const FERRO_FIBROUS_POINTS_PER_TON = 35.84;
const ARMOR_FILL_ORDER: Zone[] = [
  'head', 'centerTorso', 'leftTorso', 'rightTorso', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm'
];
const DEFAULT_REAR_ARMOR_RATIO = 1 / 3;
const GAME_SPEED_DISPLAY_FACTOR = 7 / 6;

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const armorPointsToTons = (points: number, pointsPerTon = ARMOR_POINTS_PER_TON): number => points / pointsPerTon;

export const getArmorPointsPerTon = (mech: Pick<Mech, 'armorType'>): number =>
  mech.armorType === 'ferroFibrous' ? FERRO_FIBROUS_POINTS_PER_TON : ARMOR_POINTS_PER_TON;

// El juego trunca las cifras en vez de redondearlas (69,9375 t se muestra como 69,93).
// Refined Armor sube los puntos sin cambiar el peso. La armadura se guarda en puntos base y el juego
// muestra cada lado de cada componente multiplicado y truncado (56 -> 57 con +2,5 %), y el total de
// arriba sin truncar (528 -> 541,2).
export const scaleArmorPoints = (points: number, scale: number): number => truncateTo(points * scale, 0);

// Punto base más bajo que llega a un valor mostrado con la mejora (57 con +2,5 % -> 56).
export const unscaleArmorPoints = (shown: number, scale: number): number => Math.ceil(shown / scale - 1e-9);

export const formatArmorPoints = (points: number): string => String(Number(points.toFixed(2)));

export const getArmorScale = (upgrades: Upgrade[]): number => 1 + getUpgradeModifiers(upgrades).armor;

// Giro de pie y del torso con tres cifras significativas, como el juego (107,72 -> 108; 64,74 -> 64,7).
export const formatTurnRate = (value: number): string => String(Number(value.toPrecision(3)));

// Refrigeración con un decimal, o dos si los tiene, como el juego (3.0, 2.21).
export const formatCoolingRate = (rate: number): string => {
  const twoDecimals = rate.toFixed(2);
  return twoDecimals.endsWith('0') ? rate.toFixed(1) : twoDecimals;
};

export const truncateTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.floor(value * factor + 1e-6) / factor;
};

const sumBy = <T>(values: T[], getValue: (value: T) => number): number =>
  values.reduce((total, value) => total + getValue(value), 0);

const getEquippedItems = (loadout: Loadout): Item[] => Object.values(loadout).flat();

const getTierStats = (item: Item) =>
  item.tiers?.[item.tier ?? '1'] ?? item.tiers?.['1'];

const getWeaponDamage = (item: Item): number =>
  (getTierStats(item)?.damage ?? item.damage ?? 0) * (item.volleyProjectiles ?? 1);

const getWeaponHeat = (item: Item): number => {
  const stats = getTierStats(item);
  return (stats?.heatPerShot ?? stats?.heat ?? item.heat ?? 0) * (item.volleyHeatShots ?? 1);
};

export interface WeaponPerformance {
  zone: Zone;
  item: Item;
  damage: number;
  heat: number;
  rpm: number;
  dps: number;
  range: number | null;
  maxRange: number | null;
  // Velocidad del proyectil en m/s; null en los láseres.
  speed: number | null;
  // Daño por salva entre el tonelaje del arma, sin la munición: compara también las de energía.
  damagePerTon: number | null;
}

export const calculateEquippedWeight = (loadout: Loadout): number =>
  sumBy(getEquippedItems(loadout), item => item.tonnage);

export const calculateArmorPoints = (armor: ArmorState): number =>
  sumBy(Object.values(armor), zone => zone.front + zone.rear);

export const calculateArmorWeight = (armor: ArmorState, pointsPerTon = ARMOR_POINTS_PER_TON): number =>
  armorPointsToTons(calculateArmorPoints(armor), pointsPerTon);

export const createDefaultArmor = (components: MechComponents): ArmorState =>
  mapZones(zone => {
    const rear = components[zone].hasRearArmor
      ? Math.round(components[zone].maxArmor * DEFAULT_REAR_ARMOR_RATIO)
      : 0;

    return { front: components[zone].maxArmor - rear, rear };
  });

export const clampArmorValue = (value: number, otherSideValue: number, maxArmor: number): number =>
  Math.min(Math.max(value, 0), maxArmor - otherSideValue);

const getAffordableArmorPoints = (availableTonnage: number, pointsPerTon: number): number => {
  let points = Math.max(0, Math.floor(availableTonnage * pointsPerTon));

  while (armorPointsToTons(points + 1, pointsPerTon) <= availableTonnage) points += 1;
  while (points > 0 && armorPointsToTons(points, pointsPerTon) > availableTonnage) points -= 1;

  return points;
};

export const maximizeArmor = (
  components: MechComponents,
  availableTonnage: number,
  currentArmor: ArmorState,
  pointsPerTon = ARMOR_POINTS_PER_TON
): ArmorState => {
  const pointsByZone = mapZones(() => 0);
  let pointsRemaining = Math.min(
    getAffordableArmorPoints(availableTonnage, pointsPerTon),
    sumBy(ARMOR_FILL_ORDER, zone => components[zone].maxArmor)
  );

  while (pointsRemaining > 0) {
    let allocatedInRound = false;

    for (const zone of ARMOR_FILL_ORDER) {
      if (pointsRemaining === 0) break;
      if (pointsByZone[zone] >= components[zone].maxArmor) continue;

      pointsByZone[zone] += 1;
      pointsRemaining -= 1;
      allocatedInRound = true;
    }

    if (!allocatedInRound) break;
  }

  return mapZones(zone => {
    const previousTotal = currentArmor[zone].front + currentArmor[zone].rear;
    const rearRatio = !components[zone].hasRearArmor
      ? 0
      : previousTotal > 0
        ? currentArmor[zone].rear / previousTotal
        : DEFAULT_REAR_ARMOR_RATIO;
    const rear = Math.round(pointsByZone[zone] * rearRatio);

    return { front: pointsByZone[zone] - rear, rear };
  });
};

// La refrigeración base es el BaseCoolingRate del MDA, también en los 'Mechs con dobles: el juego no
// dobla los disipadores del motor (un MAL-1R vacío refrigera 1 y un FS9-X1 0,84). Los mods que lo
// corrigen, como QOL Upgrades 2, dan más. El juego la enseña con dos decimales.
export const calculateCoolingRate = (loadout: Loadout, baseCoolingRate?: number): number | null =>
  baseCoolingRate === undefined
    ? null
    : roundTo(baseCoolingRate + sumBy(getEquippedItems(loadout), item => item.cooling ?? 0), 2);

export const calculateTopSpeed = (baseSpeed: number, speedBonus = 0): number =>
  roundTo(baseSpeed * GAME_SPEED_DISPLAY_FACTOR * (1 + speedBonus), 1);

export const calculateBoostedSpeed = (loadout: Loadout, baseSpeed: number, speedBonus = 0): number | null => {
  const boost = Math.max(0, ...getEquippedItems(loadout).map(item => item.speedBoost ?? 0));
  return boost > 0 ? roundTo(baseSpeed * GAME_SPEED_DISPLAY_FACTOR * (1 + speedBonus) * (1 + boost), 1) : null;
};

export type WeaponStats = Omit<WeaponPerformance, 'zone' | 'item'>;

// Lo que hace un arma en un segundo disparando sin parar. Las ametralladoras y los lanzallamas son
// rayos sin duración: su daño y su calor ya son por segundo, aunque disparen 600 veces por minuto.
const perSecond = (item: Item, value: number, rpm: number): number =>
  item.continuous ? value : value * rpm / 60;

export const getWeaponStats = (item: Item): WeaponStats => {
  const stats = getTierStats(item);
  const damage = getWeaponDamage(item);
  const rpm = stats?.rpm ?? (stats?.cooldown ? 60 / stats.cooldown : 0);

  return {
    damage,
    heat: getWeaponHeat(item),
    rpm,
    dps: perSecond(item, damage, rpm),
    damagePerTon: item.tonnage > 0 ? damage / item.tonnage : null,
    range: stats?.range ?? null,
    maxRange: stats?.maxRange ?? stats?.range ?? null,
    speed: stats?.speed ?? null
  };
};

// Con las mejoras de la cantina, cada tipo de arma cambia su daño, alcance (y velocidad del proyectil),
// cooldown y calor en su porcentaje. Reduced Heat Spikes multiplica además el calor de todas.
const applyWeaponModifiers = (item: Item, stats: WeaponStats, modifiers: UpgradeModifiers): WeaponStats => {
  const bonus = (stat: Parameters<typeof getWeaponBonus>[1]) => getWeaponBonus(modifiers, stat, item.weaponType);
  const [damageBonus, rangeBonus, cooldownBonus, heatBonus] = [bonus('damage'), bonus('range'), bonus('cooldown'), bonus('heat')];
  if (damageBonus === 0 && rangeBonus === 0 && cooldownBonus === 0 && heatBonus === 0 && modifiers.heatGeneration === 0) return stats;
  const damage = stats.damage * (1 + damageBonus);
  // Menos cooldown, más disparos por minuto.
  const rpm = stats.rpm / (1 + cooldownBonus);
  const scaleRange = (value: number | null) => value === null ? null : value * (1 + rangeBonus);
  return {
    damage,
    heat: stats.heat * (1 + heatBonus) * (1 + modifiers.heatGeneration),
    rpm,
    dps: perSecond(item, damage, rpm),
    damagePerTon: item.tonnage > 0 ? damage / item.tonnage : null,
    range: scaleRange(stats.range),
    maxRange: scaleRange(stats.maxRange),
    speed: scaleRange(stats.speed)
  };
};

export const getWeaponPerformance = (loadout: Loadout, modifiers = NO_UPGRADE_MODIFIERS): WeaponPerformance[] =>
  (Object.entries(loadout) as [Zone, Item[]][]).flatMap(([zone, items]) => items
    .filter(item => item.type === 'weapon')
    .map(item => ({ zone, item, ...applyWeaponModifiers(item, getWeaponStats(item), modifiers) })));

const isMeleeWeapon = (item: Item) => item.weaponType === 'melee';

// Potencia de fuego de las armas a distancia; el cuerpo a cuerpo se cuenta aparte (calculateMeleeDamage).
export const calculateFirepower = (loadout: Loadout, modifiers = NO_UPGRADE_MODIFIERS): number =>
  roundTo(sumBy(getWeaponPerformance(loadout, modifiers).filter(weapon => !isMeleeWeapon(weapon.item)), weapon => weapon.damage), 1);

// Daño cuerpo a cuerpo: las armas cuerpo a cuerpo montadas y los anclajes vacíos, que pegan con la
// mano (como el Hammerfist de su clase), el antebrazo (la mitad) o el puño especial (como los Knuckles).
// El mechlab del juego lo suma a la potencia de fuego; aquí se muestra aparte. Las mejoras de daño
// cuerpo a cuerpo (Damage Tuning) cuentan también para los puñetazos.
const HAND_DAMAGE = { light: 10, medium: 15, heavy: 20, assault: 25 };
const FIST_DAMAGE = { light: 15, medium: 20, heavy: 25, assault: 30 };

export const calculateMeleeDamage = (mech: Mech, loadout: Loadout, modifiers = NO_UPGRADE_MODIFIERS): number =>
  roundTo((1 + getWeaponBonus(modifiers, 'damage', 'melee')) * sumBy(Object.keys(mech.components) as Zone[], zone =>
    sumBy(getHardpointViews(mech.components[zone].hardpoints, loadout[zone]), view => {
      const { hardpoint } = view;
      if (hardpoint.type !== 'melee') return 0;
      if (view.weapon) return getWeaponStats(view.weapon).damage;
      const weightClass = hardpoint.weightClass ?? 'medium';
      if (hardpoint.defaultWeapon) return FIST_DAMAGE[weightClass];
      return hardpoint.size === 'small' ? HAND_DAMAGE[weightClass] / 2 : HAND_DAMAGE[weightClass];
    })), 1);

export const calculateHeatSpike = (loadout: Loadout, modifiers = NO_UPGRADE_MODIFIERS): number =>
  roundTo(sumBy(getWeaponPerformance(loadout, modifiers), weapon => weapon.heat), 1);

// Capacidad de calor: la del chasis más la de cada disipador montado (doble 2, simple 1). Comprobado
// en el juego: DRG-1G-S 50 + 6 dobles + 4 simples = 66; BLR-1P 40 + 3 dobles + 5 simples = 51.
export const calculateHeatCapacity = (mech: Mech, loadout: Loadout): number | null =>
  mech.baseHeatCapacity === undefined
    ? null
    : mech.baseHeatCapacity + sumBy(getEquippedItems(loadout), item => item.heatCapacity ?? 0);

// Valores que el resumen del juego muestra iguales en todos los mechs.
const SENSOR_RANGE = 800;
const LOCK_RETENTION_TIME = 2;
const LOSE_LOCK_TIME = 1.35;

export interface AmmunitionGroup {
  ammoType: string;
  label: string;
  capacity: number;
  bins: number;
  // Salvas completas disparando a la vez todas las armas que la usan, y segundos de fuego continuo.
  volleys: number | null;
  seconds: number | null;
  // Daño de todas las salvas: las salvas por el daño de una salva de las armas que la usan, con las
  // mejoras de la cantina. null si no la usa ningún arma.
  potentialDamage: number | null;
}

// Con las mejoras de cooldown de la cantina, las armas disparan más a menudo y la munición dura menos:
// los segundos de fuego usan la misma cadencia que la tabla de armas.
export const groupAmmunition = (loadout: Loadout, modifiers = NO_UPGRADE_MODIFIERS): AmmunitionGroup[] => {
  const equipped = getEquippedItems(loadout);
  const groups = new Map<string, AmmunitionGroup>();

  for (const item of equipped.filter(equippedItem => equippedItem.type === 'ammo')) {
    const ammoType = item.ammoType ?? item.id;
    const group = groups.get(ammoType) ?? {
      ammoType,
      label: getAmmoLabel(item),
      capacity: 0,
      bins: 0,
      volleys: null,
      seconds: null,
      potentialDamage: null
    };
    group.capacity += item.capacity ?? 0;
    group.bins += 1;
    groups.set(ammoType, group);
  }

  for (const group of groups.values()) {
    const users = equipped.filter(item => item.type === 'weapon' && item.ammoType === group.ammoType);
    const ammoPerVolley = sumBy(users, item => item.ammoPerVolley ?? 1);
    const stats = users.map(item => applyWeaponModifiers(item, getWeaponStats(item), modifiers));
    const ammoPerSecond = sumBy(users.map((item, index) => (item.ammoPerVolley ?? 1) * stats[index].rpm / 60), value => value);
    group.volleys = ammoPerVolley > 0 ? Math.floor(group.capacity / ammoPerVolley) : null;
    group.seconds = ammoPerSecond > 0 ? Math.round(group.capacity / ammoPerSecond) : null;
    group.potentialDamage = group.volleys === null ? null : group.volleys * sumBy(stats, weapon => weapon.damage);
  }

  return [...groups.values()];
};

// Disparando sin parar también se refrigera, así que la capacidad se llena con el calor neto. Si la
// refrigeración iguala o supera al calor disparando, no se llena nunca. Enfriarse es desde el máximo y
// sin disparar.
export const getHeatTimes = ({ heatCapacity, heatPerSecond, coolingRate }: { heatCapacity: number | null; heatPerSecond: number; coolingRate: number | null }) => {
  if (heatCapacity === null || coolingRate === null) return { timeToMaxHeat: null, timeToCoolDown: null };
  const net = heatPerSecond - coolingRate;
  return {
    timeToMaxHeat: net > 0 ? heatCapacity / net : 'never' as const,
    timeToCoolDown: coolingRate > 0 ? heatCapacity / coolingRate : null
  };
};

// Daño por alcance para el radar del análisis. En MW5, un arma hace todo su daño hasta su alcance óptimo
// y, entre el óptimo y el máximo, un daño que baja en línea recta hasta cero (la caída de daño del juego).
// El cuerpo a cuerpo no cuenta. No hay alcance mínimo, así que belowMin es siempre 0 (en BATTLETECH no).
export { getRangeStep };

const damageAt = (weapon: WeaponPerformance, distance: number): number => {
  const full = weapon.range ?? 0;
  const max = weapon.maxRange ?? full;
  if (distance <= full) return weapon.damage;
  if (distance >= max) return 0;
  return weapon.damage * (max - distance) / (max - full);
};

// Qué hace un arma a una distancia: todo su daño, el de la caída (entre su alcance óptimo y el máximo) o
// nada. El cuerpo a cuerpo no cuenta. Lo usa el radar para resaltar las armas de cada anillo.
export type WeaponRangeState = 'full' | 'falloff' | 'out';

export const getWeaponRangeState = (weapon: WeaponPerformance, distance: number): WeaponRangeState => {
  if (isMeleeWeapon(weapon.item)) return 'out';
  const full = weapon.range ?? 0;
  const max = weapon.maxRange ?? full;
  return distance <= full ? 'full' : distance < max ? 'falloff' : 'out';
};

export const getRangeProfile = (weapons: WeaponPerformance[]): { distance: number; damage: number; belowMin: number }[] => {
  const ranged = weapons.filter(weapon => !isMeleeWeapon(weapon.item));
  const maxRange = Math.max(0, ...ranged.map(weapon => weapon.maxRange ?? weapon.range ?? 0));
  if (maxRange === 0) return [];
  const step = getRangeStep(maxRange);
  return Array.from({ length: Math.ceil(maxRange / step) }, (_, index) => {
    const distance = (index + 1) * step;
    return { distance, damage: sumBy(ranged, weapon => damageAt(weapon, distance)), belowMin: 0 };
  });
};

export interface BuildSummary {
  equipmentWeight: number;
  armorWeight: number;
  totalWeight: number;
  armorPoints: number;
  maxArmorPoints: number;
  firepower: number;
  meleeDamage: number;
  heatSpike: number;
  coolingRate: number | null;
  heatCapacity: number | null;
  // Multiplicador del calor que generan las armas (1 sin mejoras).
  heatGeneration: number;
  // Segundos hasta llenar la capacidad disparando ('never' si no se llena) y para vaciarla sin disparar.
  timeToMaxHeat: number | 'never' | null;
  timeToCoolDown: number | null;
  // Daño por salva de las armas a distancia entre su tonelaje.
  damagePerTon: number | null;
  // Calor por segundo disparando sin parar y DPS de las armas a distancia.
  heatPerSecond: number;
  dps: number;
  structurePoints: number;
  topSpeed: number;
  // Giro de pie y del torso en °/s, como el resumen del juego.
  turnSpeed: number | null;
  torsoYaw: number | null;
  torsoPitch: number | null;
  sensorRange: number;
  lockRetentionTime: number;
  loseLockTime: number;
  // Velocidad con el impulso del MASC o Supercharger montado, si lo hay.
  boostedSpeed: number | null;
  jumpJetCount: number;
  maxWeaponRange: number;
  weapons: WeaponPerformance[];
  ammunition: AmmunitionGroup[];
}

// Las mejoras de la cantina suben las cifras sin cambiar el peso: Refined Armor I da +2,5 % de
// puntos de armadura (en el juego, 414/414 -> 424/424,35 con las mismas toneladas).
export const getBuildSummary = (mech: Mech, loadout: Loadout, armor: ArmorState, upgrades: Upgrade[] = []): BuildSummary => {
  const modifiers = getUpgradeModifiers(upgrades);
  const equipmentWeight = calculateEquippedWeight(loadout);
  const armorWeight = calculateArmorWeight(armor, getArmorPointsPerTon(mech));
  const weapons = getWeaponPerformance(loadout, modifiers);
  const coolingRate = calculateCoolingRate(loadout, mech.BaseCoolingRate);
  const heatCapacity = calculateHeatCapacity(mech, loadout);
  const rangedWeapons = weapons.filter(weapon => !isMeleeWeapon(weapon.item));
  const scale = (value: number | undefined, bonus: number) => value === undefined ? null : value * (1 + bonus);
  const shownCooling = coolingRate === null ? null : roundTo(coolingRate * (1 + modifiers.cooling), 2);
  const shownCapacity = heatCapacity === null ? null : heatCapacity * (1 + modifiers.heatCapacity);
  const heatPerSecond = sumBy(rangedWeapons, weapon => perSecond(weapon.item, weapon.heat, weapon.rpm));
  const rangedTonnage = sumBy(rangedWeapons, weapon => weapon.item.tonnage);

  return {
    equipmentWeight,
    armorWeight,
    totalWeight: mech.baseTonnage + equipmentWeight + armorWeight,
    armorPoints: calculateArmorPoints(armor) * (1 + modifiers.armor),
    maxArmorPoints: sumBy(Object.values(mech.components), component => component.maxArmor) * (1 + modifiers.armor),
    firepower: calculateFirepower(loadout, modifiers),
    meleeDamage: calculateMeleeDamage(mech, loadout, modifiers),
    heatSpike: calculateHeatSpike(loadout, modifiers),
    // Faster Cooling sube la refrigeración total, y el juego la muestra con dos decimales (2,1 -> 2,21).
    coolingRate: shownCooling,
    heatCapacity: shownCapacity,
    heatGeneration: 1 + modifiers.heatGeneration,
    heatPerSecond,
    ...getHeatTimes({ heatCapacity: shownCapacity, heatPerSecond, coolingRate: shownCooling }),
    damagePerTon: rangedTonnage > 0 ? sumBy(rangedWeapons, weapon => weapon.damage) / rangedTonnage : null,
    dps: sumBy(rangedWeapons, weapon => weapon.dps),
    structurePoints: sumBy(Object.values(mech.components), component => component.structure) * (1 + modifiers.structure),
    topSpeed: calculateTopSpeed(mech.baseSpeed, modifiers.topSpeed),
    turnSpeed: scale(mech.turnSpeed, modifiers.turnSpeed),
    torsoYaw: scale(mech.torsoTwist?.yaw, modifiers.torsoTwist),
    torsoPitch: scale(mech.torsoTwist?.pitch, modifiers.torsoTwist),
    sensorRange: SENSOR_RANGE * (1 + modifiers.sensorRange),
    lockRetentionTime: LOCK_RETENTION_TIME * (1 + modifiers.lockRetention),
    loseLockTime: LOSE_LOCK_TIME * (1 + modifiers.loseLockTime),
    boostedSpeed: calculateBoostedSpeed(loadout, mech.baseSpeed, modifiers.topSpeed),
    jumpJetCount: getEquippedItems(loadout).filter(isJumpJet).length,
    maxWeaponRange: weapons.reduce((max, weapon) => Math.max(max, weapon.maxRange ?? 0), 0),
    weapons,
    ammunition: groupAmmunition(loadout, modifiers)
  };
};
