import type { BtHardpoint, BtItem, BtSource, BtUpgradeGroup } from '../../types/battletech-mechlab';
import type { Zone } from '../../types/mech';
import { ZONE_KEYS, ZONE_LABELS } from '../zones';
import { getRarityGroup, HARDPOINTS, RARITY_GROUPS, SOURCES, type BtRarityGroup } from './catalog';

// Página de armas y equipo de BATTLETECH (docs/specs/battletech-equipo.md): filas de la tabla de armas,
// filtros, orden, categorías y efectos del equipo, munición y vista en la URL. Recibe el catálogo
// como parámetro y no importa mechlabData, para que la página no cargue los 'Mechs.

export interface BtWeaponRow {
  item: BtItem;
  // Un ataque: el daño por disparo por los disparos (un LRM20 son 20 misiles de 4).
  damage: number;
  damagePerShot: number;
  shots: number;
  instability: number;
  heat: number;
  heatDamage: number;
  // Como la escribe el juego: positiva es mejor (en los datos, AccuracyModifier negativo).
  accuracy: number;
  crit: number;
  minRange: number;
  rangeSplit: number[];
  maxRange: number;
  indirectFire: boolean;
  // Cargas de una tonelada de su munición y ataques que dan; null en las armas sin munición.
  ammoPerTon: number | null;
  attacksPerTon: number | null;
  // Con el tonelaje del arma sola, sin la munición.
  damagePerTon: number | null;
}

const round = (value: number) => Math.round(value * 100) / 100;

// La caja de una tonelada (no la media) de cada categoría de munición.
const getFullTonAmmo = (items: BtItem[]): Map<string, BtItem> =>
  new Map(items.filter(item => item.ammo?.category && item.tonnage === 1).map(item => [item.ammo!.category!, item]));

export const getBtWeaponRows = (items: BtItem[]): BtWeaponRow[] => {
  const ammo = getFullTonAmmo(items);
  return items.filter(item => item.kind === 'weapon' && item.weapon).map(item => {
    const weapon = item.weapon!;
    const damage = weapon.damage * weapon.shots;
    const ammoPerTon = weapon.ammoCategory ? ammo.get(weapon.ammoCategory)?.ammo?.capacity ?? null : null;
    return {
      item,
      damage,
      damagePerShot: weapon.damage,
      shots: weapon.shots,
      instability: weapon.instability * weapon.shots,
      heat: weapon.heat,
      heatDamage: weapon.heatDamage * weapon.shots,
      accuracy: weapon.accuracy === 0 ? 0 : -weapon.accuracy,
      crit: weapon.critChance,
      minRange: weapon.minRange,
      rangeSplit: weapon.rangeSplit,
      maxRange: weapon.maxRange,
      indirectFire: weapon.indirectFire,
      ammoPerTon,
      attacksPerTon: ammoPerTon === null ? null : Math.floor(ammoPerTon / Math.max(weapon.shots, 1)),
      damagePerTon: item.tonnage > 0 ? round(damage / item.tonnage) : null
    };
  });
};

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Cada palabra tiene que estar en el nombre o en el fabricante: «kali yama» o «ac/10 kali».
const matchesQuery = (item: BtItem, query: string) => {
  const haystack = normalize(`${item.name} ${item.manufacturer}`);
  return normalize(query).split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
};

export const PLUS_OPTIONS: { plus: number; label: string }[] = [
  { plus: 0, label: 'Stock' },
  { plus: 1, label: '+' },
  { plus: 2, label: '+ +' },
  { plus: 3, label: '+ + +' }
];

interface CommonFilter {
  query: string;
  plus: number | 'all';
  source: BtSource | 'all';
  rarity: BtRarityGroup | 'all';
}

const matchesCommon = (item: BtItem, { query, plus, source, rarity }: CommonFilter) =>
  (plus === 'all' || item.plus === plus) &&
  (source === 'all' || item.source === source) &&
  (rarity === 'all' || getRarityGroup(item.rarity) === rarity) &&
  matchesQuery(item, query);

