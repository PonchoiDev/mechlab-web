// Buscar, ordenar y filtrar las builds guardadas (docs/specs/buscar-builds-guardadas.md). Es común a los dos
// MechLabs: cada uno resume sus builds en BuildListRow con sus propios datos, y esto no carga ninguno.

export type BuildWeightClass = 'light' | 'medium' | 'heavy' | 'assault';

export const BUILD_WEIGHT_CLASSES: { id: BuildWeightClass; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'heavy', label: 'Heavy' },
  { id: 'assault', label: 'Assault' }
];

// Una build guardada ya resumida. Los datos del 'Mech son null si la build ya no se puede abrir.
export interface BuildListRow {
  id: string;
  name: string;
  savedAt: string;
  chassis: string | null;
  variant: string | null;
  weightClass: BuildWeightClass | null;
  tonnage: number | null;
  firepower: number | null;
}

export type BuildSort = 'newest' | 'oldest' | 'name' | 'chassis' | 'tonnage' | 'firepower';

export const BUILD_SORTS: { id: BuildSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'name', label: 'Name' },
  { id: 'chassis', label: 'Chassis' },
  { id: 'tonnage', label: 'Tonnage' },
  { id: 'firepower', label: 'Firepower' }
];

const DEFAULT_SORT: BuildSort = 'newest';

export const parseBuildSort = (raw: string | null): BuildSort =>
  BUILD_SORTS.find(sort => sort.id === raw)?.id ?? DEFAULT_SORT;

const byName = (a: BuildListRow, b: BuildListRow) => a.name.localeCompare(b.name);
const time = (row: BuildListRow) => Date.parse(row.savedAt);

// De mayor a menor; las builds sin el dato (las que ya no se pueden abrir) van al final.
const descending = (value: (row: BuildListRow) => number | null) => (a: BuildListRow, b: BuildListRow) => {
  const va = value(a);
  const vb = value(b);
  if (va === null || vb === null) return va === vb ? byName(a, b) : va === null ? 1 : -1;
  return vb - va || byName(a, b);
};

const COMPARATORS: Record<BuildSort, (a: BuildListRow, b: BuildListRow) => number> = {
  newest: (a, b) => time(b) - time(a) || byName(a, b),
  oldest: (a, b) => time(a) - time(b) || byName(a, b),
  name: byName,
  chassis: (a, b) => {
    if (a.chassis === null || b.chassis === null) return a.chassis === b.chassis ? byName(a, b) : a.chassis === null ? 1 : -1;
    return a.chassis.localeCompare(b.chassis) || (a.variant ?? '').localeCompare(b.variant ?? '') || byName(a, b);
  },
  tonnage: descending(row => row.tonnage),
  firepower: descending(row => row.firepower)
};

export const sortBuildRows = (rows: BuildListRow[], sort: BuildSort): BuildListRow[] => [...rows].sort(COMPARATORS[sort]);

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface BuildListFilter {
  query: string;
  // Vacío: todas las clases.
  weightClasses: BuildWeightClass[];
}

// Cada palabra tiene que estar en el nombre, el chasis o la variante: «atlas brawl».
export const filterBuildRows = (rows: BuildListRow[], { query, weightClasses }: BuildListFilter): BuildListRow[] => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return rows.filter(row => {
    if (weightClasses.length > 0 && (row.weightClass === null || !weightClasses.includes(row.weightClass))) return false;
    const text = normalize([row.name, row.chassis ?? '', row.variant ?? ''].join(' '));
    return words.every(word => text.includes(word));
  });
};

export const countBuildsByWeightClass = (rows: BuildListRow[]): Record<BuildWeightClass, number> => {
  const counts: Record<BuildWeightClass, number> = { light: 0, medium: 0, heavy: 0, assault: 0 };
  for (const row of rows) if (row.weightClass) counts[row.weightClass] += 1;
  return counts;
};
