import type { Item } from '../types/item';
import type { ArmorState, Loadout, Mech, MechComponents, Zone } from '../types/mech';
import type { Upgrade } from '../types/upgrade';
import { getHardpointViews } from './equipment';
import { getAmmoLabel, isJumpJet } from './items';
import { getUpgradeModifiers, NO_UPGRADE_MODIFIERS, type UpgradeModifiers } from './upgrades';
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

// Con disipadores dobles de la Esfera Interior, los 10 disipadores internos del motor enfrían el
// doble: +1,0 heat/s sobre el valor del MDA (comprobado en el CRD-2R, el ASN-26 y los Banshee).
// Los Clan ya traen esa refrigeración en su valor base.
const DOUBLE_HEAT_SINK_ENGINE_BONUS = 1;

export const calculateCoolingRate = (
  loadout: Loadout,
  baseCoolingRate?: number,
  heatSinkType?: Mech['heatSinkType']
): number | null => baseCoolingRate === undefined
  ? null
  : roundTo(
    baseCoolingRate +
    (heatSinkType === 'double' ? DOUBLE_HEAT_SINK_ENGINE_BONUS : 0) +
    sumBy(getEquippedItems(loadout), item => item.cooling ?? 0),
    1
  );

export const calculateTopSpeed = (baseSpeed: number, speedBonus = 0): number =>
  roundTo(baseSpeed * GAME_SPEED_DISPLAY_FACTOR * (1 + speedBonus), 1);

export const calculateBoostedSpeed = (loadout: Loadout, baseSpeed: number, speedBonus = 0): number | null => {
  const boost = Math.max(0, ...getEquippedItems(loadout).map(item => item.speedBoost ?? 0));
  return boost > 0 ? roundTo(baseSpeed * GAME_SPEED_DISPLAY_FACTOR * (1 + speedBonus) * (1 + boost), 1) : null;
};

export type WeaponStats = Omit<WeaponPerformance, 'zone' | 'item'>;

export const getWeaponStats = (item: Item): WeaponStats => {
  const stats = getTierStats(item);
  const damage = getWeaponDamage(item);
  const rpm = stats?.rpm ?? (stats?.cooldown ? 60 / stats.cooldown : 0);

  return {
    damage,
    heat: getWeaponHeat(item),
    rpm,
    dps: damage * rpm / 60,
    range: stats?.range ?? null,
    maxRange: stats?.maxRange ?? stats?.range ?? null
  };
};

// Con las mejoras de la cantina, el daño y el alcance de cada tipo de arma suben en su porcentaje.
const applyWeaponModifiers = (item: Item, stats: WeaponStats, modifiers: UpgradeModifiers): WeaponStats => {
  const weaponType = item.weaponType ?? undefined;
  const damageBonus = weaponType ? modifiers.damage[weaponType] ?? 0 : 0;
  const rangeBonus = weaponType ? modifiers.range[weaponType] ?? 0 : 0;
  if (damageBonus === 0 && rangeBonus === 0) return stats;
  const damage = stats.damage * (1 + damageBonus);
  return {
    ...stats,
    damage,
    dps: damage * stats.rpm / 60,
    range: stats.range === null ? null : stats.range * (1 + rangeBonus),
    maxRange: stats.maxRange === null ? null : stats.maxRange * (1 + rangeBonus)
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
  roundTo((1 + (modifiers.damage.melee ?? 0)) * sumBy(Object.keys(mech.components) as Zone[], zone =>
    sumBy(getHardpointViews(mech.components[zone].hardpoints, loadout[zone]), view => {
      const { hardpoint } = view;
      if (hardpoint.type !== 'melee') return 0;
      if (view.weapon) return getWeaponStats(view.weapon).damage;
      const weightClass = hardpoint.weightClass ?? 'medium';
      if (hardpoint.defaultWeapon) return FIST_DAMAGE[weightClass];
      return hardpoint.size === 'small' ? HAND_DAMAGE[weightClass] / 2 : HAND_DAMAGE[weightClass];
    })), 1);

export const calculateHeatSpike = (loadout: Loadout): number =>
  roundTo(sumBy(getWeaponPerformance(loadout), weapon => weapon.heat), 1);

export interface AmmunitionGroup {
  ammoType: string;
  label: string;
  capacity: number;
  bins: number;
  // Salvas completas disparando a la vez todas las armas que la usan, y segundos de fuego continuo.
  volleys: number | null;
  seconds: number | null;
}

export const groupAmmunition = (loadout: Loadout): AmmunitionGroup[] => {
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
      seconds: null
    };
    group.capacity += item.capacity ?? 0;
    group.bins += 1;
    groups.set(ammoType, group);
  }

  for (const group of groups.values()) {
    const users = equipped.filter(item => item.type === 'weapon' && item.ammoType === group.ammoType);
    const ammoPerVolley = sumBy(users, item => item.ammoPerVolley ?? 1);
    const ammoPerSecond = sumBy(users, item => (item.ammoPerVolley ?? 1) * getWeaponStats(item).rpm / 60);
    group.volleys = ammoPerVolley > 0 ? Math.floor(group.capacity / ammoPerVolley) : null;
    group.seconds = ammoPerSecond > 0 ? Math.round(group.capacity / ammoPerSecond) : null;
  }

  return [...groups.values()];
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
  topSpeed: number;
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
  const coolingRate = calculateCoolingRate(loadout, mech.BaseCoolingRate, mech.heatSinkType);

  return {
    equipmentWeight,
    armorWeight,
    totalWeight: mech.baseTonnage + equipmentWeight + armorWeight,
    armorPoints: calculateArmorPoints(armor) * (1 + modifiers.armor),
    maxArmorPoints: sumBy(Object.values(mech.components), component => component.maxArmor) * (1 + modifiers.armor),
    firepower: calculateFirepower(loadout, modifiers),
    meleeDamage: calculateMeleeDamage(mech, loadout, modifiers),
    heatSpike: calculateHeatSpike(loadout),
    coolingRate: coolingRate === null ? null : roundTo(coolingRate * (1 + modifiers.cooling), 1),
    topSpeed: calculateTopSpeed(mech.baseSpeed, modifiers.topSpeed),
    boostedSpeed: calculateBoostedSpeed(loadout, mech.baseSpeed, modifiers.topSpeed),
    jumpJetCount: getEquippedItems(loadout).filter(isJumpJet).length,
    maxWeaponRange: weapons.reduce((max, weapon) => Math.max(max, weapon.maxRange ?? 0), 0),
    weapons,
    ammunition: groupAmmunition(loadout)
  };
};
