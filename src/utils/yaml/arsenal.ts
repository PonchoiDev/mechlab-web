import type { YamlHardpointType, YamlItem, YamlWeaponGroup } from '../../types/yaml-mechlab';
import { ZONES } from '../zones';
import { getBaseWeaponPerformance, getDefaultTier } from './combat';
import { getYamlItem, yamlItemIds } from './data';

// La página de armas y equipo de YAML (docs/specs/pagina-equipo-yaml.md): el catálogo del MechLab de YAML, con
// la composición de la página de equipo de MW5 (src/utils/arsenal.ts) y las cifras de cada arma sola.

export const YAML_ARSENAL_WEAPON_TYPES: { id: YamlHardpointType; label: string }[] = [
  { id: 'energy', label: 'Energy' },
  { id: 'ballistic', label: 'Ballistic' },
  { id: 'missile', label: 'Missile' },
  { id: 'artillery', label: 'Artillery' },
  { id: 'melee', label: 'Melee' },
  { id: 'ams', label: 'AMS' }
];

// El nivel 5 es el que el juego llama Lost Tech.
export const YAML_TIER_OPTIONS: { id: string; label: string }[] = [
  { id: '0', label: 'Tier 0' },
  { id: '1', label: 'Tier 1' },
  { id: '2', label: 'Tier 2' },
  { id: '3', label: 'Tier 3' },
  { id: '4', label: 'Tier 4' },
  { id: '5', label: 'Lost Tech' }
];

export const yamlTierName = (tier: number) => YAML_TIER_OPTIONS.find(option => option.id === String(tier))?.label ?? `Tier ${tier}`;

// De dónde sale cada objeto: el juego base o el mod que lo añade o lo cambia (el campo mod del catálogo).
export const YAML_SOURCES: { id: string; label: string }[] = [
  { id: 'base', label: 'Base game' },
  { id: 'yet-another-mechlab', label: 'Yet Another Mechlab' },
  { id: 'yet-another-weapon', label: 'Yet Another Weapon' },
  { id: 'yet-another-weapon-clan', label: 'Yet Another Weapon Clan' },
  { id: 'yet-another-equipment-collection', label: 'Yet Another Equipment Collection' }
];

export const getYamlSource = (item: YamlItem) => item.mod ?? 'base';
export const getYamlSourceLabel = (source: string) => YAML_SOURCES.find(option => option.id === source)?.label ?? source;

export type YamlTechFilter = 'all' | 'innerSphere' | 'clan';

const TECH_NAMES: Record<string, string> = {
  'TechBase.InnerSphere': 'Inner Sphere', 'TechBase.Clan': 'Clan', 'TechBase.LosTech': 'Lost Tech', 'TechBase.Retro': 'Retro', 'TechBase.Arena': 'Arena'
};

// El equipo no guarda su tecnología: las piezas Clan llevan (C) o Clan en el nombre o en la etiqueta del juego.
const isClanItem = (item: YamlItem) => item.combat
  ? item.combat.techBase === 'TechBase.Clan'
  : /\(C\)|\bClan\b/.test(item.name) || (item.category ?? '').split('.').includes('Clan');

export const getYamlTechName = (item: YamlItem) =>
  item.combat ? TECH_NAMES[item.combat.techBase] ?? 'Inner Sphere' : isClanItem(item) ? 'Clan' : 'Inner Sphere';

const matchesTech = (item: YamlItem, tech: YamlTechFilter) => tech === 'all' || (tech === 'clan') === isClanItem(item);

// Como el buscador de MW5: sin mayúsculas, espacios, barras ni guiones («lrm10», «ac/10»).
const compact = (text: string) => text.toLowerCase().replace(/[\s/-]+/g, '');
const matchesName = (item: YamlItem, query: string) => !compact(query) || compact(item.name).includes(compact(query));

const catalog = () => yamlItemIds().map(id => ({ id, item: getYamlItem(id)! })).filter(({ item }) => !item.fixed);

// Armas: sin los ataques de los actuadores (la mano y el antebrazo), que vienen con el 'Mech.
const weapons = () => catalog().filter(({ item }) => item.kind === 'weapon' && item.combat && !item.actuator);

