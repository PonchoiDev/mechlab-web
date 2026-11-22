import { describe, expect, it } from 'vitest';
import { allMechs } from '../test/fixtures';
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

// Criterios de aceptación de docs/specs/lista-chasis.md, con mechs.json real.
const rows = getChassisRows(allMechs);
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

  it('CA2: las cifras del AS7-D, con el calor del chasis vacío', () => {
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
      heatCapacity: 40,
      cooling: 1,
      year: 3015,
      dlc: 0
    });
    expect(atlas.hardpoints).toMatchObject({ energy: 4, ballistic: 1, missile: 2, omni: 0 });
    expect(atlas).not.toHaveProperty('alpha');
    expect(atlas).not.toHaveProperty('dps');
  });

  it('CA3: el LCT-1V y el ADR-A', () => {
    expect(row('LCT-1V')).toMatchObject({ speed: 129.6, upgradeSlots: 8, heatCapacity: 36.4, cooling: 0.64 });
    const puma = row('ADR-A');
    expect(puma).toMatchObject({ chassis: 'Puma (Adder)', engineRating: 210, xl: true, dlc: 7, year: 3050 });
    expect(puma.hardpoints).toMatchObject({ energy: 1, missile: 2, omni: 2 });
  });

  it('CA4: los filtros del selector y los de las cifras del chasis', () => {
    const atlas = filtered({ query: 'atlas' });
    expect(atlas.length).toBeGreaterThan(0);
    expect(atlas.every(candidate => candidate.chassis.startsWith('Atlas'))).toBe(true);
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
    expect(sortChassisRows(rows, { key: 'heatCapacity', dir: 'desc' })[0].heatCapacity)
      .toBe(Math.max(...rows.map(candidate => candidate.heatCapacity ?? 0)));
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

  it('CA5 de filtros-sonda-artilleria: la sonda y la artillería en la URL de la lista', () => {
    const parsed = parseChassisQuery('?bap=1&min=1art');
    expect(parsed.filters).toMatchObject({ activeProbe: true, minHardpoints: { artillery: 1 } });
    expect(toChassisQuery(parsed)).toBe('?bap=1&min=1art');
    expect(filtered({}, { activeProbe: true })).toHaveLength(204);
    expect(filtered({}, { minHardpoints: { artillery: 1 } })).toHaveLength(7);
  });

  it('CA4 de filtro-motive: Motive en la URL de la lista', () => {
    const parsed = parseChassisQuery('?masc=1');
    expect(parsed.filters).toMatchObject({ motive: true });
    expect(toChassisQuery(parsed)).toBe('?masc=1');
    expect(filtered({}, { motive: true })).toHaveLength(33);
  });

  it('los mínimos de dos cifras van en la URL: hay \'Mechs con más de 10 anclajes de un tipo', () => {
    const parsed = parseChassisQuery('?min=15e,16b');
    expect(parsed.filters.minHardpoints).toMatchObject({ energy: 15, ballistic: 16 });
    expect(toChassisQuery(parsed)).toBe('?min=15e,16b');
    expect(filtered({}, { minHardpoints: { ballistic: 16 } }).map(row => row.mech.variant)).toContain('ADR-S');
  });
});
