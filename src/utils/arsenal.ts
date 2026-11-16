import type { Item, ItemSize, WeaponType } from '../types/item';
import { getWeaponStats } from './calculators';
import { getTierName, isClanTech, isJumpJet, matchesItemName } from './items';
import { BASE_GAME } from './mechs';

// Página de armas y equipo de MW5 (docs/specs/pagina-equipo.md): filas de la tabla de armas en un
// tier, filtros, orden, categorías y efectos del equipo, munición y vista en la URL.

export const ARSENAL_WEAPON_TYPES: { id: WeaponType; label: string }[] = [
  { id: 'energy', label: 'Energy' },
  { id: 'ballistic', label: 'Ballistic' },
  { id: 'missile', label: 'Missile' },
  { id: 'artillery', label: 'Artillery' },
  { id: 'melee', label: 'Melee' },
  { id: 'ams', label: 'AMS' }
];

export const ARSENAL_SIZES: { id: ItemSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' }
];

// Los tiers de las armas de la Esfera Interior; las Clan solo tienen uno.
export const TIER_OPTIONS: { id: string; label: string }[] = [
  { id: '0', label: 'Tier 0' },
  { id: '1', label: 'Tier 1' },
  { id: '2', label: 'Tier 2' },
  { id: '3', label: 'Tier 3' },
  { id: '4', label: 'Tier 4' },
  { id: '5', label: 'Lost Tech' }
];

export type TechFilter = 'all' | 'innerSphere' | 'clan';

export const TECH_OPTIONS: { id: Exclude<TechFilter, 'all'>; label: string }[] = [
  { id: 'innerSphere', label: 'Inner Sphere' },
  { id: 'clan', label: 'Clan' }
];

// DLC del filtro: BASE_GAME (0) es el juego base.
export type DlcFilter = number | 'all';

export const getItemDlc = (item: Item): number => item.dlc ?? BASE_GAME;

// LosTech, Retro y Arena son tecnología de la Esfera Interior: solo el Clan va aparte.
const matchesTech = (item: Item, tech: TechFilter) =>
  tech === 'all' || (tech === 'clan') === isClanTech(item);

const matchesDlc = (item: Item, dlc: DlcFilter) => dlc === 'all' || getItemDlc(item) === dlc;

export interface WeaponRow {
  item: Item;
  // El tier que se enseña: el pedido o, en las armas Clan, el único que tienen.
  tier: string;
  tierName: string;
  clan: boolean;
  manufacturer: string | null;
  damage: number;
  heat: number;
  cooldown: number | null;
  rpm: number;
  dps: number;
  damagePerTon: number | null;
  range: number | null;
  maxRange: number | null;
  speed: number | null;
  // Cargas de una tonelada de su munición y salvas que dan; null en las armas sin munición.
  ammoPerTon: number | null;
  volleysPerTon: number | null;
  dlc: number;
}

const getRowTier = (item: Item, tier: string): string => {
  const tiers = item.tiers ?? {};
  return tiers[tier] ? tier : Object.keys(tiers)[0] ?? '1';
};

// La munición de una tonelada (no la media) de cada tipo, para las cargas por tonelada.
const getFullTonAmmo = (items: Item[]): Map<string, Item> =>
  new Map(items.filter(item => item.type === 'ammo' && item.tonnage === 1 && item.ammoType).map(item => [item.ammoType!, item]));

export const getWeaponRows = (items: Item[], tier: string): WeaponRow[] => {
  const ammo = getFullTonAmmo(items);
  return items.filter(item => item.type === 'weapon' && item.tiers).map(item => {
    const rowTier = getRowTier(item, tier);
    const weapon = { ...item, tier: rowTier };
    const stats = getWeaponStats(weapon);
    const tierStats = item.tiers![rowTier];
    const ammoPerTon = item.ammoType ? ammo.get(item.ammoType)?.capacity ?? null : null;
    return {
      item,
      tier: rowTier,
      tierName: getTierName(weapon) ?? `Tier ${rowTier}`,
      clan: isClanTech(item),
      manufacturer: tierStats.manufacturer ?? null,
      damage: stats.damage,
      heat: stats.heat,
      cooldown: tierStats.cooldown ?? null,
      rpm: stats.rpm,
      dps: stats.dps,
      damagePerTon: stats.damagePerTon,
      range: stats.range,
      maxRange: stats.maxRange,
      speed: stats.speed,
      ammoPerTon,
      volleysPerTon: ammoPerTon === null ? null : Math.floor(ammoPerTon / (item.ammoPerVolley ?? 1)),
      dlc: getItemDlc(item)
    };
  });
};

