import { describe, expect, it } from 'vitest';
import mw5Mechs from '../../data/mechs.json';
import { filterOptionsByText } from '../format';
import { findYamlMech, yamlMechs } from './data';
import {
  EMPTY_YAML_FILTERS, filterYamlMechs, getYamlAvailableYear, getYamlHardpointCounts, getYamlQuirkOptions, isClanMech, isOmniMech,
  type YamlMechFilters
} from './mechList';

// Filtros del selector de 'Mechs del MechLab de YAML (docs/specs/filtros-yaml.md).
const withFilters = (filters: Partial<YamlMechFilters>, query = '') => filterYamlMechs(yamlMechs, query, { ...EMPTY_YAML_FILTERS, ...filters });
const ids = (mechs: { id: string }[]) => mechs.map(mech => mech.id).sort();

describe('filtros del selector de YAML', () => {
  it('CA1: año, rol, hero y variantes nuevas salen de las unit cards de YAML o del MechLab de MW5', () => {
    expect(findYamlMech('WHM-DNC')).toMatchObject({ introYear: 2599, role: 'Brawler', hero: true });
    expect(findYamlMech('WHM-DNC')!.yamlOnly).toBeUndefined();
    const annihilator = findYamlMech('ANH-1G')!;
    expect(annihilator.yamlOnly).toBe(true);
    expect(annihilator.introYear).toBeGreaterThan(0);
    expect(annihilator.role).toBeTruthy();
    const atlas = mw5Mechs.find(mech => mech.id === 'AS7-D')!;
    expect(findYamlMech('AS7-D')).toMatchObject({ introYear: atlas.introYear, role: atlas.role });
  });

  it('CA2: Superheavy deja las 3 variantes superpesadas', () => {
    expect(ids(withFilters({ superheavy: true }))).toEqual(['COR-ROAM', 'MAD-BARA2', 'MAD-TF']);
  });

  it('CA3: Clan y Omni salen de los quirks CLAN-MECH y OMNI-MECH', () => {
    const clan = withFilters({ techBase: 'Clan' });
    expect(clan.length).toBeGreaterThan(0);
    expect(clan.every(mech => mech.quirks.includes('CLAN-MECH') && isClanMech(mech))).toBe(true);
    const omni = withFilters({ omni: true });
    expect(omni.length).toBeGreaterThan(0);
    expect(omni.every(mech => mech.quirks.includes('OMNI-MECH') && isOmniMech(mech))).toBe(true);
    expect(withFilters({ techBase: 'InnerSphere' }).some(mech => mech.quirks.includes('CLAN-MECH'))).toBe(false);
  });

  it('CA4: anclajes mínimos, con cuerpo a cuerpo y los omni como comodín', () => {
    const melee = withFilters({ minHardpoints: { melee: 2 } });
    expect(melee.length).toBeGreaterThan(0);
    expect(melee.every(mech => getYamlHardpointCounts(mech).melee >= 2)).toBe(true);
    const omniOnly = yamlMechs.find(mech => getYamlHardpointCounts(mech).omni >= 1 && getYamlHardpointCounts(mech).energy === 0)!;
    expect(ids(withFilters({ minHardpoints: { energy: 1 } }))).toContain(omniOnly.id);
  });

  it('CA5: los atajos del buscador filtran como los botones', () => {
    const typed = withFilters({}, '3e 2mel sh');
    const clicked = withFilters({ minHardpoints: { energy: 3, melee: 2 }, superheavy: true });
    expect(ids(typed)).toEqual(ids(clicked));
    expect(ids(withFilters({}, 'clan omni yaml hero 1ams dlc7'))).toEqual(ids(withFilters({
      techBase: 'Clan', omni: true, yamlOnly: true, hero: true, minHardpoints: { ams: 1 }, dlcs: [7]
    })));
    expect(withFilters({}, 'atlas 2b').every(mech => mech.chassis.toLowerCase().includes('atlas'))).toBe(true);
  });

  it('CA6: el buscador encuentra los quirks por su id y por su nombre', () => {
    const byId = withFilters({}, 'sldf');
    expect(byId.length).toBeGreaterThan(0);
    expect(byId.every(mech => mech.quirks.includes('SLDF'))).toBe(true);
    expect(ids(withFilters({}, 'star league'))).toEqual(ids(byId));
  });

  it('CA7: con varios quirks marcados, las variantes que tienen todos', () => {
    const both = withFilters({ quirks: ['SLDF', 'CMD-MECH'] });
    expect(ids(both)).toContain('NSR-9J');
    expect(both.every(mech => mech.quirks.includes('SLDF') && mech.quirks.includes('CMD-MECH'))).toBe(true);
  });

  it('CA8: Available by 3025 quita los Clan y los posteriores', () => {
    const early = withFilters({ maxYear: 3025 });
    expect(early.length).toBeGreaterThan(0);
    expect(early.some(isClanMech)).toBe(false);
    expect(early.every(mech => getYamlAvailableYear(mech) <= 3025)).toBe(true);
  });

  it('CA9: YAML only deja las 151 variantes nuevas', () => {
    expect(withFilters({ yamlOnly: true })).toHaveLength(151);
  });

  it('CA10: el buscador del desplegable de quirks, sin mayúsculas ni acentos', () => {
    const options = getYamlQuirkOptions(yamlMechs);
    const armor = filterOptionsByText(options, 'armor');
    expect(armor.length).toBeGreaterThan(0);
    expect(armor.length).toBeLessThan(options.length);
    expect(armor.every(option => option.label.toLowerCase().includes('armor'))).toBe(true);
    expect(filterOptionsByText(options, 'ÁRMOR')).toEqual(armor);
    expect(filterOptionsByText(options, '  ')).toEqual(options);
  });
});