const ammoBoxes = () => catalog().filter(({ item }) => item.kind === 'ammo');

// Las cargas de una tonelada de un tipo de munición: la caja de 1 t (la del juego base si hay varias) o, si no
// hay, la mejor relación de cargas por tonelada.
const getAmmoPerTon = (ammoType: string | undefined): number | null => {
  const boxes = ammoBoxes().map(({ item }) => item).filter(item => item.ammoType === ammoType && item.tons > 0 && item.capacity);
  if (boxes.length === 0) return null;
  const fullTon = boxes.filter(item => item.tons === 1).sort((a, b) => Number(Boolean(a.mod)) - Number(Boolean(b.mod)))[0];
  return fullTon ? fullTon.capacity! : Math.max(...boxes.map(item => item.capacity! / item.tons));
};

export interface YamlWeaponRow {
  id: string;
  item: YamlItem;
  name: string;
  source: string;
  clan: boolean;
  techName: string;
  // El nivel que se enseña: el pedido o, si el arma no lo tiene, el suyo por defecto (tierMissing).
  tier: number;
  tierMissing: boolean;
  slots: number;
  tons: number;
  damage: number | null;
  heat: number | null;
  cooldown: number | null;
  rpm: number | null;
  dps: number | null;
  damagePerTon: number | null;
  range: number | null;
  maxRange: number | null;
  speed: number | null;
  ammoPerTon: number | null;
  volleysPerTon: number | null;
}

export const getYamlWeaponRows = (tier: string): YamlWeaponRow[] => weapons().flatMap(({ id, item }) => {
  const tierMissing = !Object.hasOwn(item.combat!.tiers, tier);
  const shownTier = tierMissing ? getDefaultTier(id) : Number(tier);
  const performance = getBaseWeaponPerformance(id, shownTier);
  if (!performance) return [];
  const isAms = performance.family === 'ams';
  const ammoPerTon = item.ammoTypes?.length ? getAmmoPerTon(item.ammoTypes[0]) : null;
  return [{
    id,
    item,
    name: item.name,
    source: getYamlSource(item),
    clan: isClanItem(item),
    techName: getYamlTechName(item),
    tier: shownTier,
    tierMissing,
    slots: item.slots,
    tons: item.tons,
    damage: isAms ? null : performance.damage,
    heat: isAms ? null : performance.heat,
    cooldown: performance.cooldown || null,
    rpm: performance.cycle > 0 ? 60 / performance.cycle : null,
    dps: isAms ? null : performance.dps,
    damagePerTon: performance.damagePerTon,
    range: performance.family === 'melee' ? null : performance.optimalRange,
    maxRange: performance.family === 'melee' ? null : performance.maxRange,
    speed: performance.speed,
    ammoPerTon,
    volleysPerTon: ammoPerTon === null ? null : Math.floor(ammoPerTon / (item.combat!.ammoPerVolley ?? 1))
  }];
});

export interface YamlWeaponFilter {
  query: string;
  type: YamlHardpointType | 'all';
  tech: YamlTechFilter;
  source: string;
}

export const DEFAULT_YAML_WEAPON_FILTER: YamlWeaponFilter = { query: '', type: 'all', tech: 'all', source: 'all' };

export const filterYamlWeaponRows = (rows: YamlWeaponRow[], { query, type, tech, source }: YamlWeaponFilter): YamlWeaponRow[] =>
  rows.filter(row =>
    (type === 'all' || row.item.hardpoint === type) &&
    matchesTech(row.item, tech) &&
    (source === 'all' || row.source === source) &&
    matchesName(row.item, query));

export type YamlWeaponSortKey =
  | 'name' | 'hardpoint' | 'slots' | 'tons' | 'damage' | 'heat' | 'cooldown' | 'rpm' | 'dps' | 'damagePerTon'
  | 'range' | 'maxRange' | 'speed' | 'ammoPerTon' | 'source';

export const YAML_WEAPON_SORT_KEYS: YamlWeaponSortKey[] = [
  'name', 'hardpoint', 'slots', 'tons', 'damage', 'heat', 'cooldown', 'rpm', 'dps', 'damagePerTon',
  'range', 'maxRange', 'speed', 'ammoPerTon', 'source'
];

