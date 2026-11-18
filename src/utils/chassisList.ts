import type { Mech } from '../types/mech';
import { calculateTopSpeed } from './calculators';
import { defaultSortDirection, sortByColumn, toggleColumnSort, type ColumnSort } from './tableSort';
import {
  BASE_GAME,
  EMPTY_MECH_FILTERS,
  HARDPOINT_FILTER_TYPES,
  getAvailableYear,
  getContentSource,
  getHardpointCounts,
  getMechDisplayName,
  getMechWeightClass,
  matchesMechFilters,
  matchesMechQuery,
  mergeMechFilters,
  parseMechQuery,
  type HardpointFilterType,
  type MechFilters,
  type WeightClassName
} from './mechs';

// Lista de chasis de MW5 (docs/specs/lista-chasis.md): una fila por variante con las cifras de su chasis.
// Los filtros son los del selector de 'Mechs del MechLab (utils/mechs.ts).

export interface ChassisRow {
  mech: Mech;
  chassis: string;
  weightClass: WeightClassName;
  tonnage: number;
  hardpoints: Record<HardpointFilterType, number>;
  hardpointTotal: number;
  engineRating: number | null;
  xl: boolean;
  // km/h, como los enseña el mechlab del juego.
  speed: number;
  armor: number;
  structure: number;
  jumpJets: number;
  turnSpeed: number | null;
  torsoYaw: number | null;
  upgradeSlots: number | null;
  // Del chasis vacío, sin disipadores montados: lo que trae de base.
  heatCapacity: number | null;
  cooling: number | null;
  year: number;
  dlc: number;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const round2 = (value: number) => Math.round(value * 100) / 100;

export const getChassisRows = (mechs: Mech[]): ChassisRow[] => mechs.map(mech => {
  const components = Object.values(mech.components);
  const hardpoints = getHardpointCounts(mech);
  return {
    mech,
    chassis: getMechDisplayName(mech),
    weightClass: getMechWeightClass(mech),
    tonnage: mech.tonnageMax,
    hardpoints,
    hardpointTotal: sum(Object.values(hardpoints)),
    engineRating: mech.engine?.rating ?? null,
    xl: mech.engine?.xl ?? false,
    speed: calculateTopSpeed(mech.baseSpeed),
    armor: sum(components.map(component => component.maxArmor)),
    structure: sum(components.map(component => component.structure)),
    jumpJets: sum(components.map(component => component.jumpJetSlots)),
    turnSpeed: mech.turnSpeed ?? null,
    torsoYaw: mech.torsoTwist?.yaw ?? null,
    upgradeSlots: mech.upgradeSlots ?? null,
    // El juego guarda las cifras con decimales de coma flotante (36.400002): se redondean como las enseña.
    heatCapacity: mech.baseHeatCapacity === undefined ? null : round2(mech.baseHeatCapacity),
    cooling: mech.BaseCoolingRate === undefined ? null : round2(mech.BaseCoolingRate),
    year: getAvailableYear(mech),
    dlc: getContentSource(mech)
  };
});

export const countChassis = (rows: ChassisRow[]): number => new Set(rows.map(row => row.mech.name)).size;

export type ChassisSortKey =
  | 'name' | 'tonnage' | 'hardpoints' | 'engine' | 'speed' | 'armor' | 'structure' | 'jumpJets'
  | 'turnSpeed' | 'torsoYaw' | 'upgradeSlots' | 'heatCapacity' | 'cooling' | 'year' | 'dlc';

export const CHASSIS_SORT_KEYS: ChassisSortKey[] = [
  'name', 'tonnage', 'hardpoints', 'engine', 'speed', 'armor', 'structure', 'jumpJets',
  'turnSpeed', 'torsoYaw', 'upgradeSlots', 'heatCapacity', 'cooling', 'year', 'dlc'
];

export type ChassisSort = ColumnSort<ChassisSortKey>;

export const toggleChassisSort = (current: ChassisSort, key: ChassisSortKey): ChassisSort => toggleColumnSort(current, key);

const sortValue = (row: ChassisRow, key: Exclude<ChassisSortKey, 'name'>): number | null => {
  switch (key) {
    case 'hardpoints': return row.hardpointTotal;
    case 'engine': return row.engineRating;
    default: return row[key];
  }
};

const byName = (a: ChassisRow, b: ChassisRow) =>
  a.chassis.localeCompare(b.chassis) || a.mech.variant.localeCompare(b.mech.variant);

export const sortChassisRows = (rows: ChassisRow[], sort: ChassisSort): ChassisRow[] => sortByColumn(rows, sort, sortValue, byName);

export interface ChassisView {
  query: string;
  filters: MechFilters;
  minTons: number | null;
  maxTons: number | null;
  minSpeed: number | null;
  sort: ChassisSort;
}

export const DEFAULT_CHASSIS_VIEW: ChassisView = {
  query: '',
  filters: EMPTY_MECH_FILTERS,
  minTons: null,
  maxTons: null,
  minSpeed: null,
  sort: { key: 'name', dir: 'asc' }
};

// El buscador lleva los mismos atajos que el del selector («3e 2m jj ecm hero dlc7»).
export const filterChassisRows = (rows: ChassisRow[], view: ChassisView): ChassisRow[] => {
  const { text, filters: queryFilters } = parseMechQuery(view.query);
  const filters = mergeMechFilters(view.filters, queryFilters);
  return rows.filter(row =>
    matchesMechQuery(row.mech, text) &&
    matchesMechFilters(row.mech, filters) &&
    (view.minTons === null || row.tonnage >= view.minTons) &&
    (view.maxTons === null || row.tonnage <= view.maxTons) &&
    (view.minSpeed === null || row.speed >= view.minSpeed));
};

export const getChassisLink = (mech: Mech): string => `/mercs/?mech=${encodeURIComponent(mech.id)}`;

const WEIGHT_CLASSES: WeightClassName[] = ['light', 'medium', 'heavy', 'assault'];
const HARDPOINT_TOKENS: Record<HardpointFilterType, string> = { energy: 'e', ballistic: 'b', missile: 'm', omni: 'o', artillery: 'art', ams: 'ams' };
const HARDPOINT_TOKEN = /^(\d)(e|b|m|o|art|ams)$/;

const list = (value: string | null) => (value ?? '').split(',').map(part => part.trim()).filter(Boolean);
const integerIn = (value: string | null, min: number, max: number): number | null => {
  if (value === null || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
};

// La vista va en la URL para poder compartirla (?class=assault&min=3e,2m&tmin=20&sort=speed); lo que no se
// reconoce se ignora. Los anclajes mínimos usan los atajos del buscador; el juego base es dlc=base.
export const parseChassisQuery = (search: string): ChassisView => {
  const params = new URLSearchParams(search);
  const minHardpoints: MechFilters['minHardpoints'] = {};
  for (const token of list(params.get('min'))) {
    const match = HARDPOINT_TOKEN.exec(token.toLowerCase());
    const type = match && HARDPOINT_FILTER_TYPES.find(candidate => HARDPOINT_TOKENS[candidate] === match[2]);
    if (match && type && Number(match[1]) > 0) minHardpoints[type] = Number(match[1]);
  }
  const dlcs = list(params.get('dlc'))
    .map(part => part === 'base' ? BASE_GAME : integerIn(part, 1, 9))
    .filter((dlc): dlc is number => dlc !== null);
  const tech = params.get('tech');
  const key = CHASSIS_SORT_KEYS.find(candidate => candidate === params.get('sort')) ?? DEFAULT_CHASSIS_VIEW.sort.key;
  const dir = params.get('dir');
  return {
    query: params.get('q') ?? '',
    filters: {
      weightClasses: WEIGHT_CLASSES.filter(weightClass => list(params.get('class')).includes(weightClass)),
      techBase: tech === 'is' ? 'InnerSphere' : tech === 'clan' ? 'Clan' : null,
      jumpJets: params.get('jj') === '1',
      ecm: params.get('ecm') === '1',
      hero: params.get('hero') === '1',
      dlcs: [...new Set(dlcs)].sort((a, b) => a - b),
      roles: list(params.get('role')),
      maxYear: integerIn(params.get('year'), 3000, 3100),
      minHardpoints
    },
    minTons: integerIn(params.get('tmin'), 1, 200),
    maxTons: integerIn(params.get('tmax'), 1, 200),
    minSpeed: integerIn(params.get('speed'), 1, 500),
    sort: { key, dir: dir === 'asc' || dir === 'desc' ? dir : defaultSortDirection(key) }
  };
};

export const toChassisQuery = (view: ChassisView): string => {
  const { filters } = view;
  const params = new URLSearchParams();
  const set = (name: string, value: string | number | null | false) => {
    if (value !== null && value !== false && value !== '') params.set(name, String(value));
  };
  set('q', view.query.trim());
  set('class', filters.weightClasses.join(','));
  set('tech', filters.techBase === 'InnerSphere' ? 'is' : filters.techBase === 'Clan' ? 'clan' : null);
  set('role', filters.roles.join(','));
  set('jj', filters.jumpJets && 1);
  set('ecm', filters.ecm && 1);
  set('hero', filters.hero && 1);
  set('min', HARDPOINT_FILTER_TYPES
    .filter(type => (filters.minHardpoints[type] ?? 0) > 0)
    .map(type => `${filters.minHardpoints[type]}${HARDPOINT_TOKENS[type]}`)
    .join(','));
  set('year', filters.maxYear);
  set('dlc', filters.dlcs.map(dlc => dlc === BASE_GAME ? 'base' : String(dlc)).join(','));
  set('tmin', view.minTons);
  set('tmax', view.maxTons);
  set('speed', view.minSpeed);
  if (view.sort.key !== DEFAULT_CHASSIS_VIEW.sort.key) params.set('sort', view.sort.key);
  if (view.sort.dir !== defaultSortDirection(view.sort.key)) params.set('dir', view.sort.dir);
  // URLSearchParams escribe las comas como %2C; en la dirección se leen mejor tal cual.
  const text = params.toString().replace(/%2C/g, ',');
  return text ? `?${text}` : '';
};
