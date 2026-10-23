import { describe, expect, it } from 'vitest';
import {
  EMPTY_MECH_FILTERS,
  getAvailableYear,
  getHardpointCounts,
  getHardpointGroups,
  getMechSpecs,
  getMechDisplayName,
  hasEcm,
  hasJumpJets,
  matchesMechFilters,
  matchesMechQuery,
  parseMechQuery,
  type MechFilters
} from './mechs';
import { allMechs, getMech } from '../test/fixtures';

describe('getMechDisplayName', () => {
  it('añade el nombre de Sarna cuando es distinto del chasis', () => {
    expect(getMechDisplayName(getMech('ADR-A'))).toBe('PUMA (Adder)');
  });

  it('usa solo el chasis cuando coincide con el nombre de Sarna', () => {
    expect(getMechDisplayName(getMech('AS7-D'))).toBe('Atlas');
  });
});

describe('matchesMechQuery', () => {
  const adder = getMech('ADR-A');

  it('acepta cualquier mech con una búsqueda vacía', () => {
    expect(matchesMechQuery(adder, '')).toBe(true);
    expect(matchesMechQuery(adder, '   ')).toBe(true);
  });

  it('busca por chasis, nombre de Sarna, variante e ID sin distinguir mayúsculas', () => {
    expect(matchesMechQuery(adder, 'puma')).toBe(true);
    expect(matchesMechQuery(adder, 'ADDER')).toBe(true);
    expect(matchesMechQuery(adder, 'adr-a')).toBe(true);
    expect(matchesMechQuery(adder, ' adr ')).toBe(true);
  });

  it('busca también por los alias de Sarna', () => {
    const loaderKing = allMechs.find(mech => mech.sarnaName === 'Loaderking');
    expect(loaderKing).toBeDefined();
    expect(matchesMechQuery(loaderKing!, 'loader king')).toBe(true);
  });

  it('descarta los mechs que no coinciden', () => {
    expect(matchesMechQuery(adder, 'atlas')).toBe(false);
  });
});

describe('filtros del selector de chasis', () => {
  const archer = getMech('ARC-2R');
  const adder = getMech('ADR-PRIME');
  const catapult = getMech('CPLT-C3');

  it('cuenta los anclajes por tipo sin el cuerpo a cuerpo', () => {
    expect(getHardpointCounts(archer)).toMatchObject({ energy: 4, missile: 2, ballistic: 0, omni: 0 });
    expect(getHardpointCounts(adder)).toMatchObject({ energy: 1, omni: 2 });
    expect(getHardpointCounts(catapult).artillery).toBe(1);
  });

  it('filtra por clase, tecnología y jump jets', () => {
    expect(matchesMechFilters(archer, { ...EMPTY_MECH_FILTERS, weightClasses: ['heavy'] })).toBe(true);
    expect(matchesMechFilters(archer, { ...EMPTY_MECH_FILTERS, weightClasses: ['light', 'medium'] })).toBe(false);
    expect(matchesMechFilters(adder, { ...EMPTY_MECH_FILTERS, techBase: 'Clan' })).toBe(true);
    expect(matchesMechFilters(archer, { ...EMPTY_MECH_FILTERS, techBase: 'Clan' })).toBe(false);
    expect(allMechs.filter(hasJumpJets).length).toBeGreaterThan(0);
    expect(allMechs.filter(mech => !hasJumpJets(mech)).every(mech => !matchesMechFilters(mech, { ...EMPTY_MECH_FILTERS, jumpJets: true }))).toBe(true);
  });

  it('filtra por ranura de ECM', () => {
    expect(hasEcm(getMech('ARC-T'))).toBe(true);
    expect(hasEcm(archer)).toBe(false);
    expect(matchesMechFilters(archer, { ...EMPTY_MECH_FILTERS, ecm: true })).toBe(false);
    expect(allMechs.filter(hasEcm)).toHaveLength(37);
  });

  it('filtra por año de la campaña, que empieza en 3015', () => {
    const atlas = getMech('AS7-D');
    const novaCat = getMech('NCT-PRIME');
    expect(getAvailableYear(atlas)).toBe(3015);
    expect(getAvailableYear(novaCat)).toBe(3059);
    expect(matchesMechFilters(atlas, { ...EMPTY_MECH_FILTERS, maxYear: 3015 })).toBe(true);
    expect(matchesMechFilters(novaCat, { ...EMPTY_MECH_FILTERS, maxYear: 3050 })).toBe(false);
    expect(matchesMechFilters(novaCat, { ...EMPTY_MECH_FILTERS, maxYear: 3059 })).toBe(true);
  });

  it('los Clan no están disponibles hasta la invasión, aunque su fecha sea anterior', () => {
    const timberWolf = getMech('TBR-PRIME');
    expect(timberWolf.introYear).toBe(2935);
    expect(getAvailableYear(timberWolf)).toBe(3050);
    expect(matchesMechFilters(timberWolf, { ...EMPTY_MECH_FILTERS, maxYear: 3049 })).toBe(false);
  });

  it('usa los anclajes omni como comodín, contando cada uno una sola vez', () => {
    const minimums = (minHardpoints: MechFilters['minHardpoints']) => ({ ...EMPTY_MECH_FILTERS, minHardpoints });
    expect(matchesMechFilters(adder, minimums({ energy: 3 }))).toBe(true);
    expect(matchesMechFilters(adder, minimums({ energy: 2, missile: 1 }))).toBe(true);
    expect(matchesMechFilters(adder, minimums({ energy: 2, missile: 2 }))).toBe(false);
    expect(matchesMechFilters(adder, minimums({ omni: 2, energy: 2 }))).toBe(false);
    expect(matchesMechFilters(adder, minimums({ ams: 1 }))).toBe(false);
  });

  it('entiende los atajos del buscador', () => {
    expect(parseMechQuery('archer 3e 2M jj ECM')).toEqual({ text: 'archer', filters: { jumpJets: true, ecm: true, minHardpoints: { energy: 3, missile: 2 } } });
    expect(parseMechQuery('1art')).toEqual({ text: '', filters: { jumpJets: false, ecm: false, minHardpoints: { artillery: 1 } } });
  });
});

describe('especificaciones del chasis', () => {
  it('se muestran como en la cabecera del mechlab del juego', () => {
    const label = (id: string) => getMechSpecs(getMech(id)).map(spec => spec.label).join(' ');
    expect(label('HBR-A')).toBe('325 C-XL DHS C-ENDO C-FERRO AP');
    expect(label('BNC-LM')).toBe('380 XL DHS ENDO');
    expect(label('CRD-2R')).toBe('260 STD DHS ENDO');
    expect(label('HGN-732')).toBe('270 STD FERRO');
    expect(label('WHM-6D')).toBe('280 STD');
    expect(label('ASN-26')).toBe('280 XL DHS ENDO');
  });

  it('agrupan los anclajes por tipo y tamaño', () => {
    expect(getHardpointGroups(getMech('HBR-A')).map(group => `${group.count}${group.type[0]}${group.sizeLetter}`))
      .toEqual(['2eL', '1eM', '2bS', '2mL', '1oL']);
  });
});