export interface WeaponFilter {
  query: string;
  type: WeaponType | 'all';
  size: ItemSize | 'all';
  tech: TechFilter;
  dlc: DlcFilter;
}

export const DEFAULT_WEAPON_FILTER: WeaponFilter = { query: '', type: 'all', size: 'all', tech: 'all', dlc: 'all' };

// La búsqueda mira el nombre, el nombre corto del juego y el fabricante del tier que se ve.
export const filterWeaponRows = (rows: WeaponRow[], { query, type, size, tech, dlc }: WeaponFilter): WeaponRow[] => {
  const text = query.trim().toLowerCase();
  return rows.filter(row =>
    (type === 'all' || row.item.weaponType === type) &&
    (size === 'all' || row.item.size === size) &&
    matchesTech(row.item, tech) &&
    matchesDlc(row.item, dlc) &&
    (!text || matchesItemName(row.item, text) || (row.manufacturer ?? '').toLowerCase().includes(text)));
};

export type WeaponSortKey =
  | 'name' | 'hardpoint' | 'tonnage' | 'damage' | 'heat' | 'cooldown' | 'rpm' | 'dps' | 'damagePerTon'
  | 'range' | 'maxRange' | 'speed' | 'ammoPerTon' | 'dlc';

export const WEAPON_SORT_KEYS: WeaponSortKey[] = [
  'name', 'hardpoint', 'tonnage', 'damage', 'heat', 'cooldown', 'rpm', 'dps', 'damagePerTon',
  'range', 'maxRange', 'speed', 'ammoPerTon', 'dlc'
];

export type SortDirection = 'asc' | 'desc';

export interface WeaponSort {
  key: WeaponSortKey;
  dir: SortDirection;
}

// Los textos empiezan de la A a la Z; las cifras, de mayor a menor.
const TEXT_KEYS: WeaponSortKey[] = ['name', 'hardpoint'];
const defaultDirection = (key: WeaponSortKey): SortDirection => TEXT_KEYS.includes(key) ? 'asc' : 'desc';

export const toggleWeaponSort = (current: WeaponSort, key: WeaponSortKey): WeaponSort =>
  current.key === key
    ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: defaultDirection(key) };

const SIZE_ORDER: Record<ItemSize, number> = { small: 0, medium: 1, large: 2 };
const TYPE_ORDER = Object.fromEntries(ARSENAL_WEAPON_TYPES.map((type, index) => [type.id, index])) as Record<WeaponType, number>;

const sortValue = (row: WeaponRow, key: WeaponSortKey): number | null => {
  switch (key) {
    case 'tonnage': return row.item.tonnage;
    case 'hardpoint': return TYPE_ORDER[row.item.weaponType ?? 'energy'] * 10 + SIZE_ORDER[row.item.size];
    case 'name': return null;
    default: return row[key];
  }
};

// Sin el dato, al final en los dos sentidos; a igualdad, por nombre.
export const sortWeaponRows = (rows: WeaponRow[], { key, dir }: WeaponSort): WeaponRow[] => {
  const byName = (a: WeaponRow, b: WeaponRow) => a.item.name.localeCompare(b.item.name) || a.item.id.localeCompare(b.item.id);
  const sign = dir === 'asc' ? 1 : -1;
  if (key === 'name') return [...rows].sort((a, b) => byName(a, b) * sign);
  return [...rows].sort((a, b) => {
    const [first, second] = [sortValue(a, key), sortValue(b, key)];
    if (first === null || second === null) return first === second ? byName(a, b) : first === null ? 1 : -1;
    return (first - second) * sign || byName(a, b);
  });
};

export type EquipmentCategory = 'heatSinks' | 'jumpJets' | 'motive' | 'electronics' | 'targetingComputers' | 'ammo';

export const EQUIPMENT_CATEGORIES: { id: EquipmentCategory; label: string; description: string }[] = [
  { id: 'heatSinks', label: 'Heat sinks', description: 'Each one adds cooling and heat capacity. The engine has its own heat sink slots.' },
  { id: 'jumpJets', label: 'Jump jets', description: "Each class fits 'Mechs of a weight range, in their jump jet slots." },
  { id: 'motive', label: 'Motive upgrades', description: 'MASC and Superchargers boost speed for a while; overuse damages the legs or the center torso.' },
  { id: 'electronics', label: 'Electronics', description: 'ECM suites and active probes, each in its own hardpoint.' },
  { id: 'targetingComputers', label: 'Targeting computers', description: "Only one per 'Mech. They help lasers, ballistics and PPCs at long range." },
  { id: 'ammo', label: 'Ammo', description: 'Full and half tons of ammunition. Ammo explodes when its slot is destroyed.' }
];

