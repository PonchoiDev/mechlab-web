import type { YamlHardpointType, YamlMech } from '../../types/yaml-mechlab';
import { meetsHardpointMinimums } from '../hardpointMinimums';
import { BASE_GAME, CLAN_INVASION_YEAR, GAME_START_YEAR } from '../mechs';
import { getYamlQuirk } from './data';

// Búsqueda y filtros del selector de 'Mechs del MechLab de YAML (docs/specs/filtros-yaml.md): los del selector de
// MW5 que tienen sentido con YAML y los propios de YAML (quirks, variantes nuevas, superpesados, omni y anclajes
// cuerpo a cuerpo). Sin los de equipo de MW5: en YAML los retrorreactores, el ECM, las sondas y el MASC van en las
// ranuras generales, así que cualquier 'Mech los monta.

export type YamlWeightClass = 'light' | 'medium' | 'heavy' | 'assault';
export const WEIGHT_CLASSES: YamlWeightClass[] = ['light', 'medium', 'heavy', 'assault'];

// Los tramos de MW5: hasta 35 t ligero, hasta 55 medio, hasta 75 pesado y de 80 en adelante asalto.
export function getWeightClass(tonnage: number): YamlWeightClass {
  if (tonnage <= 35) return 'light';
  if (tonnage <= 55) return 'medium';
  if (tonnage <= 75) return 'heavy';
  return 'assault';
}

export const YAML_HARDPOINT_FILTER_TYPES = ['energy', 'ballistic', 'missile', 'omni', 'artillery', 'ams', 'melee'] as const;
export type YamlHardpointFilterType = typeof YAML_HARDPOINT_FILTER_TYPES[number];

export interface YamlMechFilters {
  weightClasses: YamlWeightClass[];
  techBase: 'InnerSphere' | 'Clan' | null;
  roles: string[];
  // Solo las variantes que ya existen ese año de la campaña.
  maxYear: number | null;
  // Fuentes de contenido marcadas (juego base y DLC); vacío, todas.
  dlcs: number[];
  hero: boolean;
  omni: boolean;
  superheavy: boolean;
  yamlOnly: boolean;
  // Quirks marcados: las variantes que los tienen todos.
  quirks: string[];
  minHardpoints: Partial<Record<YamlHardpointFilterType, number>>;
}

export const EMPTY_YAML_FILTERS: YamlMechFilters = {
  weightClasses: [], techBase: null, roles: [], maxYear: null, dlcs: [], hero: false, omni: false, superheavy: false,
  yamlOnly: false, quirks: [], minHardpoints: {}
};

export const isClanMech = (mech: YamlMech): boolean => mech.quirks.includes('CLAN-MECH');
export const isOmniMech = (mech: YamlMech): boolean => mech.quirks.includes('OMNI-MECH');

// Como en MW5: los 'Mechs Clan, desde la invasión.
export const getYamlAvailableYear = (mech: YamlMech): number =>
  Math.max(mech.introYear ?? GAME_START_YEAR, isClanMech(mech) ? CLAN_INVASION_YEAR : GAME_START_YEAR);

export function getYamlHardpointCounts(mech: YamlMech): Record<YamlHardpointFilterType, number> {
  const counts = Object.fromEntries(YAML_HARDPOINT_FILTER_TYPES.map(type => [type, 0])) as Record<YamlHardpointFilterType, number>;
  for (const zone of Object.values(mech.zones)) {
    for (const hardpoint of zone.hardpoints) counts[hardpoint.type as YamlHardpointType & YamlHardpointFilterType] += 1;
  }
  return counts;
}

export const getYamlRoles = (mechs: YamlMech[]): string[] =>
  [...new Set(mechs.map(mech => mech.role).filter((role): role is string => !!role))].sort();

