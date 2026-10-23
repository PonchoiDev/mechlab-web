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

export interface MechFilters {
  weightClasses: WeightClassName[];
  techBase: 'InnerSphere' | 'Clan' | null;
  jumpJets: boolean;
  minHardpoints: Partial<Record<HardpointFilterType, number>>;
}

export const EMPTY_MECH_FILTERS: MechFilters = { weightClasses: [], techBase: null, jumpJets: false, minHardpoints: {} };

export const countActiveFilters = (filters: MechFilters): number =>
  filters.weightClasses.length +
  (filters.techBase ? 1 : 0) +
  (filters.jumpJets ? 1 : 0) +
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
  meetsHardpointMinimums(getHardpointCounts(mech), filters.minHardpoints);

const QUERY_HARDPOINT_TOKEN = /^(\d+)(e|b|m|o|art|ams)$/i;
const TOKEN_TYPES: Record<string, HardpointFilterType> = { e: 'energy', b: 'ballistic', m: 'missile', o: 'omni', art: 'artillery', ams: 'ams' };

// Separa del texto de búsqueda los atajos de filtro: "3e 2m jj" pide al menos 3 de energía,
// 2 de misiles y jump jets. El resto del texto se busca en el nombre, la variante y el ID.
export const parseMechQuery = (query: string): { text: string; filters: Pick<MechFilters, 'jumpJets' | 'minHardpoints'> } => {
  const filters: Pick<MechFilters, 'jumpJets' | 'minHardpoints'> = { jumpJets: false, minHardpoints: {} };
  const words: string[] = [];
  for (const word of query.trim().split(/\s+/).filter(Boolean)) {
    const hardpoint = QUERY_HARDPOINT_TOKEN.exec(word);
    if (hardpoint) {
      filters.minHardpoints[TOKEN_TYPES[hardpoint[2].toLowerCase()]] = Number(hardpoint[1]);
    } else if (word.toLowerCase() === 'jj') {
      filters.jumpJets = true;
    } else {
      words.push(word);
    }
  }
  return { text: words.join(' '), filters };
};

// Combina los filtros del panel con los escritos en el buscador, quedándose con el más exigente.
export const mergeMechFilters = (filters: MechFilters, extra: Pick<MechFilters, 'jumpJets' | 'minHardpoints'>): MechFilters => ({
  ...filters,
  jumpJets: filters.jumpJets || extra.jumpJets,
  minHardpoints: Object.fromEntries(HARDPOINT_FILTER_TYPES.map(type => [
    type,
    Math.max(filters.minHardpoints[type] ?? 0, extra.minHardpoints[type] ?? 0)
  ]))
});
