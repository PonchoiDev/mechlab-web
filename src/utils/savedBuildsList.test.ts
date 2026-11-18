import { describe, expect, it } from 'vitest';
import { meetsHardpointMinimums } from './hardpointMinimums';
import {
  countBuildsByWeightClass,
  countWeaponTypes,
  filterBuildRows,
  parseBuildSort,
  sortBuildRows,
  type BuildListRow
} from './savedBuildsList';

// Criterios de aceptación de docs/specs/buscar-builds-guardadas.md.
const row = (name: string, day: number, mech: Pick<BuildListRow, 'chassis' | 'variant' | 'weightClass' | 'tonnage' | 'firepower' | 'hardpoints'> & Partial<Pick<BuildListRow, 'weapons'>>): BuildListRow => ({
  id: name,
  name,
  savedAt: `2026-11-0${day}T10:00:00.000Z`,
  weapons: null,
  ...mech
});
const rows: BuildListRow[] = [
  row('Brawler', 3, { chassis: 'Atlas', variant: 'AS7-D', weightClass: 'assault', tonnage: 100, firepower: 80, hardpoints: { energy: 4, ballistic: 1, missile: 1 } }),
  row('LRM boat', 5, { chassis: 'Catapult', variant: 'CPLT-C1', weightClass: 'heavy', tonnage: 65, firepower: 60, hardpoints: { energy: 4, missile: 2 } }),
  row('Sniper', 1, { chassis: 'Atlas', variant: 'AS7-K', weightClass: 'assault', tonnage: 99.5, firepower: 70, hardpoints: { energy: 4, ballistic: 1, missile: 1 } }),
  row('Scout', 4, { chassis: 'Locust', variant: 'LCT-1V', weightClass: 'light', tonnage: 20, firepower: 15, hardpoints: { energy: 1, ballistic: 2 } }),
  // De un 'Mech que ya no existe: no se puede abrir.
  row('Old one', 2, { chassis: null, variant: null, weightClass: null, tonnage: null, firepower: null, hardpoints: null })
];
const names = (list: BuildListRow[]) => list.map(candidate => candidate.name);
const filter = (query: string, weightClasses: BuildListRow['weightClass'][] = []) =>
  names(filterBuildRows(rows, { query, weightClasses: weightClasses.filter(Boolean) as NonNullable<BuildListRow['weightClass']>[] }));

