import { describe, expect, it } from 'vitest';
import itemsJson from '../data/items.json';
import unitsJson from '../data/units.json';
import type { Item } from '../types/item';
import type { UnitsData } from '../types/units';
import { getWeaponStats } from './calculators';
import { filterUnits, getUnitFirepower, getUnitWeapons, groupRarity, parseUnitsQuery, sortUnits, toUnitsQuery } from './units';

// Criterios de aceptación de docs/specs/unidades-enemigas.md (issue #81).
const data = unitsJson as unknown as UnitsData;
const items = itemsJson as unknown as Record<string, Item>;
const unit = (name: string) => {
  const found = data.units.find(candidate => candidate.name === name);
  if (!found) throw new Error(`${name} no está en units.json`);
  return found;
};
const weaponList = (name: string) => getUnitWeapons(data, unit(name)).map(weapon => [weapon.count, weapon.name]);

describe('unidades enemigas', () => {
  it('CA1: hay 115 unidades de seis tipos, todas con armas del catálogo', () => {
    expect(data.units).toHaveLength(115);
    const kinds = Object.fromEntries(['tracked', 'hover', 'wheeled', 'vtol', 'turret', 'battleArmor']
      .map(kind => [kind, data.units.filter(candidate => candidate.kind === kind).length]));
    expect(kinds).toEqual({ tracked: 43, hover: 15, wheeled: 8, vtol: 12, turret: 35, battleArmor: 2 });
    expect(data.units.some(candidate => candidate.id.includes('_Recruit'))).toBe(false);
    expect(data.units.every(candidate => candidate.weapons.length > 0)).toBe(true);
    expect(data.units.every(candidate => candidate.weapons.every(weapon => data.weapons[weapon.id]))).toBe(true);
  });

  it('CA2: el Condor con su ficha, su vida, su velocidad y sus armas', () => {
    expect(unit('Condor')).toEqual(expect.objectContaining({
      kind: 'hover', role: 'Striker', tier: 1, battleValue: 485, introYear: 2564, hitPoints: 30, speed: 126
    }));
    expect(weaponList('Condor')).toEqual([[1, 'Machine Gun'], [1, 'Autocannon/5 Burst Fire'], [2, 'Medium Laser']]);
  });

  it('CA3: el Condor (Davion) lleva solo los AC/2 de su torreta', () => {
    expect(weaponList('Condor (Davion)')).toEqual([[1, 'Machine Gun'], [2, 'Autocannon/2 Burst Fire']]);
  });

  it('CA4: las armas de vehículo tienen sus propias estadísticas', () => {
    const turret = unit('Heavy Turret 4 x AC/5');
    const [autocannon] = getUnitWeapons(data, turret);
    expect(autocannon).toEqual(expect.objectContaining({ name: 'Autocannon/5', count: 4, damage: 5, range: 620 }));
    expect(autocannon.dps).toBeCloseTo(2.5);
    const firepower = getUnitFirepower(data, turret);
    expect(firepower.damage).toBeCloseTo(20);
    expect(firepower.dps).toBeCloseTo(10);
  });

  it('CA5: el AC/20 del Demolisher aplica su quirk de cooldown', () => {
    const [autocannon] = getUnitWeapons(data, unit('Demolisher Heavy Tank'));
    expect(autocannon).toEqual(expect.objectContaining({ name: 'Autocannon/20', count: 2, damage: 20 }));
    expect(autocannon.dps).toBeCloseTo(20 / 9.6, 1);
  });

  it('CA6: las armas con nivel son las del MechLab en ese tier', () => {
    const [srm] = getUnitWeapons(data, unit('Turret 2 x SRM2'));
    const mechlab = getWeaponStats({ ...items.SRM2, tier: '0' });
    expect(srm.count).toBe(2);
    expect(srm.damage).toBeCloseTo(mechlab.damage);
    expect(srm.dps).toBeCloseTo(mechlab.dps);
  });

  it('CA7: las armaduras de combate van en grupos, con la vida y las armas de cada traje', () => {
    expect(unit('Clan Elemental')).toEqual(expect.objectContaining({ kind: 'battleArmor', squad: 5, hitPoints: 20 }));
    expect(weaponList('Clan Elemental')).toEqual([
      [1, 'Clan SRM 2'], [1, 'Clan Extended Range Medium Laser'], [1, 'Clan Extended Range Small Laser']
    ]);
    expect(unit('Battle Armor')).toEqual(expect.objectContaining({ kind: 'battleArmor', squad: 4, hitPoints: null }));
    expect(weaponList('Battle Armor')).toEqual([[1, 'Small Laser']]);
  });

  it('CA8: la lista se filtra por tipo y se busca por nombre', () => {
    expect(filterUnits(data.units, { kind: 'vtol', query: '' })).toHaveLength(12);
    const scorpions = filterUnits(data.units, { kind: 'all', query: 'scorpion' });
    expect(scorpions).toHaveLength(8);
    expect(scorpions.every(candidate => candidate.name.startsWith('Scorpion'))).toBe(true);
    expect(filterUnits(data.units, { kind: 'turret', query: 'SCORPION' })).toHaveLength(0);
  });

  it('CA9: al ordenar, primero la de más DPS y al final las que no tienen el dato', () => {
    const byDps = sortUnits(data, data.units, 'dps');
    const dps = byDps.map(candidate => getUnitFirepower(data, candidate).dps);
    expect(dps).toEqual([...dps].sort((a, b) => b - a));
    const bySpeed = sortUnits(data, data.units, 'speed');
    const firstWithout = bySpeed.findIndex(candidate => candidate.speed === null);
    expect(firstWithout).toBeGreaterThan(0);
    expect(bySpeed.slice(firstWithout).every(candidate => candidate.speed === null)).toBe(true);
    expect(sortUnits(data, data.units, 'name')[0].name <= sortUnits(data, data.units, 'name')[1].name).toBe(true);
  });

  it('CA10: la rareza se agrupa de más común a más rara, sin facciones repetidas', () => {
    const groups = groupRarity(data, unit('Demolisher Heavy Tank (Gauss)'));
    expect(groups.map(group => [group.rarity, group.factions.length])).toEqual([['common', 2], ['uncommon', 23], ['veryRare', 3]]);
    for (const group of groups) expect(new Set(group.factions).size).toBe(group.factions.length);
    const names = groupRarity(data, unit('Scorpion Light Tank')).flatMap(group => group.factions);
    expect(names).toContain('House Davion');
  });

  it('CA11: los VTOL y las torretas no tienen velocidad', () => {
    const withoutSpeed = data.units.filter(candidate => candidate.kind === 'vtol' || candidate.kind === 'turret');
    expect(withoutSpeed.every(candidate => candidate.speed === null)).toBe(true);
  });
});

describe('vista de la lista en la URL', () => {
  it('lee el tipo, la búsqueda y el orden, e ignora lo que no conoce', () => {
    expect(parseUnitsQuery('?type=vtol&q=igor&sort=dps')).toEqual({ kind: 'vtol', query: 'igor', sort: 'dps' });
    expect(parseUnitsQuery('?type=mech&sort=weight')).toEqual({ kind: 'all', query: '', sort: 'name' });
  });

  it('escribe solo lo que no es el valor por defecto', () => {
    expect(toUnitsQuery({ kind: 'all', query: '', sort: 'name' })).toBe('');
    expect(toUnitsQuery({ kind: 'turret', query: ' AC/5 ', sort: 'battleValue' })).toBe('?type=turret&q=AC%2F5&sort=battleValue');
  });
});
