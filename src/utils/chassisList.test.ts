import { describe, expect, it } from 'vitest';
import { allItems, allMechs } from '../test/fixtures';
import { EMPTY_MECH_FILTERS, getHardpointCounts, hasJumpJets } from './mechs';
import { meetsHardpointMinimums } from './hardpointMinimums';
import {
  DEFAULT_CHASSIS_VIEW,
  countChassis,
  filterChassisRows,
  getChassisLink,
  getChassisRows,
  parseChassisQuery,
  sortChassisRows,
  toChassisQuery,
  toggleChassisSort,
  type ChassisView
} from './chassisList';

// Criterios de aceptación de docs/specs/lista-chasis.md, con mechs.json e items.json reales.
const rows = getChassisRows(allMechs, allItems);
const row = (variant: string) => rows.find(candidate => candidate.mech.variant === variant)!;
const view = (change: Partial<ChassisView> = {}, filters: Partial<ChassisView['filters']> = {}): ChassisView =>
  ({ ...DEFAULT_CHASSIS_VIEW, ...change, filters: { ...EMPTY_MECH_FILTERS, ...filters } });
const filtered = (change: Partial<ChassisView> = {}, filters: Partial<ChassisView['filters']> = {}) =>
  filterChassisRows(rows, view(change, filters));

describe('lista de chasis de MW5', () => {
  it('CA1: una fila por variante', () => {
    expect(rows).toHaveLength(639);
    expect(countChassis(rows)).toBe(109);
    expect(rows.filter(candidate => candidate.mech.techBase === 'Clan')).toHaveLength(198);
    expect(rows.filter(candidate => candidate.mech.hero)).toHaveLength(109);
  });

  it('CA2: las cifras del AS7-D, del chasis y de su build de serie', () => {
    const atlas = row('AS7-D');
    expect(atlas).toMatchObject({
      chassis: 'Atlas',
      weightClass: 'assault',
      tonnage: 100,
      engineRating: 300,
      xl: false,
      speed: 48.6,
      armor: 626,
      structure: 313,
      jumpJets: 0,
      turnSpeed: 60.73,
      torsoYaw: 76.5,
      upgradeSlots: 6,
      alpha: 78.4,
      heatCapacity: 49,
      cooling: 1.9,
      year: 3015,
      dlc: 0
    });
    expect(atlas.hardpoints).toMatchObject({ energy: 4, ballistic: 1, missile: 2, omni: 0 });
    expect(atlas.dps).toBeCloseTo(22.2, 2);
  });

  it('CA3: el LCT-1V y el ADR-A', () => {
    expect(row('LCT-1V')).toMatchObject({ speed: 129.6, upgradeSlots: 8, alpha: 8 });
    const puma = row('ADR-A');
    expect(puma).toMatchObject({ chassis: 'Puma (Adder)', engineRating: 210, xl: true, dlc: 7, year: 3050 });
    expect(puma.hardpoints).toMatchObject({ energy: 1, missile: 2, omni: 2 });
  });

  it('CA4: los filtros del selector y los de las cifras del chasis', () => {
    const atlas = filtered({ query: 'atlas' });
    expect(atlas.length).toBeGreaterThan(0);
    expect(atlas.every(candidate => candidate.chassis === 'Atlas')).toBe(true);
    expect(atlas.map(candidate => candidate.mech.variant)).toContain('AS7-D');

    const tokens = filtered({ query: '3e 2m jj' });
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every(candidate => hasJumpJets(candidate.mech)
      && meetsHardpointMinimums(getHardpointCounts(candidate.mech), { energy: 3, missile: 2 }))).toBe(true);

    expect(filtered({}, { techBase: 'Clan' })).toHaveLength(198);
    expect(filtered({}, { hero: true })).toHaveLength(109);
    expect(filtered({ minTons: 20, maxTons: 35 })).toHaveLength(99);
    expect(filtered({ minSpeed: 120 })).toHaveLength(51);
  });

  it('CA5: el orden por columnas', () => {
    expect(sortChassisRows(rows, { key: 'speed', dir: 'desc' })[0].speed).toBe(162);
    expect(sortChassisRows(rows, { key: 'alpha', dir: 'desc' })[0].mech.variant).toBe('BANE-3');
    const byName = sortChassisRows(rows, { key: 'name', dir: 'asc' });
    expect(byName[0].chassis.localeCompare(byName[byName.length - 1].chassis)).toBeLessThan(0);

    const speed = toggleChassisSort(DEFAULT_CHASSIS_VIEW.sort, 'speed');
    expect(speed).toEqual({ key: 'speed', dir: 'desc' });
    const slowest = sortChassisRows(rows, toggleChassisSort(speed, 'speed'))[0].speed;
    expect(slowest).toBe(Math.min(...rows.map(candidate => candidate.speed)));
  });

  it('CA6: la vista en la URL', () => {
    const search = '?q=atlas&class=assault&tech=clan&role=Juggernaut&jj=1&ecm=1&hero=1&min=3e,2m,1ams&year=3050&dlc=base,7&tmin=20&tmax=35&speed=120&sort=speed&dir=asc';
    const parsed = parseChassisQuery(search);
    expect(parsed.filters).toMatchObject({
      weightClasses: ['assault'], techBase: 'Clan', roles: ['Juggernaut'], jumpJets: true, ecm: true, hero: true,
      minHardpoints: { energy: 3, missile: 2, ams: 1 }, maxYear: 3050, dlcs: [0, 7]
    });
    expect(parsed).toMatchObject({ query: 'atlas', minTons: 20, maxTons: 35, minSpeed: 120, sort: { key: 'speed', dir: 'asc' } });
    expect(toChassisQuery(parsed)).toBe(search);

    expect(parseChassisQuery('')).toEqual(DEFAULT_CHASSIS_VIEW);
    expect(toChassisQuery(DEFAULT_CHASSIS_VIEW)).toBe('');
    expect(parseChassisQuery('?class=huge&tech=nope&sort=color&min=9x&dlc=12&tmin=abc')).toEqual(DEFAULT_CHASSIS_VIEW);
  });

  it('CA7: el enlace al MechLab con la build de serie', () => {
    expect(getChassisLink(row('AS7-D').mech)).toBe('/mercs/?mech=AS7-D');
  });
});
