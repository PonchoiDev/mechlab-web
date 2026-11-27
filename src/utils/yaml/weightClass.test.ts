import { describe, expect, it } from 'vitest';
import { getBuildIssues } from './board';
import { createStockBuild, mountItem, stripBuild } from './build';
import { findYamlMech, getYamlItem, yamlItemIds } from './data';
import { filterYamlInventory, getYamlInternalChoices, getYamlInventoryItems, placeYamlItem } from './inventory';
import { getYamlEquipmentClass, getYamlWeightClassProblem } from './weightClass';

// Piezas por clase de peso en el MechLab de YAML (docs/specs/clase-de-peso-yaml.md).
const mechOf = (id: string) => findYamlMech(id)!;
const emptyOf = (id: string) => stripBuild(createStockBuild(mechOf(id)));
const firestarter = mechOf('FS9-S1');
const griffin = mechOf('GRF-2N');
const atlas = mechOf('AS7-P');
const corsair = mechOf('COR-ROAM');
const marauder = mechOf('MAD-BARA2');

describe('piezas por clase de peso en el MechLab de YAML', () => {
  it('CA1: la clase de cada tonelaje, como DLCGetMechEquipmentClass', () => {
    const tonnages = [20, 25, 30, 45, 50, 65, 70, 85, 90, 100, 115, 125];
    expect(tonnages.map(getYamlEquipmentClass)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    expect(getYamlEquipmentClass(27)).toBeNull();
  });

  it('CA2: el MASC MK III va en 55 t y no en 35 t, con su motivo', () => {
    for (const id of ['MASC_MKIII', 'C79_MASC_MKIII']) {
      expect(getYamlWeightClassProblem(griffin, id)).toBeNull();
      expect(getYamlWeightClassProblem(firestarter, id)).toMatch(/class 3/);
      expect(mountItem(firestarter, emptyOf('FS9-S1'), 'centerTorso', id).error).toMatch(/class 3/);
    }
    expect(mountItem(griffin, emptyOf('GRF-2N'), 'centerTorso', 'MASC_MKIII').build).toBeDefined();
  });

  it('CA3: los supercargadores de arena, también por clase', () => {
    expect(getYamlWeightClassProblem(firestarter, 'SUPERCHARGER_Arena_MKII')).toBeNull();
    expect(getYamlWeightClassProblem(griffin, 'SUPERCHARGER_Arena_MKII')).not.toBeNull();
  });

  it('CA4: un superpesado no lleva ningún MASC ni supercargador', () => {
    const motive = yamlItemIds().filter(id => /MASC|SuperCharger/i.test(getYamlItem(id)!.category ?? '') && !/Filler/.test(getYamlItem(id)!.category ?? ''));
    expect(motive.length).toBeGreaterThan(20);
    expect(motive.filter(id => !getYamlWeightClassProblem(marauder, id))).toEqual([]);
  });

  it('CA5: las piezas «SH» solo en superpesados; el Jump Jets-I Class I hasta 100 t', () => {
    for (const mech of [corsair, marauder]) expect(getYamlWeightClassProblem(mech, 'SH_COOLING_JACKET')).toBeNull();
    expect(getYamlWeightClassProblem(atlas, 'SH_COOLING_JACKET')).toMatch(/105 t or more/);
    expect(getYamlWeightClassProblem(atlas, 'ImprovedJumpJet_Class1_Equipment')).toBeNull();
    expect(getYamlWeightClassProblem(corsair, 'ImprovedJumpJet_Class1_Equipment')).toMatch(/100 t or less/);
  });

  it('CA6: el núcleo 440 solo desde 80 t, también desde la ranura', () => {
    const heavy = mechOf('MAD-2R');
    const assault = mechOf('CGR-1A1');
    const core = (mech: typeof heavy, id: string) => getYamlInternalChoices(mech, emptyOf(id), 'Engine').find(choice => choice.id === 'std440');
    expect(core(heavy, 'MAD-2R')?.error).toMatch(/80 t or more/);
    expect(placeYamlItem(heavy, emptyOf('MAD-2R'), 'std440', 'centerTorso').error).toMatch(/80 t or more/);
    expect(core(assault, 'CGR-1A1')?.error ?? '').not.toMatch(/80 t or more/);
  });

  it('CA7: el inventario no enseña lo que el \'Mech no puede llevar', () => {
    const shown = filterYamlInventory(getYamlInventoryItems(), { filter: null, search: '', fitsOnly: false }, firestarter, emptyOf('FS9-S1'), null)
      .map(entry => entry.id);
    expect(shown).not.toContain('MASC_MKIII');
    expect(shown).toContain('MASC_MKII');
  });

  it('CA8: una build que ya lleva una pieza de otra clase avisa', () => {
    const build = emptyOf('FS9-S1');
    const loaded = { ...build, items: [...build.items, { zone: 'centerTorso' as const, slotType: 'General_SlotType', item: 'MASC_MKIII' }] };
    const issue = getBuildIssues(firestarter, loaded).find(entry => entry.id === 'weight-class-MASC_MKIII');
    expect(issue?.message).toMatch(/MASC MK III/);
    expect(getBuildIssues(firestarter, build).some(entry => entry.id.startsWith('weight-class'))).toBe(false);
  });
});
