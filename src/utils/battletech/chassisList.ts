import type { BtHardpoint, BtMech, BtSource, BtWeightClass } from '../../types/battletech-mechlab';
import type { BuildTag } from '../savedBuildsList';
import { mapZones } from '../zones';
import { defaultSortDirection, sortByColumn, type ColumnSort } from '../tableSort';
import { getBtBuildTags } from './buildTags';
import { SOURCES } from './catalog';
import { DEFAULT_MECH_FILTERS, filterBtMechs, type BtMechFilters } from './filters';
import { createEmptyBtLoadout, getAllItems, getHardpointCount } from './fitting';
import { HARDPOINTS, MECH_TAGS, WEIGHT_CLASSES } from './mechlabData';
import { getBuildSummary } from './stats';

// Lista de chasis de BATTLETECH (docs/specs/battletech-lista-chasis.md): una fila por variante con las cifras
// del chasis vacío. Los filtros son los del selector de 'Mechs del MechLab de BATTLETECH (filters.ts).

export interface BtChassisRow {
  mech: BtMech;
  chassis: string;
  tonnage: number;
  hardpoints: Record<BtHardpoint, number>;
  hardpointTotal: number;
  // Del chasis sin equipo ni armadura, con su equipo fijo: lo que queda para cargarlo.
  freeTonnage: number;
  armor: number;
  structure: number;
  // Metros por turno, con lo que cambie el equipo fijo.
  walk: number | null;
  sprint: number | null;
  jumpJets: number;
  stability: number;
  melee: number;
  dfa: number;
  // El equipo fijo del chasis, con las etiquetas de My builds.
  fixed: BuildTag[];
}

export const getBtChassisRows = (mechs: BtMech[]): BtChassisRow[] => mechs.map(mech => {
  const empty = { mech, loadout: createEmptyBtLoadout(), armor: mapZones(() => ({ front: 0, rear: 0 })) };
  const summary = getBuildSummary(empty);
  const hardpoints = Object.fromEntries(HARDPOINTS.map(type => [type, getHardpointCount(mech, type)])) as Record<BtHardpoint, number>;
  return {
    mech,
    chassis: mech.name,
    tonnage: mech.tonnage,
    hardpoints,
    hardpointTotal: Object.values(hardpoints).reduce((total, count) => total + count, 0),
    freeTonnage: summary.freeTonnage,
    armor: summary.maxArmorPoints,
    structure: summary.structure,
    walk: summary.walk,
    sprint: summary.sprint,
    jumpJets: mech.maxJumpJets,
    stability: mech.stability,
    melee: mech.melee.damage,
    dfa: mech.dfa.damage,
    fixed: getBtBuildTags(getAllItems(mech, empty.loadout))
  };
});

export const countBtChassis = (rows: BtChassisRow[]): number => new Set(rows.map(row => row.mech.name)).size;

export type BtChassisSortKey =
  | 'name' | 'tonnage' | 'hardpoints' | 'freeTonnage' | 'armor' | 'structure' | 'walk' | 'sprint'
  | 'jumpJets' | 'stability' | 'melee' | 'dfa' | 'source';

export const BT_CHASSIS_SORT_KEYS: BtChassisSortKey[] = [
  'name', 'tonnage', 'hardpoints', 'freeTonnage', 'armor', 'structure', 'walk', 'sprint', 'jumpJets', 'stability', 'melee', 'dfa', 'source'
];

export type BtChassisSort = ColumnSort<BtChassisSortKey>;

// La fuente se ordena como la lista del juego: base, Heavy Metal, Flashpoint, Urban Warfare.
const sortValue = (row: BtChassisRow, key: Exclude<BtChassisSortKey, 'name'>): number | null => {
  switch (key) {
    case 'hardpoints': return row.hardpointTotal;
    case 'source': return SOURCES.indexOf(row.mech.source);
    default: return row[key];
  }
};

const byName = (a: BtChassisRow, b: BtChassisRow) =>
  a.chassis.localeCompare(b.chassis) || a.mech.variant.localeCompare(b.mech.variant);

export const sortBtChassisRows = (rows: BtChassisRow[], sort: BtChassisSort): BtChassisRow[] =>
  sortByColumn(rows, sort, sortValue, byName);

export interface BtChassisView {
  // Con la búsqueda dentro, como en el selector.
  filters: BtMechFilters;
  minTons: number | null;
  maxTons: number | null;
  minSprint: number | null;
  sort: BtChassisSort;
}

