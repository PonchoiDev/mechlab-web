import type { YamlMech } from '../../types/yaml-mechlab';

// Búsqueda y clase de peso del selector de 'Mechs del MechLab de YAML, como en los de MW5 y BATTLETECH.

export type YamlWeightClass = 'light' | 'medium' | 'heavy' | 'assault';
export const WEIGHT_CLASSES: YamlWeightClass[] = ['light', 'medium', 'heavy', 'assault'];

// Los tramos de MW5: hasta 35 t ligero, hasta 55 medio, hasta 75 pesado y de 80 en adelante asalto.
export function getWeightClass(tonnage: number): YamlWeightClass {
  if (tonnage <= 35) return 'light';
  if (tonnage <= 55) return 'medium';
  if (tonnage <= 75) return 'heavy';
  return 'assault';
}

export function filterYamlMechs(mechs: YamlMech[], query: string, classes: YamlWeightClass[]): YamlMech[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return mechs
    .filter(mech => classes.length === 0 || classes.includes(getWeightClass(mech.tonnage)))
    .filter(mech => words.every(word => `${mech.chassis} ${mech.variant}`.toLowerCase().includes(word)))
    .sort((a, b) => a.chassis.localeCompare(b.chassis) || a.variant.localeCompare(b.variant));
}