describe('buscar, ordenar y filtrar las builds guardadas', () => {
  it('CA1: por fecha, de la más nueva a la más antigua y al revés', () => {
    expect(names(sortBuildRows(rows, 'newest'))).toEqual(['LRM boat', 'Scout', 'Brawler', 'Old one', 'Sniper']);
    expect(names(sortBuildRows(rows, 'oldest'))).toEqual(['Sniper', 'Old one', 'Brawler', 'Scout', 'LRM boat']);
  });

  it('CA2: por nombre', () => {
    expect(names(sortBuildRows(rows, 'name'))).toEqual(['Brawler', 'LRM boat', 'Old one', 'Scout', 'Sniper']);
  });

  it('CA3: por chasis y variante, con las que no se pueden abrir al final', () => {
    expect(names(sortBuildRows(rows, 'chassis'))).toEqual(['Brawler', 'Sniper', 'LRM boat', 'Scout', 'Old one']);
  });

  it('CA4: por tonelaje y por potencia de fuego, de mayor a menor', () => {
    expect(names(sortBuildRows(rows, 'tonnage'))).toEqual(['Brawler', 'Sniper', 'LRM boat', 'Scout', 'Old one']);
    expect(names(sortBuildRows(rows, 'firepower'))).toEqual(['Brawler', 'Sniper', 'LRM boat', 'Scout', 'Old one']);
  });

  it('CA5: busca en el nombre, el chasis y la variante, sin mayúsculas ni tildes', () => {
    expect(filter('atlas')).toEqual(['Brawler', 'Sniper']);
    expect(filter('ATLÁS brawl')).toEqual(['Brawler']);
    expect(filter('cplt')).toEqual(['LRM boat']);
    expect(filter('nada')).toEqual([]);
    expect(filter('  ')).toEqual(names(rows));
  });

  it('CA6: filtra por clase de peso', () => {
    expect(filter('', ['assault'])).toEqual(['Brawler', 'Sniper']);
    expect(filter('', ['light', 'heavy'])).toEqual(['LRM boat', 'Scout']);
  });

  it('CA7: cuenta las builds de cada clase', () => {
    expect(countBuildsByWeightClass(rows)).toEqual({ light: 1, medium: 0, heavy: 1, assault: 2 });
  });

  it('CA8: el orden guardado', () => {
    expect(parseBuildSort('tonnage')).toBe('tonnage');
    expect(parseBuildSort('nope')).toBe('newest');
    expect(parseBuildSort(null)).toBe('newest');
  });

  it('CA9: filtra por anclajes mínimos del Mech', () => {
    const withMinimums = (minHardpoints: Record<string, number>) =>
      names(sortBuildRows(filterBuildRows(rows, { query: '', weightClasses: [], minHardpoints }), 'name'));
    expect(withMinimums({ ballistic: 2 })).toEqual(['Scout']);
    expect(withMinimums({ energy: 3, ballistic: 1 })).toEqual(['Brawler', 'Sniper']);
    expect(withMinimums({ missile: 1 })).toEqual(['Brawler', 'LRM boat', 'Sniper']);
    expect(withMinimums({ energy: 0 })).toEqual(names(sortBuildRows(rows, 'name')));
  });

  it('CA10: los omni cuentan como comodín de energía, balística y misiles, una vez cada uno', () => {
    const omni = { energy: 1, omni: 2 };
    expect(meetsHardpointMinimums(omni, { energy: 3 })).toBe(true);
    expect(meetsHardpointMinimums(omni, { missile: 2 })).toBe(true);
    expect(meetsHardpointMinimums(omni, { omni: 1 })).toBe(true);
    expect(meetsHardpointMinimums(omni, { energy: 3, ballistic: 1 })).toBe(false);
    expect(meetsHardpointMinimums(omni, { omni: 3 })).toBe(false);
  });

  it('CA11: las armas montadas por tipo, en el orden del juego', () => {
    const order = ['energy', 'ballistic', 'missile', 'support'];
    expect(countWeaponTypes(['missile', 'energy', undefined, 'ballistic', 'energy'], order)).toEqual([
      { type: 'energy', count: 2 },
      { type: 'ballistic', count: 1 },
      { type: 'missile', count: 1 }
    ]);
    expect(countWeaponTypes([], order)).toEqual([]);
  });

  it('CA12: los mínimos se comparan con los anclajes o con las armas montadas', () => {
    const puma = row('Puma', 6, {
      chassis: 'Puma', variant: 'ADR-A', weightClass: 'light', tonnage: 35, firepower: 40,
      hardpoints: { energy: 1, omni: 2, missile: 2 }, weapons: { energy: 3, missile: 2 }
    });
    const list = [puma, rows[4]];
    const matches = (minHardpoints: Record<string, number>, minimumsOf: 'hardpoints' | 'weapons') =>
      names(filterBuildRows(list, { query: '', weightClasses: [], minHardpoints, minimumsOf }));
    expect(matches({ ballistic: 1 }, 'hardpoints')).toEqual(['Puma']);
    expect(matches({ energy: 3, missile: 2 }, 'hardpoints')).toEqual(['Puma']);
    expect(matches({ ballistic: 1 }, 'weapons')).toEqual([]);
    expect(matches({ energy: 3, missile: 2 }, 'weapons')).toEqual(['Puma']);
    expect(matches({ energy: 4 }, 'weapons')).toEqual([]);
  });
});