export interface BtWeaponFilter extends CommonFilter {
  hardpoint: BtHardpoint | 'all';
}

export const DEFAULT_BT_WEAPON_FILTER: BtWeaponFilter = { query: '', hardpoint: 'all', plus: 'all', source: 'all', rarity: 'all' };

export const filterBtWeaponRows = (rows: BtWeaponRow[], filter: BtWeaponFilter): BtWeaponRow[] =>
  rows.filter(row => (filter.hardpoint === 'all' || row.item.hardpoint === filter.hardpoint) && matchesCommon(row.item, filter));

export type BtWeaponSortKey =
  | 'name' | 'hardpoint' | 'tonnage' | 'slots' | 'damage' | 'instability' | 'heat' | 'heatDamage' | 'accuracy' | 'crit'
  | 'minRange' | 'maxRange' | 'ammoPerTon' | 'damagePerTon' | 'rarity' | 'cost';

export const BT_WEAPON_SORT_KEYS: BtWeaponSortKey[] = [
  'name', 'hardpoint', 'tonnage', 'slots', 'damage', 'instability', 'heat', 'heatDamage', 'accuracy', 'crit',
  'minRange', 'maxRange', 'ammoPerTon', 'damagePerTon', 'rarity', 'cost'
];

export interface BtWeaponSort {
  key: BtWeaponSortKey;
  dir: 'asc' | 'desc';
}

// Las cifras empiezan de mayor a menor; el nombre, el anclaje y el alcance mínimo (cuanto menos, mejor),
// al revés.
const ASCENDING_FIRST: BtWeaponSortKey[] = ['name', 'hardpoint', 'minRange'];
const defaultDirection = (key: BtWeaponSortKey) => ASCENDING_FIRST.includes(key) ? 'asc' : 'desc';

export const toggleBtWeaponSort = (current: BtWeaponSort, key: BtWeaponSortKey): BtWeaponSort =>
  current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: defaultDirection(key) };

const sortValue = (row: BtWeaponRow, key: Exclude<BtWeaponSortKey, 'name'>): number | null => {
  switch (key) {
    case 'hardpoint': return HARDPOINTS.indexOf(row.item.hardpoint ?? 'energy');
    case 'tonnage': return row.item.tonnage;
    case 'slots': return row.item.slots;
    case 'rarity': return row.item.rarity;
    case 'cost': return row.item.cost;
    default: return row[key];
  }
};

// Por nombre, las versiones de un arma van seguidas: AC/10, AC/10 + de cada fabricante, AC/10 + +…
const byName = (a: BtWeaponRow, b: BtWeaponRow) =>
  a.item.baseName.localeCompare(b.item.baseName) || a.item.plus - b.item.plus || a.item.manufacturer.localeCompare(b.item.manufacturer);

// Sin el dato, al final en los dos sentidos; a igualdad, por nombre.
export const sortBtWeaponRows = (rows: BtWeaponRow[], { key, dir }: BtWeaponSort): BtWeaponRow[] => {
  const sign = dir === 'asc' ? 1 : -1;
  if (key === 'name') return [...rows].sort((a, b) => byName(a, b) * sign);
  return [...rows].sort((a, b) => {
    const [first, second] = [sortValue(a, key), sortValue(b, key)];
    if (first === null || second === null) return first === second ? byName(a, b) : first === null ? 1 : -1;
    return (first - second) * sign || byName(a, b);
  });
};

export type BtEquipmentCategory = 'heatSinks' | 'jumpJets' | 'upgrades' | 'ammo';

export const BT_EQUIPMENT_CATEGORIES: { id: BtEquipmentCategory; label: string; description: string }[] = [
  { id: 'heatSinks', label: 'Heat sinks', description: 'Heat sinks, heat banks and exchangers. Every \'Mech already has the heat sinks of its engine.' },
  { id: 'jumpJets', label: 'Jump jets', description: "Each size fits 'Mechs of a weight range; the chassis sets how many it can mount." },
  { id: 'upgrades', label: 'Upgrades', description: 'Actuators, cockpit mods, gyros, targeting systems and the rest, by group. Most fit only in some locations.' },
  { id: 'ammo', label: 'Ammo', description: 'One box per ton (the MG also has a half ton box). An attack spends one round per shot.' }
];