export interface YamlWeaponSort {
  key: YamlWeaponSortKey;
  dir: 'asc' | 'desc';
}

// Como en la página de MW5: los textos de la A a la Z y las cifras de mayor a menor.
const TEXT_KEYS: YamlWeaponSortKey[] = ['name', 'hardpoint', 'source'];
const defaultDirection = (key: YamlWeaponSortKey): YamlWeaponSort['dir'] => TEXT_KEYS.includes(key) ? 'asc' : 'desc';

export const toggleYamlWeaponSort = (current: YamlWeaponSort, key: YamlWeaponSortKey): YamlWeaponSort =>
  current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: defaultDirection(key) };

const TYPE_ORDER = Object.fromEntries(YAML_ARSENAL_WEAPON_TYPES.map((type, index) => [type.id, index]));
const SOURCE_ORDER = Object.fromEntries(YAML_SOURCES.map((source, index) => [source.id, index]));

const sortValue = (row: YamlWeaponRow, key: YamlWeaponSortKey): number | null => {
  switch (key) {
    case 'name': return null;
    case 'hardpoint': return TYPE_ORDER[row.item.hardpoint ?? 'energy'] ?? 99;
    case 'source': return SOURCE_ORDER[row.source] ?? 99;
    default: return row[key];
  }
};

// Sin el dato, al final en los dos sentidos; a igualdad, por nombre.
export const sortYamlWeaponRows = (rows: YamlWeaponRow[], { key, dir }: YamlWeaponSort): YamlWeaponRow[] => {
  const byName = (a: YamlWeaponRow, b: YamlWeaponRow) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  const sign = dir === 'asc' ? 1 : -1;
  if (key === 'name') return [...rows].sort((a, b) => byName(a, b) * sign);
  return [...rows].sort((a, b) => {
    const [first, second] = [sortValue(a, key), sortValue(b, key)];
    if (first === null || second === null) return first === second ? byName(a, b) : first === null ? 1 : -1;
    return (first - second) * sign || byName(a, b);
  });
};

export type YamlEquipmentCategory =
  | 'heatSinks' | 'engines' | 'structureArmor' | 'internals' | 'jumpJets' | 'motive' | 'electronics'
  | 'targetingComputers' | 'actuators' | 'other' | 'ammo';

// Por la etiqueta del juego de cada pieza (EquipmentType); vale la más concreta que encaje, así que
// Equipment.Upgrades.Armor va a estructura y armadura aunque Equipment.Upgrades sea de Motive.
export const YAML_EQUIPMENT_CATEGORIES: { id: YamlEquipmentCategory; label: string; description: string; tags: string[] }[] = [
  { id: 'heatSinks', label: 'Heat sinks', description: 'Heat sinks, heat banks and the heat sink kits of the engine.', tags: ['Equipment.HeatSinks', 'Equipment.Cooling'] },
  { id: 'engines', label: 'Engines', description: 'Engine types and cores: the core sets the rating, the type its weight and the slots it takes.', tags: ['Equipment.Engine'] },
  { id: 'structureArmor', label: 'Structure and armor', description: 'Internal structure, armor types, modular armor and HarJel.', tags: ['Equipment.Internal', 'Equipment.Upgrades.Armor', 'Equipment.Harjel'] },
  { id: 'internals', label: 'Internals', description: 'Cockpits, gyros, life support, sensors, fire control and defensive systems, each in its own slot.', tags: ['Equipment.Cockpit', 'Equipment.Gyro', 'Equipment.LifeSupport', 'Equipment.Sensors', 'Equipment.Targeting', 'Equipment.Upgrades.Defensive'] },
  { id: 'jumpJets', label: 'Jump jets', description: 'Jump jets by class.', tags: ['Equipment.JumpJets'] },
  { id: 'motive', label: 'Motive', description: 'MASC, superchargers and myomers.', tags: ['Equipment.MASC', 'Equipment.SuperCharger', 'Equipment.ArenaSuperCharger', 'Equipment.TripleStrengthMyomer', 'Equipment.Upgrades'] },
  { id: 'electronics', label: 'Electronics', description: 'ECM and active probes.', tags: ['Equipment.ECM', 'Equipment.BAP'] },
  { id: 'targetingComputers', label: 'Targeting computers', description: 'Targeting computers: only one per \'Mech.', tags: ['Equipment.TargetingComputer'] },
  { id: 'actuators', label: 'Actuators', description: 'Shoulder, arm, hand, hip and leg actuators and their upgrades.', tags: ['Equipment.Misc.Actuator'] },
  { id: 'other', label: 'Other', description: 'CASE, battle computers, capacitors, exchangers and the rest.', tags: [] },
  { id: 'ammo', label: 'Ammo', description: 'Every ammo box, with its rounds and the weapons that use it.', tags: [] }
];

