import { describe, expect, it } from 'vitest';
import { encodeBuild, getStockBuildById } from './buildCode';
import { MERCS_BUILD_LIST, summarizeSavedBuild } from './savedBuildRows';
import { allItems, allMechs } from '../test/fixtures';

// CA3 y CA4 de docs/specs/comparar-builds-guardadas.md.
const saved = (code: string) => ({ id: 'hunch', name: 'Hunch', code, savedAt: '2026-11-21T10:00:00.000Z' });

describe('resumen de una build guardada de MW5', () => {
  it('CA3: la build de serie del HBK-4G', () => {
    const stock = getStockBuildById('HBK-4G', allMechs, allItems)!;
    const code = encodeBuild(stock.mech, stock.loadout, stock.armor, allItems, stock.upgrades);
    const entry = summarizeSavedBuild(saved(code), allMechs, allItems);

    expect(entry.listRow).toMatchObject({ id: 'hunch', name: 'Hunch', chassis: 'Hunchback', variant: 'HBK-4G', weightClass: 'medium' });
    expect(entry.listRow.weapons).toEqual({ energy: 3, ballistic: 1 });
    expect(entry.listRow.features).toEqual([]);
    expect(entry.meta).toBe(`Hunchback HBK-4G · ${entry.summary!.totalWeight.toFixed(1)} / 50 t · ${entry.summary!.firepower} volley`);
  });

  it('CA4: una build que ya no se puede leer', () => {
    const entry = summarizeSavedBuild(saved('no-es-un-codigo'), allMechs, allItems);

    expect(entry.shared).toBeNull();
    expect(entry.listRow).toMatchObject({ chassis: null, variant: null, tonnage: null, firepower: null, hardpoints: null, weapons: null });
    expect(entry.meta).toBe('This build can no longer be opened');
  });
});

// CA5 y CA6 de docs/specs/filtro-motive.md.
describe('equipo de las builds de MW5 para los filtros de My builds', () => {
  const featuresOf = (id: string) => {
    const stock = getStockBuildById(id, allMechs, allItems)!;
    const code = encodeBuild(stock.mech, stock.loadout, stock.armor, allItems, stock.upgrades);
    return summarizeSavedBuild(saved(code), allMechs, allItems).listRow.features;
  };

  it('CA5: Motive si lleva MASC o Supercharger; Active probe si lleva una sonda montada', () => {
    expect(featuresOf('CTF-3L')).toContain('motive');
    expect(featuresOf('BNC-3P')).toContain('motive');
    expect(featuresOf('RVN-3L')).toContain('probe');
    expect(featuresOf('ACH-C')).toContain('probe');
    expect(featuresOf('ADR-A')).not.toContain('probe');
    expect(featuresOf('HBK-4G')).not.toContain('probe');
    expect(featuresOf('HBK-4G')).not.toContain('motive');
  });

  it('CA6: los botones de equipo de My builds', () => {
    expect(MERCS_BUILD_LIST.featureOptions.map(option => option.label)).toEqual(['Jump jets', 'ECM', 'AMS', 'Active probe', 'Motive', 'Hero']);
  });
});