const CATEGORY_BY_KIND: Partial<Record<BtItem['kind'], BtEquipmentCategory>> = {
  heatSink: 'heatSinks', jumpJet: 'jumpJets', upgrade: 'upgrades', ammo: 'ammo'
};

export const getBtEquipmentCategory = (item: BtItem): BtEquipmentCategory | null => CATEGORY_BY_KIND[item.kind] ?? null;

export interface BtEquipmentFilter extends CommonFilter {
  category: BtEquipmentCategory | 'all';
}

const byItemName = (a: BtItem, b: BtItem) =>
  a.baseName.localeCompare(b.baseName) || a.plus - b.plus || a.manufacturer.localeCompare(b.manufacturer) || a.name.localeCompare(b.name);

export const groupBtEquipment = (items: BtItem[], filter: BtEquipmentFilter) => {
  const filtered = items.filter(item => {
    const category = getBtEquipmentCategory(item);
    return category !== null && (filter.category === 'all' || category === filter.category) && matchesCommon(item, filter);
  }).sort(byItemName);
  return BT_EQUIPMENT_CATEGORIES
    .map(category => ({ ...category, items: filtered.filter(item => getBtEquipmentCategory(item) === category.id) }))
    .filter(group => group.items.length > 0);
};

export const UPGRADE_GROUP_LABELS: Record<BtUpgradeGroup, string> = {
  actuator: 'Actuators',
  cockpit: 'Cockpit',
  gyro: 'Gyros',
  targeting: 'Targeting',
  electronic: 'Electronics',
  artillery: 'Artillery',
  general: 'General'
};

const UPGRADE_GROUPS = Object.keys(UPGRADE_GROUP_LABELS) as BtUpgradeGroup[];

export const groupBtUpgrades = (upgrades: BtItem[]) =>
  UPGRADE_GROUPS
    .map(group => ({ group, label: UPGRADE_GROUP_LABELS[group], items: upgrades.filter(item => (item.group ?? 'general') === group) }))
    .filter(group => group.items.length > 0);

// Dónde se monta, con los nombres de las parejas (brazos, piernas, torsos laterales) cuando van juntas.
const LOCATION_SETS: [Zone[], string][] = [
  [ZONE_KEYS, 'Anywhere'],
  [['centerTorso', 'leftTorso', 'rightTorso', 'leftLeg', 'rightLeg'], 'Torsos and legs'],
  [['leftArm', 'rightArm'], 'Arms'],
  [['leftLeg', 'rightLeg'], 'Legs'],
  [['leftTorso', 'rightTorso'], 'Side torsos']
];

export const getLocationsLabel = (locations: Zone[]): string => {
  const set = new Set(locations);
  const named = LOCATION_SETS.find(([zones]) => zones.length === set.size && zones.every(zone => set.has(zone)));
  return named ? named[1] : locations.map(zone => ZONE_LABELS[zone]).join(', ');
};

export interface BtEquipmentEffect {
  label: string;
  value: string;
}

const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;

// Las cifras propias de cada pieza; sus bonificaciones (el texto del juego) se enseñan aparte.
export const getBtEquipmentEffects = (item: BtItem): BtEquipmentEffect[] => {
  const effects: BtEquipmentEffect[] = [];
  const heatSink = item.heatSink;
  if (heatSink) {
    if (heatSink.dissipation) effects.push({ label: 'Heat sinking', value: `-${heatSink.dissipation} / turn` });
    if (heatSink.maxHeat) effects.push({ label: 'Max heat', value: signed(heatSink.maxHeat) });
    if (heatSink.overheat) effects.push({ label: 'Overheat threshold', value: signed(heatSink.overheat) });
    if (heatSink.weaponHeatMultiplier !== 1) effects.push({ label: 'Weapon heat', value: `${signed(Math.round((heatSink.weaponHeatMultiplier - 1) * 100))}%` });
  }
  if (item.jumpJet) effects.push({ label: "For 'Mechs of", value: `${item.jumpJet.minTonnage} to ${item.jumpJet.maxTonnage} t` });
  effects.push({ label: 'Mounts in', value: getLocationsLabel(item.locations) });
  if (item.builtIn) effects.push({ label: 'Built-in', value: "Fixed on some 'Mechs" });
  return effects;
};