const hasTag = (category: string, tag: string) => category === tag || category.startsWith(`${tag}.`);

export const getYamlEquipmentCategory = (item: YamlItem): YamlEquipmentCategory | null => {
  if (item.kind === 'ammo') return 'ammo';
  const category = item.category ?? '';
  // Los rellenos los coloca el MechLab solo.
  if (item.kind !== 'equipment' || hasTag(category, 'Equipment.Filler')) return null;
  const matches = YAML_EQUIPMENT_CATEGORIES.flatMap(({ id, tags }) => tags.filter(tag => hasTag(category, tag)).map(tag => ({ id, tag })));
  if (matches.length === 0) return 'other';
  return matches.reduce((best, match) => match.tag.length > best.tag.length ? match : best).id;
};

export interface YamlEquipmentFilter {
  query: string;
  tech: YamlTechFilter;
  source: string;
  category: YamlEquipmentCategory | 'all';
}

export interface YamlEquipmentGroup {
  id: YamlEquipmentCategory;
  label: string;
  description: string;
  items: { id: string; item: YamlItem }[];
}

export const groupYamlEquipment = ({ query, tech, source, category }: YamlEquipmentFilter): YamlEquipmentGroup[] => {
  const entries = catalog()
    .filter(({ item }) => matchesName(item, query) && matchesTech(item, tech) && (source === 'all' || getYamlSource(item) === source))
    .map(entry => ({ ...entry, category: getYamlEquipmentCategory(entry.item) }))
    .filter(entry => entry.category !== null)
    .sort((a, b) => a.item.name.localeCompare(b.item.name) || a.id.localeCompare(b.id));
  return YAML_EQUIPMENT_CATEGORIES
    .filter(group => category === 'all' || group.id === category)
    .map(({ id, label, description }) => ({ id, label, description, items: entries.filter(entry => entry.category === id).map(({ id: itemId, item }) => ({ id: itemId, item })) }))
    .filter(group => group.items.length > 0);
};

export interface YamlEquipmentEffect {
  label: string;
  value: string;
}

const number = (value: number) => String(Number(value.toFixed(2)));
const signed = (value: number) => `${value >= 0 ? '+' : ''}${number(value)}`;
// Los multiplicadores como cambio en porcentaje: 0,9 es −10 %; los relativos (−0,5), tal cual.
const percent = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
const multi = (value: number) => percent(value - 1);

const WEAPON_GROUP_FIELDS: { key: keyof YamlWeaponGroup; label: string }[] = [
  { key: 'damageMulti', label: 'damage' },
  { key: 'heatMulti', label: 'heat' },
  { key: 'cooldownMulti', label: 'cooldown' },
  { key: 'durationMulti', label: 'duration' },
  { key: 'optimalRangeMulti', label: 'range' },
  { key: 'maxRangeMulti', label: 'max range' },
  { key: 'speedMulti', label: 'projectile speed' },
  { key: 'missilesDestroyedMulti', label: 'missiles destroyed' }
];

// Las etiquetas de las armas, con su último nombre: Weapon.Energy.Laser es «Laser».
const tagName = (tag: string) => tag.split('.').filter(part => part !== 'Weapon' && part !== 'TechBase').slice(-1)[0] ?? tag;