// Los quirks de las variantes, por nombre, para la lista del filtro: solo los que llevan variantes de dos chasis
// o más. Los de un solo chasis (los de las hero, los nombres propios...) son casi todos y se encuentran mejor
// buscando el chasis; el buscador de texto los sigue encontrando.
export function getYamlQuirkOptions(mechs: YamlMech[]): { value: string; label: string }[] {
  const chassis = new Map<string, Set<string>>();
  for (const mech of mechs) {
    for (const id of mech.quirks) chassis.set(id, (chassis.get(id) ?? new Set()).add(mech.chassis));
  }
  return [...chassis].filter(([, names]) => names.size > 1)
    .map(([id]) => ({ value: id, label: getYamlQuirk(id)?.name ?? id }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function countYamlFilters(filters: YamlMechFilters): number {
  return filters.weightClasses.length + (filters.techBase ? 1 : 0) + filters.roles.length + (filters.maxYear !== null ? 1 : 0) +
    filters.dlcs.length + [filters.hero, filters.omni, filters.superheavy, filters.yamlOnly].filter(Boolean).length +
    filters.quirks.length + Object.values(filters.minHardpoints).filter(value => (value ?? 0) > 0).length;
}

export function matchesYamlFilters(mech: YamlMech, filters: YamlMechFilters): boolean {
  return (filters.weightClasses.length === 0 || filters.weightClasses.includes(getWeightClass(mech.tonnage))) &&
    (!filters.techBase || (isClanMech(mech) ? 'Clan' : 'InnerSphere') === filters.techBase) &&
    (filters.roles.length === 0 || (mech.role !== undefined && filters.roles.includes(mech.role))) &&
    (filters.maxYear === null || getYamlAvailableYear(mech) <= filters.maxYear) &&
    (filters.dlcs.length === 0 || filters.dlcs.includes(mech.dlc ?? BASE_GAME)) &&
    (!filters.hero || mech.hero === true) &&
    (!filters.omni || isOmniMech(mech)) &&
    (!filters.superheavy || mech.superheavy === true) &&
    (!filters.yamlOnly || mech.yamlOnly === true) &&
    filters.quirks.every(quirk => mech.quirks.includes(quirk)) &&
    meetsHardpointMinimums(getYamlHardpointCounts(mech), filters.minHardpoints);
}

const QUERY_HARDPOINT_TOKEN = /^(\d+)(e|b|m|o|art|ams|mel)$/i;
const QUERY_DLC_TOKEN = /^dlc([1-9])$/i;
const TOKEN_TYPES: Record<string, YamlHardpointFilterType> = {
  e: 'energy', b: 'ballistic', m: 'missile', o: 'omni', art: 'artillery', ams: 'ams', mel: 'melee'
};
const FLAG_TOKENS: Record<string, Partial<YamlMechFilters>> = {
  hero: { hero: true }, omni: { omni: true }, sh: { superheavy: true }, yaml: { yamlOnly: true }, clan: { techBase: 'Clan' }
};

// Separa del texto los atajos de filtro, como el buscador de MW5 («3e 2mel sh»); el resto se busca en el chasis,
// la variante, el id y los quirks.
export function parseYamlQuery(query: string): { text: string; filters: Partial<YamlMechFilters> } {
  const filters: Partial<YamlMechFilters> = {};
  const minHardpoints: Partial<Record<YamlHardpointFilterType, number>> = {};
  const dlcs: number[] = [];
  const words: string[] = [];
  for (const word of query.trim().split(/\s+/).filter(Boolean)) {
    const lower = word.toLowerCase();
    const hardpoint = QUERY_HARDPOINT_TOKEN.exec(word);
    if (hardpoint) minHardpoints[TOKEN_TYPES[hardpoint[2].toLowerCase()]] = Number(hardpoint[1]);
    else if (FLAG_TOKENS[lower]) Object.assign(filters, FLAG_TOKENS[lower]);
    else if (lower === 'base') dlcs.push(BASE_GAME);
    else if (QUERY_DLC_TOKEN.test(word)) dlcs.push(Number(QUERY_DLC_TOKEN.exec(word)![1]));
    else words.push(word);
  }
  if (Object.keys(minHardpoints).length > 0) filters.minHardpoints = minHardpoints;
  if (dlcs.length > 0) filters.dlcs = dlcs;
  return { text: words.join(' '), filters };
}

// Lo escrito se suma a lo marcado: los anclajes, el mayor de los dos; los DLC, los de los dos.
function mergeYamlFilters(filters: YamlMechFilters, extra: Partial<YamlMechFilters>): YamlMechFilters {
  const minHardpoints = { ...filters.minHardpoints };
  for (const [type, value] of Object.entries(extra.minHardpoints ?? {}) as [YamlHardpointFilterType, number][]) {
    minHardpoints[type] = Math.max(minHardpoints[type] ?? 0, value);
  }
  return {
    ...filters,
    ...extra,
    hero: filters.hero || !!extra.hero,
    omni: filters.omni || !!extra.omni,
    superheavy: filters.superheavy || !!extra.superheavy,
    yamlOnly: filters.yamlOnly || !!extra.yamlOnly,
    techBase: extra.techBase ?? filters.techBase,
    dlcs: [...new Set([...filters.dlcs, ...(extra.dlcs ?? [])])],
    minHardpoints
  };
}

const searchText = (mech: YamlMech) =>
  [mech.chassis, mech.variant, mech.id, ...mech.quirks, ...mech.quirks.map(id => getYamlQuirk(id)?.name ?? '')].join(' ').toLowerCase();

export function filterYamlMechs(mechs: YamlMech[], query: string, filters: YamlMechFilters = EMPTY_YAML_FILTERS): YamlMech[] {
  const parsed = parseYamlQuery(query);
  const combined = mergeYamlFilters(filters, parsed.filters);
  const words = parsed.text.toLowerCase().split(/\s+/).filter(Boolean);
  return mechs
    .filter(mech => matchesYamlFilters(mech, combined))
    .filter(mech => {
      const text = searchText(mech);
      return words.every(word => text.includes(word));
    })
    .sort((a, b) => a.chassis.localeCompare(b.chassis) || a.variant.localeCompare(b.variant));
}
