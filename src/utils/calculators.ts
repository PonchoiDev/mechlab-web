import type { Item } from '../types/item';
import type { ArmorState, Loadout, Mech, MechComponents, Zone } from '../types/mech';
import { getItemAmmoFamily, getItemAmmoFamilyLabel, isJumpJet } from './items';
import { mapZones } from './zones';

const ARMOR_POINTS_PER_TON = 32;
const ARMOR_FILL_ORDER: Zone[] = [
  'head', 'centerTorso', 'leftTorso', 'rightTorso', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm'
];
const DEFAULT_REAR_ARMOR_RATIO = 1 / 3;
const GAME_SPEED_DISPLAY_FACTOR = 7 / 6;

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const armorPointsToTons = (points: number): number => roundTo(points / ARMOR_POINTS_PER_TON, 2);

const sumBy = <T>(values: T[], getValue: (value: T) => number): number =>
  values.reduce((total, value) => total + getValue(value), 0);

const getEquippedItems = (loadout: Loadout): Item[] => Object.values(loadout).flat();

const getTierStats = (item: Item) =>
  item.tiers?.[item.tier ?? '1'] ?? item.tiers?.['1'];

const getMissileCount = (item: Item): number => {
  const missileRack = item.type === 'weapon' && item.weaponType === 'missile'
    ? item.id.match(/^(?:LRM|StreakSRM|SRM)(\d+)/)
    : null;

  return Number(missileRack?.[1] ?? 1);
};

const getWeaponDamage = (item: Item): number =>
  (getTierStats(item)?.damage ?? item.damage ?? 0) * getMissileCount(item);

const getWeaponHeat = (item: Item): number => {
  const stats = getTierStats(item);
  return (stats?.heatPerShot ?? stats?.heat ?? item.heat ?? 0) * getMissileCount(item);
};

export interface WeaponPerformance {
  zone: Zone;
  item: Item;
  damage: number;
  heat: number;
  rpm: number;
  dps: number;
  range: number | null;
}

export const calculateEquippedWeight = (loadout: Loadout): number =>
  sumBy(getEquippedItems(loadout), item => item.tonnage);

export const calculateArmorPoints = (armor: ArmorState): number =>
  sumBy(Object.values(armor), zone => zone.front + zone.rear);

export const calculateArmorWeight = (armor: ArmorState): number =>
  armorPointsToTons(calculateArmorPoints(armor));

export const createDefaultArmor = (components: MechComponents): ArmorState =>
  mapZones(zone => {
    const rear = components[zone].hasRearArmor
      ? Math.round(components[zone].maxArmor * DEFAULT_REAR_ARMOR_RATIO)
      : 0;

    return { front: components[zone].maxArmor - rear, rear };
  });

const getAffordableArmorPoints = (availableTonnage: number): number => {
  let points = Math.max(0, Math.floor(availableTonnage * ARMOR_POINTS_PER_TON));

  while (armorPointsToTons(points + 1) <= availableTonnage) points += 1;
  while (points > 0 && armorPointsToTons(points) > availableTonnage) points -= 1;

  return points;
};

export const maximizeArmor = (
  components: MechComponents,
  availableTonnage: number,
  currentArmor: ArmorState
): ArmorState => {
  const pointsByZone = mapZones(() => 0);
  let pointsRemaining = Math.min(
    getAffordableArmorPoints(availableTonnage),
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

export const calculateCoolingRate = (
  loadout: Loadout,
  baseCoolingRate?: number
): number | null => baseCoolingRate === undefined
  ? null
  : roundTo(baseCoolingRate + sumBy(getEquippedItems(loadout), item => item.cooling ?? 0), 1);

export const calculateTopSpeed = (baseSpeed: number): number =>
  roundTo(baseSpeed * GAME_SPEED_DISPLAY_FACTOR, 1);

export const getWeaponPerformance = (loadout: Loadout): WeaponPerformance[] =>
  (Object.entries(loadout) as [Zone, Item[]][]).flatMap(([zone, items]) => items
    .filter(item => item.type === 'weapon')
    .map(item => {
      const stats = getTierStats(item);
      const damage = getWeaponDamage(item);
      const rpm = stats?.rpm ?? (stats?.cooldown ? 60 / stats.cooldown : 0);

      return {
        zone,
        item,
        damage,
        heat: getWeaponHeat(item),
        rpm,
        dps: damage * rpm / 60,
        range: stats?.range ?? null
      };
    }));

export const calculateFirepower = (loadout: Loadout): number =>
  roundTo(sumBy(getWeaponPerformance(loadout), weapon => weapon.damage), 1);

export const calculateHeatSpike = (loadout: Loadout): number =>
  roundTo(sumBy(getWeaponPerformance(loadout), weapon => weapon.heat), 1);

export interface AmmunitionGroup {
  family: string;
  label: string;
  capacity: number;
  bins: number;
}

export const groupAmmunition = (loadout: Loadout): AmmunitionGroup[] => {
  const groups = new Map<string, AmmunitionGroup>();

  for (const item of getEquippedItems(loadout).filter(equippedItem => equippedItem.type === 'ammo')) {
    const family = getItemAmmoFamily(item) ?? item.id;
    const group = groups.get(family) ?? { family, label: getItemAmmoFamilyLabel(item), capacity: 0, bins: 0 };
    group.capacity += item.capacity ?? 0;
    group.bins += 1;
    groups.set(family, group);
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
  heatSpike: number;
  coolingRate: number | null;
  topSpeed: number;
  jumpJetCount: number;
  maxWeaponRange: number;
  weapons: WeaponPerformance[];
  ammunition: AmmunitionGroup[];
}

export const getBuildSummary = (mech: Mech, loadout: Loadout, armor: ArmorState): BuildSummary => {
  const equipmentWeight = calculateEquippedWeight(loadout);
  const armorWeight = calculateArmorWeight(armor);
  const weapons = getWeaponPerformance(loadout);

  return {
    equipmentWeight,
    armorWeight,
    totalWeight: mech.baseTonnage + equipmentWeight + armorWeight,
    armorPoints: calculateArmorPoints(armor),
    maxArmorPoints: sumBy(Object.values(mech.components), component => component.maxArmor),
    firepower: calculateFirepower(loadout),
    heatSpike: calculateHeatSpike(loadout),
    coolingRate: calculateCoolingRate(loadout, mech.BaseCoolingRate),
    topSpeed: calculateTopSpeed(mech.baseSpeed),
    jumpJetCount: getEquippedItems(loadout).filter(isJumpJet).length,
    maxWeaponRange: weapons.reduce((max, weapon) => Math.max(max, weapon.range ?? 0), 0),
    weapons,
    ammunition: groupAmmunition(loadout)
  };
};
