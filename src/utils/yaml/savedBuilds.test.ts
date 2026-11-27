import { describe, expect, it } from 'vitest';
import { allItems, allMechs } from '../../test/fixtures';
import { parseBtImportFile } from '../battletech/savedBuilds';
import { parseImportFile } from '../savedBuilds';
import { filterBuildRows } from '../savedBuildsList';
import type { SavedBuild } from '../savedBuildsCore';
import { createStockBuild, mountItem, stripBuild } from './build';
import { encodeYamlBuild } from './buildCode';
import { findYamlMech, yamlMechs } from './data';
import { getYamlHardpointCounts } from './mechList';
import { summarizeYamlSavedBuild, YAML_BUILD_LIST } from './savedBuildRows';
import { createYamlExportFile, parseYamlImportFile } from './savedBuilds';

// Builds guardadas del MechLab de YAML (docs/specs/builds-guardadas-yaml.md).
const nightstar = findYamlMech('NSR-9J')!;
const saved = (code: string, name = 'Test'): SavedBuild => ({ id: name, name, code, savedAt: '2026-11-26T10:00:00.000Z' });
const stockOf = (id: string) => {
  const mech = findYamlMech(id)!;
  return saved(encodeYamlBuild(mech.id, createStockBuild(mech)), id);
};

describe('exportar e importar', () => {
  it('CA1: el archivo es de builds de YAML y se vuelve a importar entero', () => {
    const builds = [stockOf('NSR-9J'), stockOf('WHM-DNC')];
    const file = createYamlExportFile(builds);
    expect(JSON.parse(file)).toMatchObject({ format: 'mw-builder-builds', game: 'mw5-yaml' });
    const result = parseYamlImportFile(file)!;
    expect(result.invalid).toBe(0);
    expect(result.entries.map(entry => entry.code)).toEqual(builds.map(build => build.code));
  });

  it('CA2: no se mezclan con los archivos de MW5 ni de BATTLETECH', () => {
    const builds = [{ name: 'X', code: stockOf('NSR-9J').code, savedAt: '2026-11-26T10:00:00.000Z' }];
    for (const game of ['mercs', undefined, 'battletech']) {
      expect(parseYamlImportFile(JSON.stringify({ format: 'mw-builder-builds', version: 1, game, builds }))).toBeNull();
    }
    const yamlFile = createYamlExportFile([stockOf('NSR-9J')]);
    expect(parseImportFile(yamlFile, allMechs, allItems)).toBeNull();
    expect(parseBtImportFile(yamlFile)).toBeNull();
  });

  it('CA3: una build de código roto cuenta como no válida', () => {
    const file = createYamlExportFile([stockOf('NSR-9J'), saved('yaml-roto', 'Broken')]);
    const result = parseYamlImportFile(file)!;
    expect(result.entries).toHaveLength(1);
    expect(result.invalid).toBe(1);
  });
});

