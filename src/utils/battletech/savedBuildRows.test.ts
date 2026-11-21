import { describe, expect, it } from 'vitest';
import { encodeBtBuild } from './buildCode';
import { createStockBuild } from './fitting';
import { findMech } from './mechlabData';
import { summarizeBtSavedBuild } from './savedBuildRows';

// CA5 y CA6 de docs/specs/comparar-builds-guardadas.md.
const saved = (code: string) => ({ id: 'hunch', name: 'Hunch', code, savedAt: '2026-11-21T10:00:00.000Z' });

describe('resumen de una build guardada de BATTLETECH', () => {
  it('CA5: la build de serie del HBK-4G', () => {
    const entry = summarizeBtSavedBuild(saved(encodeBtBuild(createStockBuild(findMech('HBK-4G')!))));

    expect(entry.listRow).toMatchObject({ id: 'hunch', name: 'Hunch', chassis: 'Hunchback', variant: 'HBK-4G', weightClass: 'medium' });
    expect(entry.listRow.weapons).toEqual({ energy: 2, ballistic: 1, support: 1 });
    expect(entry.meta).toBe(`Hunchback HBK-4G · ${entry.summary!.tonnage} / 50 t · ${entry.summary!.alphaDamage} alpha`);
  });

  it('CA6: una build que ya no se puede leer', () => {
    const entry = summarizeBtSavedBuild(saved('no-es-un-codigo'));

    expect(entry.decoded).toBeNull();
    expect(entry.listRow).toMatchObject({ chassis: null, variant: null, tonnage: null, firepower: null, hardpoints: null, weapons: null });
    expect(entry.meta).toBe('This build can no longer be opened');
  });
});
