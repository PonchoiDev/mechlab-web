import type { Zone } from '../../types/mech';
import type { BtHardpoint, BtItem, BtLoadout, BtMech, BtSource, BtWeightClass } from '../../types/battletech-mechlab';
import { getHardpointCount, getLocationUsage, getMountProblem } from './fitting';
import { getItem, HARDPOINTS } from './mechlabData';

// Filtros de los selectores de 'Mech y de objetos del MechLab de BATTLETECH.

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Cada palabra de la búsqueda tiene que estar en el texto: «hbk 4g» encuentra el Hunchback HBK-4G.
const matchesQuery = (text: string, query: string) => {
  const haystack = normalize(text).replace(/-/g, '');
  return normalize(query).split(/\s+/).filter(Boolean).every(word => haystack.includes(word.replace(/-/g, '')));
};

export interface BtMechFilters {
  query: string;
  weightClasses: BtWeightClass[];
  sources: BtSource[];
  minHardpoints: Record<BtHardpoint, number>;
  minJumpJets: number;
  tags: string[];
}

export const DEFAULT_MECH_FILTERS: BtMechFilters = {
  query: '',
  weightClasses: [],
  sources: [],
  minHardpoints: { energy: 0, ballistic: 0, missile: 0, support: 0 },
  minJumpJets: 0,
  tags: []
};

export const countActiveMechFilters = (filters: BtMechFilters): number =>
  (filters.weightClasses.length > 0 ? 1 : 0) + (filters.sources.length > 0 ? 1 : 0) + (filters.minJumpJets > 0 ? 1 : 0)
  + (filters.tags.length > 0 ? 1 : 0) + Object.values(filters.minHardpoints).filter(value => value > 0).length;

const QUERY_HARDPOINT_TOKEN = /^(\d)([ebms])$/i;
const QUERY_JUMP_TOKEN = /^(\d)?jj$/i;
const TOKEN_HARDPOINTS: Record<string, BtHardpoint> = { e: 'energy', b: 'ballistic', m: 'missile', s: 'support' };

// Atajos del buscador, como los del MechLab de MW5: «3e 2m» pide al menos 3 anclajes Energy y 2
// Missile, y «jj» (o «6jj») retrorreactores. Se combinan con los del panel, quedándose con el mayor.
export const parseBtMechQuery = (query: string): { text: string; minHardpoints: Partial<Record<BtHardpoint, number>>; minJumpJets: number } => {
  const minHardpoints: Partial<Record<BtHardpoint, number>> = {};
  let minJumpJets = 0;
  const words: string[] = [];
  for (const word of query.trim().split(/\s+/).filter(Boolean)) {
    const hardpoint = QUERY_HARDPOINT_TOKEN.exec(word);
    const jump = QUERY_JUMP_TOKEN.exec(word);
    if (hardpoint) minHardpoints[TOKEN_HARDPOINTS[hardpoint[2].toLowerCase()]] = Number(hardpoint[1]);
    else if (jump) minJumpJets = Number(jump[1] ?? 1);
    else words.push(word);
  }
  return { text: words.join(' '), minHardpoints, minJumpJets };
};

// Una etiqueta basta para que pase: el filtro de rol es «cualquiera de estas».
export const filterBtMechs = (mechs: BtMech[], filters: BtMechFilters): BtMech[] => {
  const parsed = parseBtMechQuery(filters.query);
  const minimum = (type: BtHardpoint) => Math.max(filters.minHardpoints[type], parsed.minHardpoints[type] ?? 0);
  const minJumpJets = Math.max(filters.minJumpJets, parsed.minJumpJets);
  return mechs.filter(mech =>
    (filters.weightClasses.length === 0 || filters.weightClasses.includes(mech.weightClass))
    && (filters.sources.length === 0 || filters.sources.includes(mech.source))
    && HARDPOINTS.every(type => getHardpointCount(mech, type) >= minimum(type))
    && mech.maxJumpJets >= minJumpJets
    && (filters.tags.length === 0 || filters.tags.some(tag => mech.tags.includes(tag)))
    && matchesQuery(`${mech.name} ${mech.variant} ${mech.role}`, parsed.text));
};