export interface BtAmmoRow {
  item: BtItem;
  // Las armas que la usan (todas sus versiones) y sus nombres sin repetir.
  weapons: BtItem[];
  users: string[];
}

export const getBtAmmoRows = (items: BtItem[], ammo = items.filter(item => item.kind === 'ammo')): BtAmmoRow[] => {
  const weapons = items.filter(item => item.weapon?.ammoCategory);
  return ammo.map(item => {
    const users = weapons.filter(weapon => weapon.weapon!.ammoCategory === item.ammo?.category);
    return { item, weapons: users, users: [...new Set(users.map(weapon => weapon.baseName))].sort((a, b) => a.localeCompare(b)) };
  });
};

export type BtEquipmentTab = 'weapons' | 'equipment';

export interface BtEquipmentView extends BtWeaponFilter {
  tab: BtEquipmentTab;
  sort: BtWeaponSort;
  category: BtEquipmentCategory | 'all';
}

export const DEFAULT_BT_EQUIPMENT_VIEW: BtEquipmentView = {
  ...DEFAULT_BT_WEAPON_FILTER,
  tab: 'weapons',
  sort: { key: 'name', dir: 'asc' },
  category: 'all'
};

const pick = <T extends string>(value: string | null, options: readonly T[]): T | undefined =>
  options.find(option => option === value);

// La vista va en la URL (?type=energy&plus=2&sort=damage) para poder compartirla; lo que no se reconoce
// se ignora.
export const parseBtEquipmentQuery = (search: string): BtEquipmentView => {
  const params = new URLSearchParams(search);
  const key = pick(params.get('sort'), BT_WEAPON_SORT_KEYS) ?? 'name';
  const plus = PLUS_OPTIONS.find(option => String(option.plus) === params.get('plus'))?.plus;
  return {
    tab: pick(params.get('tab'), ['weapons', 'equipment'] as const) ?? 'weapons',
    query: params.get('q') ?? '',
    hardpoint: pick(params.get('type'), HARDPOINTS) ?? 'all',
    plus: plus ?? 'all',
    source: pick(params.get('source'), SOURCES) ?? 'all',
    rarity: pick(params.get('rarity'), RARITY_GROUPS.map(group => group.group)) ?? 'all',
    sort: { key, dir: pick(params.get('dir'), ['asc', 'desc'] as const) ?? defaultDirection(key) },
    category: pick(params.get('cat'), BT_EQUIPMENT_CATEGORIES.map(category => category.id)) ?? 'all'
  };
};

export const toBtEquipmentQuery = (view: BtEquipmentView): string => {
  const params = new URLSearchParams();
  if (view.tab !== 'weapons') params.set('tab', view.tab);
  if (view.query.trim()) params.set('q', view.query.trim());
  if (view.hardpoint !== 'all') params.set('type', view.hardpoint);
  if (view.plus !== 'all') params.set('plus', String(view.plus));
  if (view.source !== 'all') params.set('source', view.source);
  if (view.rarity !== 'all') params.set('rarity', view.rarity);
  if (view.sort.key !== 'name') params.set('sort', view.sort.key);
  if (view.sort.dir !== defaultDirection(view.sort.key)) params.set('dir', view.sort.dir);
  if (view.category !== 'all') params.set('cat', view.category);
  const text = params.toString();
  return text ? `?${text}` : '';
};