export const DEFAULT_BT_CHASSIS_VIEW: BtChassisView = {
  filters: DEFAULT_MECH_FILTERS,
  minTons: null,
  maxTons: null,
  minSprint: null,
  sort: { key: 'name', dir: 'asc' }
};

export const filterBtChassisRows = (rows: BtChassisRow[], view: BtChassisView): BtChassisRow[] => {
  const shown = new Set(filterBtMechs(rows.map(row => row.mech), view.filters));
  return rows.filter(row =>
    shown.has(row.mech) &&
    (view.minTons === null || row.tonnage >= view.minTons) &&
    (view.maxTons === null || row.tonnage <= view.maxTons) &&
    (view.minSprint === null || (row.sprint ?? 0) >= view.minSprint));
};

// La variante basta: el MechLab la acepta en ?mech= igual que el id (findMech).
export const getBtChassisLink = (mech: BtMech): string => `/battletech/?mech=${encodeURIComponent(mech.variant)}`;

const HARDPOINT_TOKENS: Record<BtHardpoint, string> = { energy: 'e', ballistic: 'b', missile: 'm', support: 's' };
const HARDPOINT_TOKEN = /^(\d{1,2})([ebms])$/;

const list = (value: string | null) => (value ?? '').split(',').map(part => part.trim()).filter(Boolean);
const integerIn = (value: string | null, min: number, max: number): number | null => {
  if (value === null || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
};

// La vista va en la URL, como en la lista de MW5 (?class=light&min=3e,1s&jj=4&sort=sprint); lo que no se
// reconoce se ignora.
export const parseBtChassisQuery = (search: string): BtChassisView => {
  const params = new URLSearchParams(search);
  const minHardpoints = { ...DEFAULT_MECH_FILTERS.minHardpoints };
  for (const token of list(params.get('min'))) {
    const match = HARDPOINT_TOKEN.exec(token.toLowerCase());
    const type = match && HARDPOINTS.find(candidate => HARDPOINT_TOKENS[candidate] === match[2]);
    if (match && type) minHardpoints[type] = Number(match[1]);
  }
  const classes = list(params.get('class'));
  const sources = list(params.get('source'));
  const roles = list(params.get('role'));
  const key = BT_CHASSIS_SORT_KEYS.find(candidate => candidate === params.get('sort')) ?? DEFAULT_BT_CHASSIS_VIEW.sort.key;
  const dir = params.get('dir');
  return {
    filters: {
      query: params.get('q') ?? '',
      weightClasses: WEIGHT_CLASSES.filter((weightClass: BtWeightClass) => classes.includes(weightClass)),
      sources: SOURCES.filter((source: BtSource) => sources.includes(source)),
      tags: MECH_TAGS.filter(tag => roles.includes(tag)),
      minHardpoints,
      minJumpJets: integerIn(params.get('jj'), 0, 20) ?? 0
    },
    minTons: integerIn(params.get('tmin'), 1, 200),
    maxTons: integerIn(params.get('tmax'), 1, 200),
    minSprint: integerIn(params.get('sprint'), 1, 1000),
    sort: { key, dir: dir === 'asc' || dir === 'desc' ? dir : defaultSortDirection(key) }
  };
};

export const toBtChassisQuery = (view: BtChassisView): string => {
  const { filters } = view;
  const params = new URLSearchParams();
  const set = (name: string, value: string | number | null) => {
    if (value !== null && value !== '' && value !== 0) params.set(name, String(value));
  };
  set('q', filters.query.trim());
  set('class', filters.weightClasses.join(','));
  set('source', filters.sources.join(','));
  set('role', filters.tags.join(','));
  set('min', HARDPOINTS
    .filter(type => filters.minHardpoints[type] > 0)
    .map(type => `${filters.minHardpoints[type]}${HARDPOINT_TOKENS[type]}`)
    .join(','));
  set('jj', filters.minJumpJets);
  set('tmin', view.minTons);
  set('tmax', view.maxTons);
  set('sprint', view.minSprint);
  if (view.sort.key !== DEFAULT_BT_CHASSIS_VIEW.sort.key) params.set('sort', view.sort.key);
  if (view.sort.dir !== defaultSortDirection(view.sort.key)) params.set('dir', view.sort.dir);
  const text = params.toString().replace(/%2C/g, ',');
  return text ? `?${text}` : '';
};
