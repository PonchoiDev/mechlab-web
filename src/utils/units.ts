import type { Rarity } from '../types/starmap';
import type { Unit, UnitKind, UnitsData } from '../types/units';
import { getWeaponStats } from './calculators';

export const UNIT_KINDS: { id: UnitKind; label: string }[] = [
  { id: 'tracked', label: 'Tracked' },
  { id: 'hover', label: 'Hover' },
  { id: 'wheeled', label: 'Wheeled' },
  { id: 'vtol', label: 'VTOL' },
  { id: 'turret', label: 'Turret' },
  { id: 'battleArmor', label: 'Battle armor' }
];

export const UNIT_KIND_LABELS = Object.fromEntries(UNIT_KINDS.map(kind => [kind.id, kind.label])) as Record<UnitKind, string>;

export interface UnitWeapon {
  id: string;
  name: string;
  count: number;
  // De cada arma, no del total.
  damage: number;
  dps: number;
  range: number | null;
  maxRange: number | null;
}

// Daño y DPS con la misma función que el MechLab, en el tier que lleva la unidad.
export const getUnitWeapons = (data: UnitsData, unit: Unit): UnitWeapon[] =>
  unit.weapons.flatMap(({ id, count }) => {
    const item = data.weapons[id];
    if (!item) return [];
    const stats = getWeaponStats(item);
    return [{ id, name: item.name, count, damage: stats.damage, dps: stats.dps, range: stats.range, maxRange: stats.maxRange }];
  });

// Daño de una salva de todas las armas y su DPS sumado.
export const getUnitFirepower = (data: UnitsData, unit: Unit) =>
  getUnitWeapons(data, unit).reduce(
    (total, weapon) => ({ damage: total.damage + weapon.damage * weapon.count, dps: total.dps + weapon.dps * weapon.count }),
    { damage: 0, dps: 0 }
  );

export interface UnitFilter {
  kind: UnitKind | 'all';
  query: string;
}

export const filterUnits = (units: Unit[], { kind, query }: UnitFilter): Unit[] => {
  const text = query.trim().toLowerCase();
  return units.filter(unit => (kind === 'all' || unit.kind === kind) && (!text || unit.name.toLowerCase().includes(text)));
};

export type UnitSort = 'name' | 'battleValue' | 'dps' | 'hitPoints' | 'speed' | 'introYear';

export const UNIT_SORTS: { id: UnitSort; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'battleValue', label: 'Battle value' },
  { id: 'dps', label: 'DPS' },
  { id: 'hitPoints', label: 'Hit points' },
  { id: 'speed', label: 'Speed' },
  { id: 'introYear', label: 'Intro year' }
];

// Las cifras van de mayor a menor, salvo el año (de la más antigua a la más nueva). Sin el dato, al
// final; a igualdad, por nombre.
export const sortUnits = (data: UnitsData, units: Unit[], sort: UnitSort): Unit[] => {
  const byName = (a: Unit, b: Unit) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  if (sort === 'name') return [...units].sort(byName);
  const value = (unit: Unit): number | null => sort === 'dps' ? getUnitFirepower(data, unit).dps : unit[sort];
  const direction = sort === 'introYear' ? 1 : -1;
  const values = new Map(units.map(unit => [unit, value(unit)]));
  return [...units].sort((a, b) => {
    const [first, second] = [values.get(a) ?? null, values.get(b) ?? null];
    if (first === null || second === null) return first === second ? byName(a, b) : first === null ? 1 : -1;
    return (first - second) * direction || byName(a, b);
  });
};

// De más común a más rara. Unavailable es que la facción no la usa: no se enseña.
const RARITY_ORDER: Rarity[] = ['veryCommon', 'common', 'uncommon', 'rare', 'veryRare', 'unique'];

export const RARITY_LABELS: Record<Rarity, string> = {
  veryCommon: 'Very common',
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  veryRare: 'Very rare',
  unique: 'Unique',
  unavailable: 'Unavailable'
};

// Facciones que la usan, por rareza. Algunas facciones comparten nombre (Clan Nova Cat y su versión
// abjurada): salen una vez, con la rareza más común.
export const groupRarity = (data: UnitsData, unit: Unit): { rarity: Rarity; factions: string[] }[] => {
  const seen = new Set<string>();
  return RARITY_ORDER.flatMap(rarity => {
    const factions = Object.entries(unit.rarity)
      .filter(([, level]) => level === rarity)
      .map(([id]) => data.factions[id] ?? id)
      .filter(name => !seen.has(name) && Boolean(seen.add(name)))
      .sort((a, b) => a.localeCompare(b));
    return factions.length > 0 ? [{ rarity, factions }] : [];
  });
};
