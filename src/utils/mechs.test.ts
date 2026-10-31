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
  countActiveFilters,
  describeContentSources,
  getContentSource,
  matchesMechFilters,
  matchesMechQuery,
  mergeMechFilters,
  parseMechQuery,
  parseStoredContentSources,
  type MechFilters
} from './mechs';
import { allMechs, getMech } from '../test/fixtures';

describe('getMechDisplayName', () => {
  it('añade el nombre de Sarna cuando es distinto del chasis', () => {
    expect(getMechDisplayName(getMech('ADR-A'))).toBe('Puma (Adder)');
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
    expect(parseMechQuery('archer 3e 2M jj ECM')).toEqual({ text: 'archer', filters: { jumpJets: true, ecm: true, hero: false, dlcs: [], minHardpoints: { energy: 3, missile: 2 } } });
    expect(parseMechQuery('1art')).toEqual({ text: '', filters: { jumpJets: false, ecm: false, hero: false, dlcs: [], minHardpoints: { artillery: 1 } } });
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

  it('marcan como XL los motores que ocupan ranuras en los torsos laterales', () => {
    // El archivo del KGC-A no trae bXLEngine, pero su motor ocupa tres ranuras en cada torso lateral
    // y pesa como el del KGC-001: en el juego es un 340 XL.
    expect(getMech('KGC-A').engine?.xl).toBe(true);
    expect(getMech('KGC-000').engine?.xl).toBe(false);
  });

  it('agrupan los anclajes por tipo y tamaño', () => {
    expect(getHardpointGroups(getMech('HBR-A')).map(group => `${group.count}${group.type[0]}${group.sizeLetter}`))
      .toEqual(['2eL', '1eM', '2bS', '2mL', '1oL']);
  });
});

// Criterios de aceptación de docs/specs/filtros-dlc-hero.md (issue #43).
describe('filtros por DLC y por hero', () => {
  const filtered = (filters: Partial<MechFilters>) => allMechs.filter(mech => matchesMechFilters(mech, { ...EMPTY_MECH_FILTERS, ...filters }));

  it('CA1: cada variante guarda su DLC, y las del juego base no llevan', () => {
    expect(getMech('ADR-A').dlc).toBe(7);
    expect(getMech('ACW-A').dlc).toBe(9);
    expect(getMech('AS7-D').dlc).toBeUndefined();
    expect(getContentSource(getMech('AS7-D'))).toBe(0);
    expect(getContentSource(getMech('ADR-A'))).toBe(7);
  });

  it('CA2: 109 variantes hero y 414 de algún DLC', () => {
    expect(allMechs.filter(mech => mech.hero)).toHaveLength(109);
    expect(allMechs.filter(mech => mech.dlc !== undefined)).toHaveLength(414);
  });

  it('CA3: el filtro Hero deja exactamente las variantes hero', () => {
    const heroes = filtered({ hero: true });
    expect(heroes).toHaveLength(109);
    expect(heroes.every(mech => mech.hero)).toBe(true);
  });

  it('CA4: el filtro de DLC deja solo las fuentes marcadas', () => {
    const result = filtered({ dlcs: [0, 7] });
    expect(result.length).toBe(225 + 112);
    expect(result.every(mech => [0, 7].includes(getContentSource(mech)))).toBe(true);
  });

  it('CA5: sin fuentes marcadas no se descarta nada por el DLC', () => {
    expect(filtered({ dlcs: [] })).toHaveLength(allMechs.length);
  });

  it('CA6: el buscador entiende hero y dlc7, y no los busca como texto', () => {
    const parsed = parseMechQuery('hero dlc7');
    expect(parsed.text).toBe('');
    expect(parsed.filters.hero).toBe(true);
    expect(parsed.filters.dlcs).toEqual([7]);
  });

  it('CA7: el buscador entiende base como la fuente del juego base', () => {
    expect(parseMechQuery('atlas base').filters.dlcs).toEqual([0]);
    expect(parseMechQuery('atlas base').text).toBe('atlas');
  });

  it('CA8: los filtros del panel y los del buscador se combinan', () => {
    const combined = mergeMechFilters({ ...EMPTY_MECH_FILTERS, dlcs: [1] }, parseMechQuery('hero dlc7').filters);
    expect(combined.hero).toBe(true);
    expect([...combined.dlcs].sort()).toEqual([1, 7]);
  });

  it('CA9: Hero y el filtro de DLC cuentan como un filtro cada uno', () => {
    expect(countActiveFilters({ ...EMPTY_MECH_FILTERS, hero: true, dlcs: [0, 7] })).toBe(2);
  });

  it('RF3: el botón del desplegable resume las fuentes marcadas', () => {
    expect(describeContentSources([])).toBe('All');
    expect(describeContentSources([7, 0])).toBe('Base, DLC 7');
    expect(describeContentSources([1, 2, 9])).toBe('3 selected');
  });

  it('CA11: el filtro de rol deja las variantes de los roles marcados', () => {
    const result = filtered({ roles: ['Sniper', 'Scout'] });
    expect(result).toHaveLength(163);
    expect(result.every(mech => mech.role === 'Sniper' || mech.role === 'Scout')).toBe(true);
  });

  it('CA12: sin roles marcados no se descarta nada por el rol', () => {
    expect(EMPTY_MECH_FILTERS.roles).toEqual([]);
    expect(filtered({ roles: [] })).toHaveLength(allMechs.length);
  });

  it('CA13: varios roles cuentan como un solo filtro', () => {
    expect(countActiveFilters({ ...EMPTY_MECH_FILTERS, roles: ['Sniper', 'Brawler'] })).toBe(1);
  });

  it('CA14: la selección de DLC guardada se recupera validada', () => {
    expect(parseStoredContentSources('[0,7]')).toEqual([0, 7]);
    expect(parseStoredContentSources('[7,7,12,-1,"3",2.5]')).toEqual([7]);
    expect(parseStoredContentSources('no es json')).toEqual([]);
    expect(parseStoredContentSources('{"dlc":7}')).toEqual([]);
    expect(parseStoredContentSources(null)).toEqual([]);
  });

  it('CA10: el estado vacío no tiene Hero ni fuentes de DLC', () => {
    expect(EMPTY_MECH_FILTERS.hero).toBe(false);
    expect(EMPTY_MECH_FILTERS.dlcs).toEqual([]);
    expect(countActiveFilters(EMPTY_MECH_FILTERS)).toBe(0);
  });
});
