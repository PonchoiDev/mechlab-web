import type { BtBuild } from '../../types/battletech-mechlab';
import type { ComparisonGroup, ComparisonRow, Winner } from '../compare';
import { EMPTY_VALUE } from '../format';
import { getBuildSummary, type BtSummary } from './stats';

// Comparación de dos builds de BATTLETECH con las mismas filas que la de MW5 (src/utils/compare.ts),
// pero con las cifras de este juego. Solo se importan sus tipos: sus funciones cargan el catálogo de MW5.
type Better = 'higher' | 'lower';

interface RowDefinition {
  key: string;
  label: string;
  unit?: string;
  value: (summary: BtSummary) => number | null;
  better: Better;
  format?: (value: number) => string;
}

const formatNumber = (value: number) => String(Number(value.toFixed(2)));

const pickWinner = (a: number | null, b: number | null, better: Better): Winner => {
  if (a === null || b === null || a === b) return null;
  return (a > b) === (better === 'higher') ? 'a' : 'b';
};

const STAT_GROUPS: { title: string; rows: RowDefinition[] }[] = [
  {
    title: 'FIREPOWER',
    rows: [
      { key: 'alphaDamage', label: 'Alpha damage', value: summary => summary.alphaDamage, better: 'higher' },
      { key: 'instability', label: 'Stability damage', value: summary => summary.instability, better: 'higher' },
      { key: 'maxRange', label: 'Max weapon range', unit: 'm', value: summary => summary.maxRange, better: 'higher' }
    ]
  },
  {
    title: 'DEFENSE',
    rows: [
      { key: 'armor', label: 'Armor', value: summary => summary.armorPoints, better: 'higher' },
      { key: 'structure', label: 'Structure', value: summary => summary.structure, better: 'higher' },
      { key: 'stability', label: 'Stability', value: summary => summary.stability, better: 'higher' }
    ]
  },
  {
    title: 'HEAT',
    rows: [
      { key: 'dissipation', label: 'Heat sinking', unit: 'per turn', value: summary => summary.heat.dissipation, better: 'higher' },
      { key: 'alphaHeat', label: 'Alpha heat', value: summary => summary.heat.alpha, better: 'lower' },
      { key: 'maxHeat', label: 'Max heat', value: summary => summary.heat.maxHeat, better: 'higher' }
    ]
  },
  {
    title: 'MOBILITY',
    rows: [
      { key: 'walk', label: 'Walk', unit: 'm', value: summary => summary.walk, better: 'higher' },
      { key: 'sprint', label: 'Sprint', unit: 'm', value: summary => summary.sprint, better: 'higher' },
      { key: 'jumpJets', label: 'Jump jets', value: summary => summary.jumpJets, better: 'higher' }
    ]
  },
  {
    title: 'COST',
    rows: [
      { key: 'cost', label: 'Value', unit: 'C-Bills', value: summary => summary.cost, better: 'lower', format: value => value.toLocaleString('en') }
    ]
  }
];

const buildRow = (definition: RowDefinition, a: BtSummary, b: BtSummary): ComparisonRow => {
  const valueA = definition.value(a);
  const valueB = definition.value(b);
  const format = definition.format ?? formatNumber;
  const textA = valueA === null ? EMPTY_VALUE : format(valueA);
  const textB = valueB === null ? EMPTY_VALUE : format(valueB);
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
    difference: winner && valueA !== null && valueB !== null
      ? `${definition.better === 'lower' ? '-' : '+'}${format(Math.abs(valueA - valueB))}`
      : null
  };
};

export const compareBtBuilds =(a: BtBuild, b: BtBuild): ComparisonGroup[] => {
  const summaryA = getBuildSummary(a);
  const summaryB = getBuildSummary(b);
  return STAT_GROUPS.map(group => ({ title: group.title, rows: group.rows.map(definition => buildRow(definition, summaryA, summaryB)) }));
};
