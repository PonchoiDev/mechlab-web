import type { YamlMech } from '../../types/yaml-mechlab';
import { getYamlItem } from './data';

// Piezas por clase de peso, como CheckEquipmentWeightClassConflicts del mod Yet Another Mechlab
// (docs/specs/clase-de-peso-yaml.md): el tonelaje mínimo y máximo de la pieza, y la clase de los MASC y los
// supercargadores. El juego no las enseña en el inventario de un 'Mech que no puede llevarlas ni deja montarlas.

// DLCGetMechEquipmentClass: la clase por el tonelaje máximo del 'Mech, en tramos con los extremos que marca el
// bytecode (el primero y el último no incluyen el de abajo). Entre tramos (26 a 29 t...) no hay clase.
const CLASS_RANGES: [number, number, boolean, number][] = [
  [0, 25, false, 1], [30, 45, true, 2], [50, 65, true, 3], [70, 85, true, 4], [90, 100, true, 5], [100, 200, false, 6]
];

export function getYamlEquipmentClass(tonnage: number): number | null {
  const range = CLASS_RANGES.find(([min, max, includesMin]) => (includesMin ? tonnage >= min : tonnage > min) && tonnage <= max);
  return range ? range[3] : null;
}

// Las universales van en todos: EquipmentHasTag con la etiqueta Universal o una hija suya.
const isUniversal = (tag: string) => /^Equipment\.(MASC|SuperCharger)\.Universal(\.|$)/.test(tag);

// Por qué la pieza no va en el 'Mech, o null si va. Primero el tonelaje (CheckEquipmentWeight); después, en los MASC
// y supercargadores (la etiqueta contiene «MASC» o «SuperCharger», sin distinguir mayúsculas), que la etiqueta
// contenga el número de la clase del 'Mech.
export function getYamlWeightClassProblem(mech: YamlMech, itemId: string): string | null {
  const item = getYamlItem(itemId);
  if (!item || item.kind === 'weapon') return null;
  if (item.minTonnage !== undefined && mech.tonnage < item.minTonnage) return `${item.name} needs a 'Mech of ${item.minTonnage} t or more`;
  if (item.maxTonnage !== undefined && mech.tonnage > item.maxTonnage) return `${item.name} only fits 'Mechs of ${item.maxTonnage} t or less`;
  const tag = item.category ?? '';
  if (!/masc|supercharger/i.test(tag) || isUniversal(tag)) return null;
  const mechClass = getYamlEquipmentClass(mech.tonnage);
  const itemClass = /Class(\d)/.exec(tag)?.[1];
  if (mechClass !== null && tag.includes(String(mechClass))) return null;
  return `${item.name} is for class ${itemClass ?? '?'} 'Mechs; this ${mech.tonnage} t 'Mech is ${mechClass === null ? 'of no class' : `class ${mechClass}`}`;
}
