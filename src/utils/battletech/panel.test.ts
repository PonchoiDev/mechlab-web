import { describe, expect, it } from 'vitest';
import { replaceItem } from './actions';
import { DEFAULT_MECH_FILTERS, filterBtMechs, parseBtMechQuery } from './filters';
import { createStockBuild, getHardpointCount } from './fitting';
import { BT_MECHS, findMech, getItem } from './mechlabData';

// Lo que el MechLab de BATTLETECH toma del de MW5: los atajos del buscador de 'Mechs y las acciones del tablero
// (cambiar el arma de un anclaje). El inventario tiene sus tests aparte.
const stock = (variant: string) => createStockBuild(findMech(variant)!);

describe('buscador de \'Mechs con los atajos de MW5', () => {
  it('lee los anclajes mínimos y los retrorreactores del texto', () => {
    expect(parseBtMechQuery('hunch 3b jj')).toEqual({ text: 'hunch', minHardpoints: { ballistic: 3 }, minJumpJets: 1 });
    expect(parseBtMechQuery('2E 1s 6jj')).toEqual({ text: '', minHardpoints: { energy: 2, support: 1 }, minJumpJets: 6 });
  });

  it('filtra con ellos, combinados con el panel', () => {
    const found = filterBtMechs(BT_MECHS, { ...DEFAULT_MECH_FILTERS, query: '4m 6jj' });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every(mech => getHardpointCount(mech, 'missile') >= 4 && mech.maxJumpJets >= 6)).toBe(true);
    expect(filterBtMechs(BT_MECHS, { ...DEFAULT_MECH_FILTERS, query: 'hbk 3b' }).map(mech => mech.variant)).toContain('HBK-4G');
  });
});

describe('acciones del MechLab como las de MW5', () => {
  it('cambia el arma de un anclaje por otra de su tipo', () => {
    const { mech, loadout } = stock('HBK-4G');
    const result = replaceItem(mech, loadout, 'leftArm', 0, getItem('Weapon_Laser_LargeLaser_0-STOCK')!);
    expect(result.loadout.leftArm).toEqual(['Weapon_Laser_LargeLaser_0-STOCK']);
    expect(result.message).toBe('M Laser replaced with L Laser');
  });
});
