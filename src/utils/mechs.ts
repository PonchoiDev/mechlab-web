import type { Mech } from '../types/mech';
import { getSarnaTitle } from '../services/sarna';

export const getMechDisplayName = (mech: Mech): string => {
  const sarnaTitle = getSarnaTitle(mech);
  return sarnaTitle.toLocaleLowerCase() !== mech.name.toLocaleLowerCase()
    ? `${mech.name} (${sarnaTitle})`
    : mech.name;
};

export const matchesMechQuery = (mech: Mech, query: string): boolean => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return !normalizedQuery || [mech.name, mech.sarnaName ?? mech.name, getSarnaTitle(mech), mech.variant, mech.id]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery));
};

export type WeightClassName = 'light' | 'medium' | 'heavy' | 'assault';

export const getMechWeightClass = (mech: Mech): WeightClassName =>
  mech.tonnageMax <= 35 ? 'light' : mech.tonnageMax <= 55 ? 'medium' : mech.tonnageMax <= 75 ? 'heavy' : 'assault';

// Tipos de anclaje que se resumen y filtran, con la abreviatura que usa la comunidad (3E 2B 1M…).
// El cuerpo a cuerpo no se incluye: todos los mechs lo tienen en los brazos.
export const HARDPOINT_FILTER_TYPES = ['energy', 'ballistic', 'missile', 'omni', 'artillery', 'ams'] as const;
export type HardpointFilterType = typeof HARDPOINT_FILTER_TYPES[number];

// El omni se escribe entero: "2O" se confunde con "20" en la fuente monoespaciada.
export const HARDPOINT_ABBREVIATIONS: Record<HardpointFilterType, string> = {
  energy: 'E',
  ballistic: 'B',
  missile: 'M',
  omni: ' Omni',
  artillery: 'ART',
  ams: 'AMS'
};

export const getHardpointCounts = (mech: Mech): Record<HardpointFilterType, number> => {
  const counts = Object.fromEntries(HARDPOINT_FILTER_TYPES.map(type => [type, 0])) as Record<HardpointFilterType, number>;
  for (const component of Object.values(mech.components)) {
    for (const hardpoint of component.hardpoints) {
      if (hardpoint.type in counts) counts[hardpoint.type as HardpointFilterType] += 1;
    }
  }
  return counts;
};

export const hasJumpJets = (mech: Mech): boolean =>
  Object.values(mech.components).some(component =>
    component.jumpJetSlots > 0 ||
    Object.entries(component.specialSlots ?? {}).some(([slotType, count]) => slotType.startsWith('JumpJet') && Number(count) > 0));

// La campaña de MW5: Mercenaries empieza en 3015: los mechs de antes ya están disponibles desde
// entonces. Los Clan traen la fecha del lore de los Clanes, pero un mercenario no los consigue
// hasta la invasión de la Esfera Interior.
export const GAME_START_YEAR = 3015;
export const CLAN_INVASION_YEAR = 3050;

export const getAvailableYear = (mech: Mech): number => Math.max(
  mech.introYear ?? GAME_START_YEAR,
  mech.techBase === 'Clan' ? CLAN_INVASION_YEAR : GAME_START_YEAR
);

// Solo pueden montar ECM los mechs con una ranura especial para él.
export const hasEcm = (mech: Mech): boolean =>
  Object.values(mech.components).some(component => (component.specialSlots?.ECM_SlotType ?? 0) > 0);