const describeGroup = (group: YamlWeaponGroup) => {
  const changes = WEAPON_GROUP_FIELDS.flatMap(({ key, label }) => {
    const value = group[key];
    return typeof value === 'number' && value !== 1 ? [`${multi(value)} ${label}`] : [];
  });
  return changes.length > 0 ? `${[...new Set(group.tags.map(tagName))].join(', ')}: ${changes.join(', ')}` : null;
};

const fieldEffects: { key: keyof YamlItem; label: string; format: (value: number) => string }[] = [
  { key: 'cooling', label: 'Cooling', format: signed },
  { key: 'heatCapacity', label: 'Heat capacity', format: signed },
  { key: 'coolingMulti', label: 'Cooling', format: multi },
  { key: 'heatCapacityBonus', label: 'Heat capacity', format: signed },
  { key: 'bundledHeatsinks', label: 'Heat sinks included', format: number },
  { key: 'internalHeatsinkBonus', label: 'Engine heat sinks', format: signed },
  { key: 'engineHeatsinkMulti', label: 'Engine heat sink slots', format: multi },
  { key: 'engineHeatsinkEfficiency', label: 'Engine heat sink cooling', format: multi },
  { key: 'engineHeatsinkCapacity', label: 'Engine heat sink capacity', format: multi },
  { key: 'heatEfficiency', label: 'Heat efficiency', format: multi },
  { key: 'rating', label: 'Engine rating', format: number },
  { key: 'engineRelativeWeight', label: 'Engine weight', format: percent },
  { key: 'relativeWeight', label: 'Weight', format: percent },
  { key: 'structureWeightMulti', label: 'Structure weight', format: multi },
  { key: 'structureMulti', label: 'Structure', format: multi },
  { key: 'armorWeightMulti', label: 'Armor weight', format: multi },
  { key: 'armorPerTon', label: 'Armor per ton', format: number },
  { key: 'armorMulti', label: 'Armor', format: multi },
  { key: 'armorComponentFront', label: 'Front armor', format: signed },
  { key: 'armorComponentRear', label: 'Rear armor', format: signed },
  { key: 'structureComponent', label: 'Structure', format: signed },
  { key: 'armorComponentFrontMulti', label: 'Front armor', format: multi },
  { key: 'armorComponentRearMulti', label: 'Rear armor', format: multi },
  { key: 'structureComponentMulti', label: 'Structure', format: multi },
  { key: 'topSpeedMulti', label: 'Top speed', format: multi },
  { key: 'turnSpeedMulti', label: 'Turn rate', format: multi },
  { key: 'torsoTwistRateMulti', label: 'Torso twist rate', format: multi },
  { key: 'torsoTwistAngleMulti', label: 'Torso twist angle', format: multi },
  { key: 'armTwistAngleMulti', label: 'Arm twist angle', format: multi },
  { key: 'sensorRangeBonus', label: 'Sensor range', format: value => `${signed(value)} m` },
  { key: 'sensorRangeMulti', label: 'Sensor range', format: multi },
  { key: 'sensorRangePercent', label: 'Sensor range', format: percent },
  { key: 'jumpJetFuelBurnTimeMulti', label: 'Jump jet burn time', format: multi },
  { key: 'jumpJetZAccelMulti', label: 'Jump jet thrust', format: multi }
];

// Lo que el catálogo guarda de cada pieza, como pares de texto para la ficha.
export const getYamlEquipmentEffects = (item: YamlItem): YamlEquipmentEffect[] => {
  const effects: YamlEquipmentEffect[] = fieldEffects.flatMap(({ key, label, format }) => {
    const value = item[key];
    return typeof value === 'number' && value !== 0 ? [{ label, value: format(value) }] : [];
  });
  if (item.fillerSlots) {
    const fillers = item.fillerSlots;
    const parts = [
      ...ZONES.filter(({ zone }) => fillers[zone]).map(({ zone, label }) => `${label} ${fillers[zone]}`),
      ...(fillers.dynamic ? [`Anywhere ${fillers.dynamic}`] : [])
    ];
    if (parts.length > 0) effects.push({ label: 'Filler slots', value: parts.join(', ') });
  }
  if (item.jumpJet) {
    // El juego guarda la velocidad en cm/s.
    effects.push({ label: 'Thrust', value: `${number(item.jumpJet.initialVelocityZ / 100)} m/s` }, { label: 'Burn time', value: `${number(item.jumpJet.burnTime)} s` });
  }
  const groups = (item.weapons?.groups ?? []).map(describeGroup).filter((text): text is string => text !== null);
  if (groups.length > 0) {
    const scope = item.weapons!.scope.toLowerCase() === 'component' ? 'Weapons in its location' : 'Weapons';
    groups.forEach(text => effects.push({ label: scope, value: text }));
  }
  return effects;
};

