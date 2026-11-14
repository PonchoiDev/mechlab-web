import { describe, expect, it } from 'vitest';
import { replaceItem } from './actions';
import { groupBtLoadout } from './compare';
import {
  DEFAULT_MECH_FILTERS,
  EMPTY_PANEL_FILTERS,
  filterBtMechs,
  getAmmoForMountedWeapons,
  getEquippableBtItems,
  getReplacementWeapons,
  hasPanelFilters,
  matchesPanelFilters,
  parseBtMechQuery,
  sortBtWeapons
} from './filters';
import { createStockBuild, getHardpointCount } from './fitting';
import { BT_ITEMS, BT_MECHS, findMech, getItem } from './mechlabData';

// Lo que el MechLab de BATTLETECH toma del de MW5: los atajos del buscador de 'Mechs y el panel de cada
// ubicación (armas que caben, cambiar el arma de un anclaje, orden por tamaño y filtros).
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

describe('panel de una ubicación como el de MW5', () => {
  it('solo ofrece lo que cabe ahora en la ubicación', () => {
    const { mech, loadout } = stock('HBK-4G');
    const equippable = getEquippableBtItems(mech, loadout, 'rightTorso', BT_ITEMS);
    expect(equippable.some(item => item.hardpoint === 'energy')).toBe(false);
    expect(equippable.some(item => item.id === 'Weapon_Autocannon_AC2_0-STOCK')).toBe(true);
  });

  it('cambia el arma de un anclaje por otra de su tipo', () => {
    const { mech, loadout } = stock('HBK-4G');
    const replacements = getReplacementWeapons(mech, loadout, 'leftArm', 0, BT_ITEMS);
    expect(replacements.every(item => item.hardpoint === 'energy')).toBe(true);
    expect(replacements.map(item => item.id)).toContain('Weapon_Laser_LargeLaser_0-STOCK');
    expect(replacements.map(item => item.id)).not.toContain('Weapon_Laser_MediumLaser_0-STOCK');
    const result = replaceItem(mech, loadout, 'leftArm', 0, getItem('Weapon_Laser_LargeLaser_0-STOCK')!);
    expect(result.loadout.leftArm).toEqual(['Weapon_Laser_LargeLaser_0-STOCK']);
    expect(result.message).toBe('M Laser replaced with L Laser');
  });

  it('la pestaña Ammo solo ofrece la munición de las armas montadas', () => {
    const { mech, loadout } = stock('HBK-4G');
    expect(getAmmoForMountedWeapons(mech, loadout, BT_ITEMS).map(item => item.id)).toEqual(['Ammo_AmmunitionBox_Generic_AC20']);
  });

  it('ordena las armas por tamaño como Largest y Smallest', () => {
    const weapons = BT_ITEMS.filter(item => item.hardpoint === 'ballistic');
    const largest = sortBtWeapons(weapons, 'large-first');
    expect(largest[0].slots).toBe(Math.max(...weapons.map(item => item.slots)));
    expect(sortBtWeapons(weapons, 'small-first')[0].slots).toBe(Math.min(...weapons.map(item => item.slots)));
  });

  it('filtra por búsqueda, versión, fuente y rareza', () => {
    const magna = getItem('Weapon_Laser_MediumLaser_2-Magna')!;
    expect(hasPanelFilters(EMPTY_PANEL_FILTERS)).toBe(false);
    expect(matchesPanelFilters(magna, { ...EMPTY_PANEL_FILTERS, query: 'magna', plus: [2] })).toBe(true);
    expect(matchesPanelFilters(magna, { ...EMPTY_PANEL_FILTERS, plus: [1] })).toBe(false);
    expect(matchesPanelFilters(magna, { ...EMPTY_PANEL_FILTERS, sources: ['heavymetal'] })).toBe(false);
  });

  it('agrupa el loadout por ubicación para la comparación, con el equipo fijo', () => {
    const marauder = stock('MAD-3R');
    const groups = groupBtLoadout(marauder.mech, marauder.loadout);
    const leftTorso = groups.find(group => group.zone === 'leftTorso')!;
    expect(leftTorso.items.find(line => line.fixed)?.name).toBe('Lance Command Mod');
    const hunchback = stock('HBK-4G');
    expect(groupBtLoadout(hunchback.mech, hunchback.loadout).find(group => group.zone === 'leftLeg')!.items)
      .toEqual([{ name: 'Heat Sink', type: 'equipment', weaponType: undefined, count: 2, fixed: false }]);
  });
});