export type BtItemTab = BtHardpoint | 'ammo' | 'heatSink' | 'jumpJet' | 'upgrade';

export const ITEM_TABS: { tab: BtItemTab; label: string }[] = [
  { tab: 'energy', label: 'Energy' },
  { tab: 'ballistic', label: 'Ballistic' },
  { tab: 'missile', label: 'Missile' },
  { tab: 'support', label: 'Support' },
  { tab: 'ammo', label: 'Ammo' },
  { tab: 'heatSink', label: 'Heat sinks' },
  { tab: 'jumpJet', label: 'Jump jets' },
  { tab: 'upgrade', label: 'Upgrades' }
];

// Rareza del juego (Description.Rarity): de 0 a 5 en las tiendas, y 99 o 100 en lo que solo sale como
// recompensa o tecnología perdida.
export type BtRarityGroup = 'common' | 'uncommon' | 'rare' | 'special';

export const RARITY_GROUPS: { group: BtRarityGroup; label: string; title: string }[] = [
  { group: 'common', label: 'Common', title: 'Rarity 0 and 1 in the game data' },
  { group: 'uncommon', label: 'Uncommon', title: 'Rarity 2 and 3 in the game data' },
  { group: 'rare', label: 'Rare', title: 'Rarity 4 and 5 in the game data' },
  { group: 'special', label: 'Special', title: 'Rarity 99 or 100: rewards and lostech that random shops do not sell' }
];

export const getRarityGroup = (rarity: number): BtRarityGroup =>
  rarity >= 99 ? 'special' : rarity >= 4 ? 'rare' : rarity >= 2 ? 'uncommon' : 'common';

export type BtItemSort = 'name' | 'tonnage' | 'damage' | 'heat' | 'damagePerTon' | 'cost';

export const ITEM_SORTS: { sort: BtItemSort; label: string; weaponsOnly?: boolean }[] = [
  { sort: 'name', label: 'Name' },
  { sort: 'tonnage', label: 'Weight' },
  { sort: 'damage', label: 'Damage', weaponsOnly: true },
  { sort: 'heat', label: 'Heat', weaponsOnly: true },
  { sort: 'damagePerTon', label: 'Damage/t', weaponsOnly: true },
  { sort: 'cost', label: 'Cost' }
];

export interface BtItemFilters {
  tab: BtItemTab;
  query: string;
  plus: number[];
  sources: BtSource[];
  rarities: BtRarityGroup[];
  sort: BtItemSort;
}

export const DEFAULT_ITEM_FILTERS: BtItemFilters = {
  tab: 'energy',
  query: '',
  plus: [],
  sources: [],
  rarities: [],
  sort: 'name'
};

// La pestaña de un objeto: las armas van por su anclaje y el resto por su tipo.
export const getItemTab = (item: BtItem): BtItemTab => item.kind === 'weapon' ? item.hardpoint ?? 'energy' : item.kind;

export const isInTab = (item: BtItem, tab: BtItemTab): boolean => getItemTab(item) === tab;

// Al elegir una ubicación, si la pestaña de armas abierta no tiene anclajes libres ahí, se pasa a la
// primera que sí los tiene: en el torso derecho del Hunchback se abren las balísticas.
export const getPreferredTab = (mech: BtMech, loadout: BtLoadout, zone: Zone, tab: BtItemTab): BtItemTab => {
  if (!HARDPOINTS.includes(tab as BtHardpoint)) return tab;
  const usage = getLocationUsage(mech, loadout, zone);
  const hasRoom = (type: BtHardpoint) => usage.hardpoints[type].used < usage.hardpoints[type].capacity;
  if (hasRoom(tab as BtHardpoint)) return tab;
  return HARDPOINTS.find(hasRoom) ?? tab;
};

export const getWeaponDamage =(item: BtItem): number => item.weapon ? item.weapon.damage * item.weapon.shots : 0;