// Fuente de contenido de una variante: 0 para el juego base y 1 a 9 para su DLC.
export const BASE_GAME = 0;
export const CONTENT_SOURCES = [BASE_GAME, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const getContentSource = (mech: Mech): number => mech.dlc ?? BASE_GAME;

export const getContentSourceLabel = (source: number): string => source === BASE_GAME ? 'Base' : `DLC ${source}`;

// Resumen de una selección para el botón de un desplegable: «All», «Sniper, Scout» o «4 selected».
export const describeSelection = (labels: string[]): string => {
  if (labels.length === 0) return 'All';
  if (labels.length > 2) return `${labels.length} selected`;
  return labels.join(', ');
};

export const describeContentSources = (sources: number[]): string =>
  describeSelection([...sources].sort((a, b) => a - b).map(getContentSourceLabel));

// Roles de combate de las fichas de unidad (Sniper, Brawler…), en orden alfabético.
export const getMechRoles = (mechs: Mech[]): string[] =>
  [...new Set(mechs.flatMap(mech => mech.role ?? []))].sort();

export interface MechFilters {
  weightClasses: WeightClassName[];
  techBase: 'InnerSphere' | 'Clan' | null;
  jumpJets: boolean;
  ecm: boolean;
  hero: boolean;
  // Fuentes de contenido marcadas (juego base y DLC); vacío, todas.
  dlcs: number[];
  // Roles de combate marcados; vacío, todos.
  roles: string[];
  // Solo los mechs que ya existen en ese año de la campaña (fecha de aparición de su unit card).
  maxYear: number | null;
  minHardpoints: Partial<Record<HardpointFilterType, number>>;
}

type QueryFilters = Pick<MechFilters, 'jumpJets' | 'ecm' | 'hero' | 'dlcs' | 'minHardpoints'>;

export const EMPTY_MECH_FILTERS: MechFilters = {
  weightClasses: [],
  techBase: null,
  jumpJets: false,
  ecm: false,
  hero: false,
  dlcs: [],
  roles: [],
  maxYear: null,
  minHardpoints: {}
};

export const countActiveFilters = (filters: MechFilters): number =>
  filters.weightClasses.length +
  (filters.techBase ? 1 : 0) +
  (filters.jumpJets ? 1 : 0) +
  (filters.ecm ? 1 : 0) +
  (filters.hero ? 1 : 0) +
  (filters.dlcs.length > 0 ? 1 : 0) +
  (filters.roles.length > 0 ? 1 : 0) +
  (filters.maxYear !== null ? 1 : 0) +
  Object.values(filters.minHardpoints).filter(count => (count ?? 0) > 0).length;

const OMNI_COMPATIBLE: HardpointFilterType[] = ['energy', 'ballistic', 'missile'];

// Los anclajes omni sirven de comodín para energía, balística y misiles: un mech con 1E y 2O cumple
// "al menos 3E". Cada omni solo cuenta una vez, aunque se pidan varios tipos.
const meetsHardpointMinimums = (counts: Record<HardpointFilterType, number>, minimums: MechFilters['minHardpoints']): boolean => {
  let spareOmni = counts.omni - (minimums.omni ?? 0);
  if (spareOmni < 0) return false;
  for (const type of HARDPOINT_FILTER_TYPES) {
    if (type === 'omni') continue;
    const missing = (minimums[type] ?? 0) - counts[type];
    if (missing <= 0) continue;
    if (!OMNI_COMPATIBLE.includes(type)) return false;
    spareOmni -= missing;
    if (spareOmni < 0) return false;
  }
  return true;
};

export const matchesMechFilters = (mech: Mech, filters: MechFilters): boolean =>
  (filters.weightClasses.length === 0 || filters.weightClasses.includes(getMechWeightClass(mech))) &&
  (!filters.techBase || (mech.techBase ?? 'InnerSphere') === filters.techBase) &&
  (!filters.jumpJets || hasJumpJets(mech)) &&
  (!filters.ecm || hasEcm(mech)) &&
  (!filters.hero || mech.hero === true) &&
  (filters.dlcs.length === 0 || filters.dlcs.includes(getContentSource(mech))) &&
  (filters.roles.length === 0 || (mech.role !== undefined && filters.roles.includes(mech.role))) &&
  (filters.maxYear === null || getAvailableYear(mech) <= filters.maxYear) &&
  meetsHardpointMinimums(getHardpointCounts(mech), filters.minHardpoints);

const QUERY_HARDPOINT_TOKEN = /^(\d+)(e|b|m|o|art|ams)$/i;
const QUERY_DLC_TOKEN = /^dlc([1-9])$/i;
const TOKEN_TYPES: Record<string, HardpointFilterType> = { e: 'energy', b: 'ballistic', m: 'missile', o: 'omni', art: 'artillery', ams: 'ams' };

// Separa del texto de búsqueda los atajos de filtro: "3e 2m jj ecm" pide al menos 3 de energía,
// 2 de misiles, jump jets y ECM; "hero", las variantes hero; "dlc7" o "base", esa fuente de contenido.
// El resto del texto se busca en el nombre, la variante y el ID.
export const parseMechQuery = (query: string): { text: string; filters: QueryFilters } => {
  const filters: QueryFilters = { jumpJets: false, ecm: false, hero: false, dlcs: [], minHardpoints: {} };
  const words: string[] = [];
  for (const word of query.trim().split(/\s+/).filter(Boolean)) {
    const hardpoint = QUERY_HARDPOINT_TOKEN.exec(word);
    if (hardpoint) {
      filters.minHardpoints[TOKEN_TYPES[hardpoint[2].toLowerCase()]] = Number(hardpoint[1]);
    } else if (word.toLowerCase() === 'jj') {
      filters.jumpJets = true;
    } else if (word.toLowerCase() === 'ecm') {
      filters.ecm = true;
    } else if (word.toLowerCase() === 'hero') {
      filters.hero = true;
    } else if (word.toLowerCase() === 'base') {
      filters.dlcs.push(BASE_GAME);
    } else if (QUERY_DLC_TOKEN.test(word)) {
      filters.dlcs.push(Number(QUERY_DLC_TOKEN.exec(word)![1]));
    } else {
      words.push(word);
    }
  }
  return { text: words.join(' '), filters };
};

// Combina los filtros del panel con los escritos en el buscador, quedándose con el más exigente.
export const mergeMechFilters = (filters: MechFilters, extra: QueryFilters): MechFilters => ({
  ...filters,
  jumpJets: filters.jumpJets || extra.jumpJets,
  ecm: filters.ecm || extra.ecm,
  hero: filters.hero || extra.hero,
  // Las fuentes se suman: el panel con DLC 1 y el buscador con dlc7 muestran las dos.
  dlcs: [...new Set([...filters.dlcs, ...extra.dlcs])],
  minHardpoints: Object.fromEntries(HARDPOINT_FILTER_TYPES.map(type => [
    type,
    Math.max(filters.minHardpoints[type] ?? 0, extra.minHardpoints[type] ?? 0)
  ]))
});

const SIZE_ORDER: Record<string, number> = { large: 0, medium: 1, small: 2 };
const SIZE_LETTERS: Record<string, string> = { large: 'L', medium: 'M', small: 'S' };

// Anclajes agrupados por tipo y tamaño, de mayor a menor: 2E·M 1E·L se muestra como 1E·L 2E·M.
export const getHardpointGroups = (mech: Mech): { type: HardpointFilterType; size: string; sizeLetter: string; count: number }[] => {
  const groups = new Map<string, { type: HardpointFilterType; size: string; sizeLetter: string; count: number }>();
  for (const component of Object.values(mech.components)) {
    for (const hardpoint of component.hardpoints) {
      if (!(HARDPOINT_FILTER_TYPES as readonly string[]).includes(hardpoint.type)) continue;
      const type = hardpoint.type as HardpointFilterType;
      const key = `${type}:${hardpoint.size}`;
      const group = groups.get(key) ?? { type, size: hardpoint.size, sizeLetter: SIZE_LETTERS[hardpoint.size] ?? '', count: 0 };
      group.count += 1;
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) =>
    HARDPOINT_FILTER_TYPES.indexOf(a.type) - HARDPOINT_FILTER_TYPES.indexOf(b.type) || SIZE_ORDER[a.size] - SIZE_ORDER[b.size]);
};

export type SpecKind = 'engine' | 'xl' | 'dhs' | 'endo' | 'ferro' | 'ap';

// Especificaciones del chasis como las muestra el mechlab del juego: 325 C-XL DHS C-ENDO C-FERRO AP.
export const getMechSpecs = (mech: Mech): { kind: SpecKind; label: string }[] => {
  const clan = mech.techBase === 'Clan' ? 'C-' : '';
  const specs: { kind: SpecKind; label: string }[] = [];
  if (mech.engine) {
    specs.push({ kind: 'engine', label: String(mech.engine.rating) });
    specs.push(mech.engine.xl ? { kind: 'xl', label: `${clan}XL` } : { kind: 'engine', label: 'STD' });
  }
  if (mech.heatSinkType === 'double' || mech.heatSinkType === 'clanDouble') specs.push({ kind: 'dhs', label: 'DHS' });
  if (mech.structureType === 'endoSteel') specs.push({ kind: 'endo', label: `${clan}ENDO` });
  if (mech.armorType === 'ferroFibrous') specs.push({ kind: 'ferro', label: `${clan}FERRO` });
  if (mech.activeProbe) specs.push({ kind: 'ap', label: 'AP' });
  return specs;
};