export interface YamlAmmoRow {
  id: string;
  item: YamlItem;
  perTon: number | null;
  // Las armas que la usan, por nombre.
  users: string[];
}

export const getYamlAmmoRows = (boxes = ammoBoxes()): YamlAmmoRow[] => {
  const weaponList = weapons();
  return boxes
    .map(({ id, item }) => ({
      id,
      item,
      perTon: item.capacity && item.tons > 0 ? item.capacity / item.tons : null,
      users: [...new Set(weaponList.filter(weapon => item.ammoType && weapon.item.ammoTypes?.includes(item.ammoType)).map(weapon => weapon.item.name))].sort()
    }))
    .sort((a, b) => a.item.name.localeCompare(b.item.name) || a.id.localeCompare(b.id));
};

export type YamlArsenalTab = 'weapons' | 'equipment';

export interface YamlArsenalView extends YamlWeaponFilter {
  tab: YamlArsenalTab;
  tier: string;
  sort: YamlWeaponSort;
  category: YamlEquipmentCategory | 'all';
}

export const DEFAULT_YAML_ARSENAL_VIEW: YamlArsenalView = {
  ...DEFAULT_YAML_WEAPON_FILTER,
  tab: 'weapons',
  tier: '1',
  sort: { key: 'name', dir: 'asc' },
  category: 'all'
};

const pick = <T extends string>(value: string | null, options: readonly T[]): T | undefined => options.find(option => option === value);

// Como en la página de MW5, la vista va en la URL y lo que no se reconoce se ignora.
export const parseYamlArsenalQuery = (search: string): YamlArsenalView => {
  const params = new URLSearchParams(search);
  const defaults = DEFAULT_YAML_ARSENAL_VIEW;
  const key = pick(params.get('sort'), YAML_WEAPON_SORT_KEYS) ?? defaults.sort.key;
  return {
    tab: pick(params.get('tab'), ['weapons', 'equipment'] as const) ?? defaults.tab,
    query: params.get('q') ?? '',
    type: pick(params.get('type'), YAML_ARSENAL_WEAPON_TYPES.map(type => type.id)) ?? 'all',
    tech: pick(params.get('tech'), ['innerSphere', 'clan'] as const) ?? 'all',
    source: pick(params.get('source'), YAML_SOURCES.map(source => source.id)) ?? 'all',
    tier: pick(params.get('tier'), YAML_TIER_OPTIONS.map(tier => tier.id)) ?? defaults.tier,
    sort: { key, dir: pick(params.get('dir'), ['asc', 'desc'] as const) ?? defaultDirection(key) },
    category: pick(params.get('cat'), YAML_EQUIPMENT_CATEGORIES.map(category => category.id)) ?? 'all'
  };
};

export const toYamlArsenalQuery = (view: YamlArsenalView): string => {
  const params = new URLSearchParams();
  if (view.tab !== 'weapons') params.set('tab', view.tab);
  if (view.query.trim()) params.set('q', view.query.trim());
  if (view.type !== 'all') params.set('type', view.type);
  if (view.tech !== 'all') params.set('tech', view.tech);
  if (view.source !== 'all') params.set('source', view.source);
  if (view.tier !== DEFAULT_YAML_ARSENAL_VIEW.tier) params.set('tier', view.tier);
  if (view.sort.key !== DEFAULT_YAML_ARSENAL_VIEW.sort.key) params.set('sort', view.sort.key);
  if (view.sort.dir !== defaultDirection(view.sort.key)) params.set('dir', view.sort.dir);
  if (view.category !== 'all') params.set('cat', view.category);
  const text = params.toString();
  return text ? `?${text}` : '';
};