const SORT_VALUE: Record<Exclude<BtItemSort, 'name'>, (item: BtItem) => number> = {
  tonnage: item => item.tonnage,
  damage: getWeaponDamage,
  heat: item => item.weapon?.heat ?? 0,
  damagePerTon: item => item.tonnage > 0 ? getWeaponDamage(item) / item.tonnage : 0,
  cost: item => item.cost
};

const byName = (a: BtItem, b: BtItem) => a.baseName.localeCompare(b.baseName) || a.plus - b.plus || a.name.localeCompare(b.name);

// El equipo de serie (BUILT-IN) no sale: no se puede montar, solo viene fijo en algunos chasis. Se
// ordena de mayor a menor salvo por nombre, peso (lo ligero antes), calor (lo frío antes) y coste.
export const filterBtItems = (items: BtItem[], filters: BtItemFilters): BtItem[] => {
  const filtered = items.filter(item =>
    !item.builtIn
    && isInTab(item, filters.tab)
    && (filters.plus.length === 0 || filters.plus.includes(item.plus))
    && (filters.sources.length === 0 || filters.sources.includes(item.source))
    && (filters.rarities.length === 0 || filters.rarities.includes(getRarityGroup(item.rarity)))
    && matchesQuery(`${item.name} ${item.manufacturer}`, filters.query));
  if (filters.sort === 'name') return filtered.sort(byName);
  const value = SORT_VALUE[filters.sort];
  const ascending = filters.sort === 'tonnage' || filters.sort === 'heat' || filters.sort === 'cost';
  return filtered.sort((a, b) => (ascending ? value(a) - value(b) : value(b) - value(a)) || byName(a, b));
};

// Filtros del panel de una ubicación, que sigue al ComponentEditor de MW5: búsqueda y, como propios de
// BATTLETECH, versión (+, + +, + + +), fuente y rareza.
export interface BtPanelFilters {
  query: string;
  plus: number[];
  sources: BtSource[];
  rarities: BtRarityGroup[];
}

export const EMPTY_PANEL_FILTERS: BtPanelFilters = { query: '', plus: [], sources: [], rarities: [] };

export const hasPanelFilters = (filters: BtPanelFilters) =>
  filters.query.trim() !== '' || filters.plus.length > 0 || filters.sources.length > 0 || filters.rarities.length > 0;

export const matchesPanelFilters = (item: BtItem, filters: BtPanelFilters): boolean =>
  (filters.plus.length === 0 || filters.plus.includes(item.plus))
  && (filters.sources.length === 0 || filters.sources.includes(item.source))
  && (filters.rarities.length === 0 || filters.rarities.includes(getRarityGroup(item.rarity)))
  && matchesQuery(`${item.name} ${item.manufacturer}`, filters.query);

export type BtWeaponSortOrder = 'large-first' | 'small-first';

// Como Largest y Smallest del panel de MW5, donde el tamaño es el del anclaje: aquí son las ranuras y, a
// igualdad, el peso; después, el nombre con su versión.
export const sortBtWeapons = (items: BtItem[], order: BtWeaponSortOrder): BtItem[] => {
  const direction = order === 'large-first' ? -1 : 1;
  return [...items].sort((a, b) => direction * (a.slots - b.slots) || direction * (a.tonnage - b.tonnage) || byName(a, b));
};

// Lo que cabe ahora en una ubicación, como getEquippableItems de MW5. Con un anclaje ocupado elegido,
// las armas de su tipo que caben si se quita la que tiene (para cambiarla).
export const getEquippableBtItems = (mech: BtMech, loadout: BtLoadout, zone: Zone, items: BtItem[]): BtItem[] =>
  items.filter(item => !getMountProblem(mech, loadout, zone, item));

export const getReplacementWeapons = (mech: BtMech, loadout: BtLoadout, zone: Zone, index: number, items: BtItem[]): BtItem[] => {
  const current = loadout[zone][index];
  const type = getItem(current)?.hardpoint;
  const without = { ...loadout, [zone]: loadout[zone].filter((_, position) => position !== index) };
  return items.filter(item => item.kind === 'weapon' && item.hardpoint === type && item.id !== current && !getMountProblem(mech, without, zone, item));
};
