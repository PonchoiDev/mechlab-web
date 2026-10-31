import type { Item } from '../types/item';
import type { EquippedLoadout, Mech, Zone } from '../types/mech';
import { decodeBuild, type SharedBuild } from './buildCode';
import { formatArmorPoints, formatCoolingRate, formatTurnRate, getBuildSummary, type BuildSummary } from './calculators';
import { getTierName } from './items';
import { getHardpointCounts, HARDPOINT_FILTER_TYPES, type HardpointFilterType } from './mechs';
import type { SavedBuild } from './savedBuilds';
import { getUpgrades } from './upgrades';
import { ZONE_KEYS, ZONE_LABELS } from './zones';

export interface ComparedSide {
  mech: Mech;
  summary: BuildSummary;
}

export type Winner = 'a' | 'b' | null;

export interface ComparisonRow {
  key: string;
  label: string;
  unit?: string;
  a: string;
  b: string;
  // Valores sin formato, para dibujar las barras.
  valueA: number | null;
  valueB: number | null;
  winner: Winner;
  // En el calor gana el valor más bajo, y la tabla lo indica.
  lowerIsBetter: boolean;
  // Lo que saca el ganador al otro, con el mismo formato que los valores (+35, o -1.8 en el calor).
  difference: string | null;
}

export interface ComparisonGroup {
  title: string;
  rows: ComparisonRow[];
}

type Better = 'higher' | 'lower' | 'none';

interface RowDefinition {
  key: string;
  label: string;
  unit?: string;
  value: (side: ComparedSide) => number | null;
  format: (value: number) => string;
  better: Better;
}

// Número con hasta dos decimales, sin ceros de más, como la pestaña 'Mech (78.4, 66).
const formatNumber = (value: number, decimals = 2) => String(Number(value.toFixed(decimals)));

export const pickWinner = (a: number | null, b: number | null, better: Better): Winner => {
  if (a === null || b === null || a === b || better === 'none') return null;
  return (a > b) === (better === 'higher') ? 'a' : 'b';
};

const HARDPOINT_LABELS: Record<HardpointFilterType, string> = {
  energy: 'Energy',
  ballistic: 'Ballistic',
  missile: 'Missile',
  omni: 'Omni',
  artillery: 'Artillery',
  ams: 'AMS'
};

// Energía, balísticos y misiles siempre; omni, artillería y AMS solo si alguno de los dos los tiene.
const ALWAYS_SHOWN: HardpointFilterType[] = ['energy', 'ballistic', 'missile'];

const hardpointRows = (a: ComparedSide, b: ComparedSide): RowDefinition[] => {
  const countsA = getHardpointCounts(a.mech);
  const countsB = getHardpointCounts(b.mech);
  return HARDPOINT_FILTER_TYPES
    .filter(type => ALWAYS_SHOWN.includes(type) || countsA[type] > 0 || countsB[type] > 0)
    .map(type => ({
      key: type,
      label: HARDPOINT_LABELS[type],
      value: side => getHardpointCounts(side.mech)[type],
      format: value => String(value),
      better: 'higher'
    }));
};

// Mismos grupos y cifras que la pestaña 'Mech. Lo mejor es lo más alto, salvo el calor que se genera.
const STAT_GROUPS: { title: string; rows: RowDefinition[] }[] = [
  {
    title: 'DEFENSE',
    rows: [
      { key: 'armor', label: 'Armor', value: side => side.summary.armorPoints, format: formatArmorPoints, better: 'higher' },
      { key: 'structure', label: 'Structure', value: side => side.summary.structurePoints, format: formatArmorPoints, better: 'higher' }
    ]
  },
  {
    title: 'FIREPOWER',
    rows: [
      { key: 'firepower', label: 'Volley damage', value: side => side.summary.firepower, format: value => formatNumber(value), better: 'higher' },
      { key: 'melee', label: 'Melee damage', value: side => side.summary.meleeDamage, format: value => formatNumber(value), better: 'higher' },
      { key: 'dps', label: 'Nominal DPS', value: side => side.summary.dps, format: value => value.toFixed(1), better: 'higher' },
      { key: 'maxRange', label: 'Max weapon range', unit: 'm', value: side => side.summary.maxWeaponRange, format: value => String(Math.floor(value)), better: 'higher' }
    ]
  },
  {
    title: 'HEAT',
    rows: [
      { key: 'cooling', label: 'Cooling rate', unit: 'heat/s', value: side => side.summary.coolingRate, format: formatCoolingRate, better: 'higher' },
      { key: 'heatCapacity', label: 'Heat capacity', value: side => side.summary.heatCapacity, format: value => formatNumber(value), better: 'higher' },
      { key: 'heatSpike', label: 'Heat spike', value: side => side.summary.heatSpike, format: value => formatNumber(value), better: 'lower' },
      { key: 'heatPerSecond', label: 'Heat while firing', unit: 'heat/s', value: side => side.summary.heatPerSecond, format: value => formatNumber(value, 1), better: 'lower' }
    ]
  },
  {
    title: 'MOBILITY',
    rows: [
      { key: 'speed', label: 'Top speed', unit: 'km/h', value: side => side.summary.topSpeed, format: value => value.toFixed(1), better: 'higher' },
      { key: 'turnSpeed', label: 'Turn speed', unit: '°/s', value: side => side.summary.turnSpeed, format: formatTurnRate, better: 'higher' },
      { key: 'torsoYaw', label: 'Torso twist, yaw', unit: '°/s', value: side => side.summary.torsoYaw, format: formatTurnRate, better: 'higher' },
      { key: 'jumpJets', label: 'Jump jets', value: side => side.summary.jumpJetCount, format: value => String(value), better: 'higher' }
    ]
  },
  {
    title: 'CHASSIS',
    rows: [
      { key: 'tonnage', label: 'Max tonnage', unit: 't', value: side => side.mech.tonnageMax, format: value => formatNumber(value), better: 'none' },
      { key: 'upgradeSlots', label: 'Upgrade slots', value: side => side.mech.upgradeSlots ?? null, format: value => String(value), better: 'higher' }
    ]
  }
];

