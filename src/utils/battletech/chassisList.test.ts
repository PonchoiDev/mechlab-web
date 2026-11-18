import { describe, expect, it } from 'vitest';
import { BT_MECHS } from './mechlabData';
import { getHardpointCount } from './fitting';
import {
  DEFAULT_BT_CHASSIS_VIEW,
  countBtChassis,
  filterBtChassisRows,
  getBtChassisLink,
  getBtChassisRows,
  parseBtChassisQuery,
  sortBtChassisRows,
  toBtChassisQuery,
  type BtChassisView
} from './chassisList';
import { toggleColumnSort } from '../tableSort';

// Criterios de aceptación de docs/specs/battletech-lista-chasis.md, con los datos reales de BATTLETECH.
const rows = getBtChassisRows(BT_MECHS);
const row = (variant: string) => rows.find(candidate => candidate.mech.variant === variant)!;
const view = (change: Partial<BtChassisView> = {}, filters: Partial<BtChassisView['filters']> = {}): BtChassisView =>
  ({ ...DEFAULT_BT_CHASSIS_VIEW, ...change, filters: { ...DEFAULT_BT_CHASSIS_VIEW.filters, ...filters } });
const filtered = (change: Partial<BtChassisView> = {}, filters: Partial<BtChassisView['filters']> = {}) =>
  filterBtChassisRows(rows, view(change, filters));

describe('lista de chasis de BATTLETECH', () => {
  it('CA1: una fila por variante', () => {
    expect(rows).toHaveLength(96);
    expect(countBtChassis(rows)).toBe(51);
    const bySource = (source: string) => rows.filter(candidate => candidate.mech.source === source).length;
    expect([bySource('base'), bySource('heavymetal'), bySource('flashpoint'), bySource('urbanwarfare')]).toEqual([70, 15, 6, 5]);
  });

  it('CA2: las cifras del HBK-4G vacío', () => {
    const hunchback = row('HBK-4G');
    expect(hunchback).toMatchObject({
      chassis: 'Hunchback',
      tonnage: 50,
      freeTonnage: 31.5,
      armor: 1045,
      structure: 416,
      walk: 120,
      sprint: 200,
      jumpJets: 4,
      stability: 130,
      melee: 80,
      dfa: 65
    });
    expect(hunchback.mech.weightClass).toBe('medium');
    expect(hunchback.hardpoints).toEqual({ energy: 2, ballistic: 3, missile: 0, support: 1 });
    expect(hunchback.fixed).toEqual([]);
  });

  it('CA3: el equipo fijo del FLE-15 y del RVN-1X', () => {
    expect(row('FLE-15').mech.source).toBe('heavymetal');
    expect(row('FLE-15').hardpoints.support).toBe(5);
    expect(row('FLE-15').fixed.map(tag => tag.label)).toEqual(['Targeting Baffle ×2']);
    expect(row('RVN-1X').mech.source).toBe('urbanwarfare');
    expect(row('RVN-1X').fixed.map(tag => tag.label)).toEqual(['X-1 EW Equipment']);
  });

  it('CA4: los filtros del selector y los de las cifras del chasis', () => {
    const atlas = filtered({}, { query: 'atlas' });
    expect(atlas.length).toBeGreaterThan(0);
    expect(atlas.every(candidate => candidate.chassis === 'Atlas')).toBe(true);
    const tokens = filtered({}, { query: '3e 2m' });
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every(candidate => getHardpointCount(candidate.mech, 'energy') >= 3 && getHardpointCount(candidate.mech, 'missile') >= 2)).toBe(true);
    expect(filtered({}, { weightClasses: ['light'] })).toHaveLength(20);
    expect(filtered({}, { sources: ['heavymetal'] })).toHaveLength(15);
    const snipers = filtered({}, { tags: ['Sniper'] });
    expect(snipers.length).toBeGreaterThan(0);
    expect(snipers.every(candidate => candidate.mech.tags.includes('Sniper'))).toBe(true);
    expect(filtered({}, { minJumpJets: 6 }).every(candidate => candidate.jumpJets >= 6)).toBe(true);
    expect(filtered({ minTons: 20, maxTons: 35 })).toHaveLength(20);
    expect(filtered({ minSprint: 200 })).toHaveLength(84);
  });

  it('CA5: el orden por columnas', () => {
    expect(sortBtChassisRows(rows, { key: 'sprint', dir: 'desc' })[0].sprint).toBe(350);
    expect(sortBtChassisRows(rows, { key: 'freeTonnage', dir: 'desc' })[0].mech.variant).toBe('ANH-1A');
    const byName = sortBtChassisRows(rows, { key: 'name', dir: 'asc' });
    expect(byName[0].chassis.localeCompare(byName[byName.length - 1].chassis)).toBeLessThan(0);
    const sprint = toggleColumnSort(DEFAULT_BT_CHASSIS_VIEW.sort, 'sprint');
    expect(sprint).toEqual({ key: 'sprint', dir: 'desc' });
    expect(sortBtChassisRows(rows, toggleColumnSort(sprint, 'sprint'))[0].sprint)
      .toBe(Math.min(...rows.map(candidate => candidate.sprint ?? Infinity)));
  });

  it('CA6: la vista en la URL', () => {
    const search = '?q=atlas&class=assault&source=base,heavymetal&role=Sniper,Tank&min=3e,2m,1s&jj=4&tmin=20&tmax=35&sprint=200&sort=sprint&dir=asc';
    const parsed = parseBtChassisQuery(search);
    expect(parsed.filters).toMatchObject({
      query: 'atlas', weightClasses: ['assault'], sources: ['base', 'heavymetal'], tags: ['Sniper', 'Tank'],
      minHardpoints: { energy: 3, ballistic: 0, missile: 2, support: 1 }, minJumpJets: 4
    });
    expect(parsed).toMatchObject({ minTons: 20, maxTons: 35, minSprint: 200, sort: { key: 'sprint', dir: 'asc' } });
    expect(toBtChassisQuery(parsed)).toBe(search);

    expect(parseBtChassisQuery('')).toEqual(DEFAULT_BT_CHASSIS_VIEW);
    expect(toBtChassisQuery(DEFAULT_BT_CHASSIS_VIEW)).toBe('');
    expect(parseBtChassisQuery('?class=huge&source=mods&sort=color&min=9x&jj=abc&tmin=abc')).toEqual(DEFAULT_BT_CHASSIS_VIEW);
  });

  it('CA7: el enlace al MechLab con la build de serie', () => {
    expect(getBtChassisLink(row('HBK-4G').mech)).toBe('/battletech/?mech=HBK-4G');
  });
});