describe('resumen para la lista', () => {
  it('CA4: el NSR-9J de serie', () => {
    const { listRow, weaponCounts } = summarizeYamlSavedBuild(stockOf('NSR-9J'));
    expect(listRow).toMatchObject({
      chassis: 'Nightstar', variant: 'NSR-9J', weightClass: 'assault', techBase: 'InnerSphere', roles: ['Juggernaut'], firepower: 55
    });
    expect(listRow.tonnage).toBeCloseTo(95, 0);
    expect(listRow.hardpoints).toEqual(getYamlHardpointCounts(nightstar));
    expect(listRow.hardpoints!.melee).toBeGreaterThan(0);
    expect(weaponCounts).toEqual([{ type: 'energy', count: 4 }, { type: 'ballistic', count: 2 }]);
  });

  it('CA5: el equipo montado y las mejoras de la cantina', () => {
    let build = stripBuild(createStockBuild(nightstar));
    for (const [zone, item] of [['leftTorso', 'JumpJet_Class3_Equipment'], ['leftTorso', 'JumpJet_Class3_Equipment'], ['rightTorso', 'GuardianECM'], ['leftTorso', 'MASC_MKV']] as const) {
      build = mountItem(nightstar, build, zone, item).build!;
    }
    build = { ...build, traits: ['ReducedHeatGeneration_Trait1'] };
    const { listRow, tags } = summarizeYamlSavedBuild(saved(encodeYamlBuild(nightstar.id, build)));
    expect(listRow.features).toEqual(expect.arrayContaining(['jumpJets', 'ecm', 'motive', 'upgrades']));
    expect(listRow.features).not.toContain('probe');
    expect(tags.map(tag => tag.label)).toEqual(expect.arrayContaining(['JJ 2', 'ECM', 'MASC']));
  });

  it('CA6: Clan omni y superpesado, sin rasgo de variante nueva de YAML', () => {
    const omni = yamlMechs.find(mech => mech.quirks.includes('OMNI-MECH') && mech.quirks.includes('CLAN-MECH'))!;
    expect(summarizeYamlSavedBuild(stockOf(omni.id)).listRow).toMatchObject({ techBase: 'Clan' });
    expect(summarizeYamlSavedBuild(stockOf(omni.id)).listRow.features).toContain('omni');
    expect(summarizeYamlSavedBuild(stockOf('MAD-BARA2')).listRow.features).toContain('superheavy');
    // Sin filtro de variantes nuevas (docs/specs/filtros-builds-ordenados.md, CA3).
    expect(summarizeYamlSavedBuild(stockOf('ANH-1G')).listRow.features).not.toContain('yamlOnly');
    expect(YAML_BUILD_LIST.featureOptions.map(option => option.id)).not.toContain('yamlOnly');
  });

  // El daño alfa sale de multiplicadores en coma flotante (el AS7-D de serie daba 78.4000015258789): la lista lo
  // redondea como el panel de estadísticas.
  it('el daño alfa de la lista va redondeado como en el panel', () => {
    expect(summarizeYamlSavedBuild(stockOf('AS7-D')).meta).toMatch(/ · 78\.4 alpha$/);
  });

  it('CA7: un código que ya no se puede abrir', () => {
    const entry = summarizeYamlSavedBuild(saved('yaml-roto'));
    expect(entry.decoded).toBeNull();
    expect(entry.listRow).toMatchObject({ chassis: null, hardpoints: null, weapons: null, tonnage: null });
    expect(entry.meta).toMatch(/can no longer be opened/);
  });

  it('CA8: los filtros comunes, con los datos de YAML', () => {
    const rows = ['NSR-9J', 'MAD-BARA2', 'ANH-1G', yamlMechs.find(mech => mech.quirks.includes('CLAN-MECH'))!.id]
      .map(id => summarizeYamlSavedBuild(stockOf(id)).listRow);
    expect(filterBuildRows(rows, { query: '', weightClasses: [], features: ['superheavy'] }).map(row => row.variant)).toEqual(['MAD-BARA2']);
    expect(filterBuildRows(rows, { query: '', weightClasses: [], techBase: 'Clan' })).toHaveLength(1);
    const melee = filterBuildRows(rows, { query: '', weightClasses: [], minHardpoints: { melee: 1 } });
    expect(melee.every(row => (row.hardpoints?.melee ?? 0) >= 1)).toBe(true);
    expect(filterBuildRows(rows, { query: 'nightstar', weightClasses: [] })).toHaveLength(1);
  });

  it('CA9: el filtro de piezas internas', () => {
    const rows = ['NSR-9J', 'MAD-BARA2'].map(id => summarizeYamlSavedBuild(stockOf(id)).listRow);
    const variants = (parts: Record<string, string[]>) => filterBuildRows(rows, { query: '', weightClasses: [], parts }).map(row => row.variant);
    expect(variants({ engine: ['XL Engine'] })).toEqual(['NSR-9J']);
    expect(variants({ engine: ['XL Engine', 'XL Engine (C)'] })).toEqual(['NSR-9J', 'MAD-BARA2']);
    expect(variants({ engine: ['XL Engine', 'XL Engine (C)'], structure: ['Structure standard'] })).toEqual(['NSR-9J']);
  });
});

// docs/specs/buscar-nombres-clan.md
describe('nombres Clan en Mis builds de YAML', () => {
  it('CA5: el chasis lleva el nombre Clan y se encuentra por él', () => {
    const row = summarizeYamlSavedBuild(stockOf('TBR-PRIME')).listRow;
    expect(row.chassis).toBe('Mad Cat (Timber Wolf)');
    expect(filterBuildRows([row], { query: 'timber wolf', weightClasses: [] })).toHaveLength(1);
  });
});
