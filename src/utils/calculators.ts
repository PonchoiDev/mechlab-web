import type { Item } from '../types/item';
import type { MechComponents } from '../types/mech';

export type EquippedLoadout = {
  [K in keyof MechComponents]: Item[];
};

export type ArmorState = {
  [K in keyof MechComponents]: { front: number; rear: number };
};

const ARMOR_ZONES: (keyof MechComponents)[] = [
  'head', 'centerTorso', 'leftTorso', 'rightTorso', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm'
];
const DEFAULT_REAR_ARMOR_RATIO = 1 / 3;
const GAME_SPEED_DISPLAY_FACTOR = 7 / 6;

const getTierStats = (item: Item) =>
  item.tiers?.[item.tier ?? '1'] ?? item.tiers?.['1'];

const getWeaponDamage = (item: Item): number => {
  const damage = getTierStats(item)?.damage ?? item.damage ?? 0;
  const missileRack = item.type === 'weapon' && item.weaponType === 'missile'
    ? item.id.match(/^(?:LRM|StreakSRM|SRM)(\d+)/)
    : null;
  const missileCount = Number(missileRack?.[1] ?? 1);

  return damage * missileCount;
};

export interface WeaponPerformance {
  zone: keyof EquippedLoadout;
  item: Item;
  damage: number;
  heat: number;
  rpm: number;
  dps: number;
  range: number | null;
}

export const calculateEquippedWeight = (loadout: EquippedLoadout): number => {
  let totalWeight = 0;
  Object.values(loadout).forEach((items) => {
    items.forEach((item) => {
      totalWeight += item.tonnage;
    });
  });
  return totalWeight;
};

export const calculateArmorWeight = (armor: ArmorState): number => {
  let totalPoints = 0;
  Object.values(armor).forEach((zone) => {
    totalPoints += zone.front + zone.rear;
  });
  return Math.round((totalPoints / 32) * 100) / 100;
};

export const calculateArmorPoints = (armor: ArmorState): number =>
  Object.values(armor).reduce((total, zone) => total + zone.front + zone.rear, 0);

export const createDefaultArmor = (components: MechComponents): ArmorState =>
  Object.fromEntries(ARMOR_ZONES.map(zone => {
    const rear = components[zone].hasRearArmor
      ? Math.round(components[zone].maxArmor * DEFAULT_REAR_ARMOR_RATIO)
      : 0;

    return [zone, { front: components[zone].maxArmor - rear, rear }];
  })) as ArmorState;

export const maximizeArmor = (
  components: MechComponents,
  availableTonnage: number,
  currentArmor: ArmorState
): ArmorState => {
  let pointsAvailable = Math.max(0, Math.floor(availableTonnage * 32));

  while (Math.round(((pointsAvailable + 1) / 32) * 100) / 100 <= availableTonnage) {
    pointsAvailable += 1;
  }
  while (pointsAvailable > 0 && Math.round((pointsAvailable / 32) * 100) / 100 > availableTonnage) {
    pointsAvailable -= 1;
  }

  const pointsByZone = Object.fromEntries(ARMOR_ZONES.map(zone => [zone, 0])) as Record<keyof MechComponents, number>;
  let pointsRemaining = Math.min(
    pointsAvailable,
    ARMOR_ZONES.reduce((total, zone) => total + components[zone].maxArmor, 0)
  );

  while (pointsRemaining > 0) {
    let allocatedInRound = false;

    for (const zone of ARMOR_ZONES) {
      if (pointsRemaining === 0) break;
      if (pointsByZone[zone] >= components[zone].maxArmor) continue;

      pointsByZone[zone] += 1;
      pointsRemaining -= 1;
      allocatedInRound = true;
    }

    if (!allocatedInRound) break;
  }

  return Object.fromEntries(ARMOR_ZONES.map(zone => {
    const previousTotal = currentArmor[zone].front + currentArmor[zone].rear;
    const rearRatio = !components[zone].hasRearArmor
      ? 0
      : previousTotal > 0
        ? currentArmor[zone].rear / previousTotal
        : DEFAULT_REAR_ARMOR_RATIO;
    const rear = Math.round(pointsByZone[zone] * rearRatio);

    return [zone, { front: pointsByZone[zone] - rear, rear }];
  })) as ArmorState;
};

export const calculateCoolingRate = (
  loadout: EquippedLoadout,
  baseCoolingRate?: number
): number | null => baseCoolingRate === undefined
  ? null
  : Math.round((baseCoolingRate + Object.values(loadout).flat()
    .reduce((total, item) => total + (item.cooling ?? 0), 0)) * 10) / 10;

export const calculateTopSpeed = (baseSpeed: number): number =>
  Math.round(baseSpeed * GAME_SPEED_DISPLAY_FACTOR * 10) / 10;

export const getWeaponPerformance = (loadout: EquippedLoadout): WeaponPerformance[] =>
  Object.entries(loadout).flatMap(([zone, items]) => items
    .filter(item => item.type === 'weapon')
    .map(item => {
      const stats = getTierStats(item);
      const damage = getWeaponDamage(item);
      const heat = stats?.heatPerShot ?? stats?.heat ?? item.heat ?? 0;
      const rpm = stats?.rpm ?? (stats?.cooldown ? 60 / stats.cooldown : 0);

      return {
        zone: zone as keyof EquippedLoadout,
        item,
        damage,
        heat,
        rpm,
        dps: damage * rpm / 60,
        range: stats?.range ?? null
      };
    }));

export const calculateFirepower = (loadout: EquippedLoadout): number => {
  let firepower = 0;
  Object.values(loadout).forEach((items) => {
    items.forEach((item) => {
      if (item.type === 'weapon') {
        firepower += getWeaponDamage(item);
      }
    });
  });
  return Math.round(firepower * 10) / 10;
};

export const calculateHeatSpike = (loadout: EquippedLoadout): number => {
  let heat = 0;
  Object.values(loadout).forEach((items) => {
    items.forEach((item) => {
      if (item.type === 'weapon') {
        const stats = getTierStats(item);
        heat += stats?.heatPerShot ?? stats?.heat ?? item.heat ?? 0;
      }
    });
  });
  return Math.round(heat * 10) / 10;
};