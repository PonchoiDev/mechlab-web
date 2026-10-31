import type { Item } from '../types/item';
import type { EquippedLoadout, Mech, Zone } from '../types/mech';
import { decodeBuild, type SharedBuild } from './buildCode';
import { formatArmorPoints, formatCoolingRate, formatTurnRate, getBuildSummary, type BuildSummary } from './calculators';
import { getTierName } from './items';
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

type Better = 'higher' | 'lower';

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
  if (a === null || b === null || a === b) return null;
  return (a > b) === (better === 'higher') ? 'a' : 'b';
};

// Las cifras de la pestaña 'Mech, empezando por la potencia de fuego. Los anclajes y el chasis no van:
// se ven en la tarjeta. Lo mejor es lo más alto, salvo el calor que se genera.
const STAT_GROUPS: { title: string; rows: RowDefinition[] }[] = [
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
    title: 'DEFENSE',
    rows: [
      { key: 'armor', label: 'Armor', value: side => side.summary.armorPoints, format: formatArmorPoints, better: 'higher' },
      { key: 'structure', label: 'Structure', value: side => side.summary.structurePoints, format: formatArmorPoints, better: 'higher' }
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
      { key: 'torsoPitch', label: 'Torso twist, pitch', unit: '°/s', value: side => side.summary.torsoPitch, format: formatTurnRate, better: 'higher' },
      { key: 'jumpJets', label: 'Jump jets', value: side => side.summary.jumpJetCount, format: value => String(value), better: 'higher' }
    ]
  },
  {
    // Iguales en todos los chasis sin mejoras: solo cambian con las de la cantina.
    title: 'TARGETING',
    rows: [
      { key: 'sensorRange', label: 'Sensor range', unit: 'm', value: side => side.summary.sensorRange, format: value => formatNumber(value, 0), better: 'higher' },
      { key: 'lockRetention', label: 'Lock retention time', unit: 's', value: side => side.summary.lockRetentionTime, format: value => formatNumber(value), better: 'higher' },
      { key: 'loseLock', label: 'Lose lock time', unit: 's', value: side => side.summary.loseLockTime, format: value => formatNumber(value), better: 'higher' }
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

export const compareBuilds = (a: ComparedSide, b: ComparedSide): ComparisonGroup[] =>
  STAT_GROUPS.map(group => ({ title: group.title, rows: group.rows.map(definition => buildRow(definition, a, b)) }));

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
