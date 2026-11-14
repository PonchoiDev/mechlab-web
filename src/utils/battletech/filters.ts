import type { BtHardpoint, BtItem, BtMech, BtSource, BtWeightClass } from '../../types/battletech-mechlab';
import { getHardpointCount } from './fitting';

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

// Una etiqueta basta para que pase: el filtro de rol es «cualquiera de estas».
export const filterBtMechs = (mechs: BtMech[], filters: BtMechFilters): BtMech[] => mechs.filter(mech =>
  (filters.weightClasses.length === 0 || filters.weightClasses.includes(mech.weightClass))
  && (filters.sources.length === 0 || filters.sources.includes(mech.source))
  && (Object.entries(filters.minHardpoints) as [BtHardpoint, number][]).every(([type, min]) => getHardpointCount(mech, type) >= min)
  && mech.maxJumpJets >= filters.minJumpJets
  && (filters.tags.length === 0 || filters.tags.some(tag => mech.tags.includes(tag)))
  && matchesQuery(`${mech.name} ${mech.variant} ${mech.role}`, filters.query));

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

export const isInTab = (item: BtItem, tab: BtItemTab): boolean =>
  item.kind === 'weapon' ? item.hardpoint === tab : item.kind === tab;

export const getWeaponDamage = (item: BtItem): number => item.weapon ? item.weapon.damage * item.weapon.shots : 0;

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