const buildRow = (definition: RowDefinition, a: ComparedSide, b: ComparedSide): ComparisonRow => {
  const valueA = definition.value(a);
  const valueB = definition.value(b);
  const textA = valueA === null ? '—' : definition.format(valueA);
  const textB = valueB === null ? '—' : definition.format(valueB);
  // Se compara lo que se ve: dos valores que se muestran iguales empatan aunque difieran en decimales.
  const winner = textA === textB ? null : pickWinner(valueA, valueB, definition.better);
  return {
    key: definition.key,
    label: definition.label,
    unit: definition.unit,
    a: textA,
    b: textB,
    valueA,
    valueB,
    winner,
    lowerIsBetter: definition.better === 'lower',
    // Con el signo del ganador: +35 si gana el más alto, -1.8 si gana el más bajo.
    difference: winner && valueA !== null && valueB !== null
      ? `${definition.better === 'lower' ? '-' : '+'}${definition.format(Math.abs(valueA - valueB))}`
      : null
  };
};

export const compareBuilds = (a: ComparedSide, b: ComparedSide): ComparisonGroup[] => [
  { title: 'HARDPOINTS', rows: hardpointRows(a, b).map(definition => buildRow(definition, a, b)) },
  ...STAT_GROUPS.map(group => ({ title: group.title, rows: group.rows.map(definition => buildRow(definition, a, b)) }))
];

// Al abrir la comparación se propone otra variante del mismo chasis, que es lo que más se compara;
// si no la hay, el primer 'Mech de la lista.
export const getDefaultComparison = (mechs: Mech[], current: Mech): number => {
  const sibling = mechs.findIndex(mech => mech.name === current.name && mech.id !== current.id);
  return sibling >= 0 ? sibling : mechs.findIndex(mech => mech.id !== current.id);
};

// Una build con su resumen de cifras, mejoras incluidas, lista para comparar.
export const toComparedSide = (build: SharedBuild): ComparedSide => ({
  mech: build.mech,
  summary: getBuildSummary(build.mech, build.loadout, build.armor, getUpgrades(build.upgrades))
});

// Una build guardada se reconstruye como un enlace compartido; si su código ya no vale, no se compara.
export const resolveSavedBuild = (saved: SavedBuild, mechs: Mech[], catalog: Item[]): SharedBuild | null =>
  decodeBuild(saved.code, mechs, catalog);

export interface LoadoutLine {
  name: string;
  type: Item['type'];
  weaponType: Item['weaponType'];
  tier: string | null;
  count: number;
}

export interface LoadoutGroup {
  zone: Zone;
  label: string;
  items: LoadoutLine[];
}

const TYPE_ORDER: Record<Item['type'], number> = { weapon: 0, equipment: 1, ammo: 2 };

// Loadout por componente para la tarjeta: armas, equipo y munición, con las repeticiones juntas
// (AC/20 Ammo ×2) y sin los componentes vacíos.
export const groupLoadout = (loadout: EquippedLoadout): LoadoutGroup[] => ZONE_KEYS
  .map(zone => {
    const lines = new Map<string, LoadoutLine>();
    for (const item of loadout[zone]) {
      const tier = getTierName(item);
      const key = `${item.id}:${tier ?? ''}`;
      const line = lines.get(key) ?? { name: item.name, type: item.type, weaponType: item.weaponType, tier, count: 0 };
      line.count += 1;
      lines.set(key, line);
    }
    const items = [...lines.values()].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
    return { zone, label: ZONE_LABELS[zone], items };
  })
  .filter(group => group.items.length > 0);