export const getEquipmentCategory = (item: Item): EquipmentCategory | null => {
  if (item.type === 'ammo') return 'ammo';
  if (item.type !== 'equipment') return null;
  if (item.cooling !== undefined) return 'heatSinks';
  if (isJumpJet(item)) return 'jumpJets';
  if (item.masc || item.speedBoost !== undefined) return 'motive';
  if (item.ecm || item.probe) return 'electronics';
  if (item.targetingComputer) return 'targetingComputers';
  return null;
};

export interface EquipmentFilter {
  category: EquipmentCategory | 'all';
  query: string;
  tech: TechFilter;
  dlc: DlcFilter;
}

// En el orden del juego: por tonelaje y nombre, para que las marcas (MK I a MK V) salgan seguidas.
export const filterEquipment = (items: Item[], { category, query, tech, dlc }: EquipmentFilter): Item[] => {
  const text = query.trim().toLowerCase();
  return items
    .filter(item => {
      const itemCategory = getEquipmentCategory(item);
      return itemCategory !== null &&
        (category === 'all' || itemCategory === category) &&
        matchesTech(item, tech) &&
        matchesDlc(item, dlc) &&
        matchesItemName(item, text);
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
};

export const groupEquipment = (items: Item[], filter: EquipmentFilter) => {
  const filtered = filterEquipment(items, filter);
  return EQUIPMENT_CATEGORIES
    .map(category => ({ ...category, items: filtered.filter(item => getEquipmentCategory(item) === category.id) }))
    .filter(group => group.items.length > 0);
};

export interface EquipmentEffect {
  label: string;
  value: string;
}

const number = (value: number) => String(Number(value.toFixed(2)));
const percent = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
const multiplier = (value: number) => `×${number(value)}`;

const PART_NAMES: Record<string, string> = { LeftLeg: 'Legs', RightLeg: 'Legs', CenterTorso: 'Center torso' };

// Lo que hace cada pieza, como pares de texto para la ficha. Los multiplicadores del ECM y de las
// sondas se dejan como el juego los guarda (×0.8), porque no dice sobre qué valor se aplican.
export const getEquipmentEffects = (item: Item): EquipmentEffect[] => {
  const effects: EquipmentEffect[] = [];
  if (item.cooling !== undefined) effects.push({ label: 'Cooling', value: `+${number(item.cooling)}` });
  if (item.heatCapacity !== undefined) effects.push({ label: 'Heat capacity', value: `+${number(item.heatCapacity)}` });
  if (item.jumpJet) {
    const { thrust, burnTime, regenTime, mechTonnage } = item.jumpJet;
    effects.push(
      { label: 'Thrust', value: `${number(thrust)} m/s` },
      { label: 'Burn time', value: `${number(burnTime)} s` },
      { label: 'Recharge', value: `${number(regenTime)} s` }
    );
    if (mechTonnage) effects.push({ label: "For 'Mechs of", value: `${mechTonnage[0]} to ${mechTonnage[1]} t` });
  }
  if (item.speedBoost !== undefined) effects.push({ label: 'Top speed', value: percent(item.speedBoost) });
  if (item.masc) {
    effects.push({ label: 'Acceleration', value: multiplier(item.masc.accel) });
    if (item.masc.turn !== 0) effects.push({ label: 'Turn rate', value: percent(item.masc.turn) });
    const parts = [...new Set(item.masc.damagedParts.map(part => PART_NAMES[part] ?? part))];
    if (parts.length > 0) effects.push({ label: 'Overuse damages', value: parts.join(', ') });
  }
  if (item.ecm) {
    const ecm = item.ecm;
    effects.push(
      { label: 'Disrupt range', value: `${ecm.disruptRange} m` },
      { label: 'Counter range', value: `${ecm.counterRange} m` },
      { label: 'Ally shielding', value: multiplier(ecm.shielding) },
      { label: 'Enemy sensors', value: multiplier(ecm.suppression) },
      { label: 'Enemy LRM spread', value: multiplier(ecm.lrmSpread) },
      { label: 'Enemy Streak tracking', value: multiplier(ecm.streakTracking) },
      { label: 'Enemy AI accuracy', value: multiplier(ecm.aiAccuracy) }
    );
  }
  if (item.probe) {
    effects.push(
      { label: 'Range', value: `${item.probe.range} m` },
      { label: 'Sensor range', value: percent(item.probe.sensorRange - 1) },
      { label: 'ECM distortion', value: multiplier(item.probe.distortionReduction) }
    );
  }
  if (item.targetingComputer) {
    const computer = item.targetingComputer;
    effects.push(
      { label: 'Sensor range', value: percent(computer.sensorRange) },
      { label: 'Ballistic and PPC projectile speed', value: percent(computer.projectileSpeed) },
      { label: 'Laser range', value: percent(computer.laserRange) }
    );
  }
  return effects;
};

export interface AmmoRow {
  item: Item;
  // Las armas que la usan, por nombre.
  users: string[];
}

export const getAmmoRows = (items: Item[], ammo = items.filter(item => item.type === 'ammo')): AmmoRow[] => {
  const weapons = items.filter(item => item.type === 'weapon' && item.ammoType);
  return ammo.map(item => ({
    item,
    users: weapons.filter(weapon => weapon.ammoType === item.ammoType).map(weapon => weapon.name).sort((a, b) => a.localeCompare(b))
  }));
};

// Los DLC que traen armas o equipo, para el filtro.
export const getDlcOptions = (items: Item[]): number[] =>
  [...new Set(items.map(getItemDlc))].sort((a, b) => a - b);

export type ArsenalTab = 'weapons' | 'equipment';

export interface ArsenalView extends WeaponFilter {
  tab: ArsenalTab;
  tier: string;
  sort: WeaponSort;
  category: EquipmentCategory | 'all';
}

export const DEFAULT_ARSENAL_VIEW: ArsenalView = {
  ...DEFAULT_WEAPON_FILTER,
  tab: 'weapons',
  tier: '1',
  sort: { key: 'name', dir: 'asc' },
  category: 'all'
};

const pick = <T extends string>(value: string | null, options: readonly T[]): T | undefined =>
  options.find(option => option === value);

// La vista va en la URL (?tab=equipment&type=energy&tier=5&sort=dps&dir=asc) para poder compartirla;
// lo que no se reconoce se ignora. El juego base es dlc=base.
export const parseArsenalQuery = (search: string): ArsenalView => {
  const params = new URLSearchParams(search);
  const defaults = DEFAULT_ARSENAL_VIEW;
  const key = pick(params.get('sort'), WEAPON_SORT_KEYS) ?? defaults.sort.key;
  const dlcParam = params.get('dlc');
  const dlcNumber = dlcParam === 'base' ? BASE_GAME : Number(dlcParam);
  return {
    tab: pick(params.get('tab'), ['weapons', 'equipment'] as const) ?? defaults.tab,
    query: params.get('q') ?? '',
    type: pick(params.get('type'), ARSENAL_WEAPON_TYPES.map(type => type.id)) ?? 'all',
    size: pick(params.get('size'), ARSENAL_SIZES.map(size => size.id)) ?? 'all',
    tech: pick(params.get('tech'), TECH_OPTIONS.map(tech => tech.id)) ?? 'all',
    dlc: dlcParam !== null && Number.isInteger(dlcNumber) && dlcNumber >= 0 && dlcNumber <= 9 ? dlcNumber : 'all',
    tier: pick(params.get('tier'), TIER_OPTIONS.map(tier => tier.id)) ?? defaults.tier,
    sort: { key, dir: pick(params.get('dir'), ['asc', 'desc'] as const) ?? defaultDirection(key) },
    category: pick(params.get('cat'), EQUIPMENT_CATEGORIES.map(category => category.id)) ?? 'all'
  };
};

export const toArsenalQuery = (view: ArsenalView): string => {
  const params = new URLSearchParams();
  if (view.tab !== 'weapons') params.set('tab', view.tab);
  if (view.query.trim()) params.set('q', view.query.trim());
  if (view.type !== 'all') params.set('type', view.type);
  if (view.size !== 'all') params.set('size', view.size);
  if (view.tech !== 'all') params.set('tech', view.tech);
  if (view.dlc !== 'all') params.set('dlc', view.dlc === BASE_GAME ? 'base' : String(view.dlc));
  if (view.tier !== DEFAULT_ARSENAL_VIEW.tier) params.set('tier', view.tier);
  if (view.sort.key !== DEFAULT_ARSENAL_VIEW.sort.key) params.set('sort', view.sort.key);
  if (view.sort.dir !== defaultDirection(view.sort.key)) params.set('dir', view.sort.dir);
  if (view.category !== 'all') params.set('cat', view.category);
  const text = params.toString();
  return text ? `?${text}` : '';
};
