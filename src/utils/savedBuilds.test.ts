import { describe, expect, it } from 'vitest';
import { encodeBuild } from './buildCode';
import { createDefaultArmor } from './calculators';
import { createEquippedItem } from './equipment';
import { createExportFile, EXPORT_FORMAT, mergeBuilds, normalizeBuildName, parseImportFile, parseStoredBuilds, type SavedBuild } from './savedBuilds';
import { createEmptyLoadout } from './zones';
import { allItems, allMechs, getItem, getMech } from '../test/fixtures';

const archer = getMech('ARC-2R');
const code = encodeBuild(
  archer,
  { ...createEmptyLoadout(), leftTorso: [createEquippedItem(getItem('LRM15'), undefined, 0)] },
  createDefaultArmor(archer.components),
  allItems
);
const saved = (id: string, name: string, buildCode = code): SavedBuild => ({ id, name, code: buildCode, savedAt: '2026-10-22T10:00:00.000Z' });
let nextId = 0;
const createId = () => `new-${++nextId}`;

describe('builds guardadas en el navegador', () => {
  it('ignora lo guardado que esté dañado o incompleto', () => {
    expect(parseStoredBuilds(null)).toEqual([]);
    expect(parseStoredBuilds('{no es json')).toEqual([]);
    expect(parseStoredBuilds(JSON.stringify([saved('a', 'Archer LRM'), { id: 'b', name: 'Sin código' }, 'basura'])))
      .toEqual([saved('a', 'Archer LRM')]);
  });

  it('limpia los nombres y usa uno por defecto si queda vacío', () => {
    expect(normalizeBuildName('  Archer   LRM  ', 'Archer ARC-2R')).toBe('Archer LRM');
    expect(normalizeBuildName('   ', 'Archer ARC-2R')).toBe('Archer ARC-2R');
  });
});

describe('exportar e importar', () => {
  it('importa lo exportado y descarta las builds que no se pueden abrir', () => {
    const file = JSON.parse(createExportFile([saved('a', 'Archer LRM')]));
    expect(file).toMatchObject({ format: EXPORT_FORMAT, game: 'mercs', builds: [{ name: 'Archer LRM', code }] });
    expect(file.builds[0]).not.toHaveProperty('id');

    file.builds.push({ name: 'Rota', code: 'no-es-una-build' });
    const result = parseImportFile(JSON.stringify(file), allMechs, allItems);
    expect(result?.entries.map(entry => entry.name)).toEqual(['Archer LRM']);
    expect(result?.invalid).toBe(1);
  });

  it('rechaza archivos que no son una exportación de builds', () => {
    expect(parseImportFile('hola', allMechs, allItems)).toBeNull();
    expect(parseImportFile(JSON.stringify({ builds: [] }), allMechs, allItems)).toBeNull();
    expect(parseImportFile(JSON.stringify({ format: EXPORT_FORMAT, game: 'clans', builds: [] }), allMechs, allItems)).toBeNull();
  });

  it('añade las importadas al principio sin duplicar las que ya están guardadas', () => {
    const existing = [saved('a', 'Archer LRM')];
    const entries = [
      { name: 'Archer LRM', code, savedAt: '2026-10-22T10:00:00.000Z' },
      { name: 'Archer copia', code, savedAt: '2026-10-22T11:00:00.000Z' },
      { name: 'Archer copia', code, savedAt: '2026-10-22T11:00:00.000Z' }
    ];
    const result = mergeBuilds(existing, entries, createId);

    expect(result.builds.map(build => build.name)).toEqual(['Archer copia', 'Archer LRM']);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(2);
  });
});
