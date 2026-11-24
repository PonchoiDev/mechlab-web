import { describe, expect, it } from 'vitest';
import { createStockBuild, stripBuild } from './build';
import { findYamlMech } from './data';
import {
  autoPlaceYamlItem, chooseYamlInternal, countYamlByCategory, filterYamlInventory, getYamlDropZones, getYamlInternalChoices,
  getYamlInventoryItems, isAmmoForMountedWeapon, placeYamlItem, sortYamlInventory
} from './inventory';

// El inventario del MechLab de YAML con el NSR-9J: lo mismo que el de MW5 con las reglas de YAML.
const nightstar = findYamlMech('NSR-9J')!;
const stock = createStockBuild(nightstar);
const empty = stripBuild(stock);
const catalog = getYamlInventoryItems();
const all = { category: 'all' as const, search: '', fitsOnly: false };

describe('inventario del MechLab de YAML', () => {
  it('no lleva niveles de arma, armas de vehículos, rellenos ni piezas internas', () => {
    expect(catalog.some(({ id }) => /_Lvl\d|Vehicle/.test(id))).toBe(false);
    expect(catalog.some(({ id }) => id === 'ENDO' || id === 'std285' || id === 'XLfiller')).toBe(false);
    expect(catalog.some(({ id }) => id === 'GaussRifle')).toBe(true);
    expect(catalog.some(({ id }) => id === 'DoubleHeatSink')).toBe(true);
  });

  it('con «Fits» y una ubicación elegida, solo lo que cabe en ella; las pestañas cuentan con los filtros', () => {
    const target = { zone: 'rightArm' as const, hardpoint: null, internal: null };
    const fits = filterYamlInventory(catalog, { ...all, fitsOnly: true }, nightstar, empty, target);
    expect(fits.some(({ id }) => id === 'GaussRifle')).toBe(true);
    expect(fits.some(({ id }) => id === 'Autocannon20')).toBe(false);
    expect(fits.some(({ id }) => id === 'AntiMissileSystem')).toBe(false);
    const counts = countYamlByCategory(fits);
    expect(counts.all).toBe(fits.length);
    expect(counts.ams).toBe(0);
  });

  it('las ubicaciones donde cabe un objeto, el clic derecho y el cambio del arma de un anclaje', () => {
    expect(getYamlDropZones(nightstar, empty, 'GaussRifle')).toEqual(['leftArm', 'rightArm']);
    expect(autoPlaceYamlItem(nightstar, stock, 'GaussRifle').error).toBeDefined();
    const gauss = stock.weapons.find(weapon => weapon.zone === 'rightArm' && weapon.item === 'GaussRifle')!;
    const swapped = placeYamlItem(nightstar, stock, 'Autocannon2', 'rightArm', gauss.hardpoint).build!;
    expect(swapped.weapons.find(weapon => weapon.hardpoint === gauss.hardpoint)?.item).toBe('Autocannon2');
  });

  it('ordena por nombre, ranuras o peso', () => {
    const sorted = sortYamlInventory(catalog, 'slots', 'desc');
    expect(sorted[0].item.slots).toBeGreaterThanOrEqual(sorted[sorted.length - 1].item.slots);
  });

  it('las piezas internas se cambian desde el inventario, con el motivo de las que no caben', () => {
    const structures = getYamlInternalChoices(nightstar, stock, 'Structureslot');
    expect(structures.find(choice => choice.name === 'Structure Endo')!.error).toMatch(/14/);
    expect(chooseYamlInternal(nightstar, stock, 'Structureslot', 'ENDO').error).toBeDefined();
    expect(chooseYamlInternal(nightstar, empty, 'Structureslot', 'ENDO').build!.internal.Structureslot).toBe('ENDO');
    const names = structures.map(choice => choice.name);
    expect(names).toContain('Structure Reinforced');
    expect(new Set(names).size).toBe(names.length);
    const ratings = getYamlInternalChoices(nightstar, stock, 'Engine').map(choice => Number(choice.id.replace('std', '')));
    expect(ratings).toEqual([...ratings].sort((a, b) => a - b));
  });

  it('con «Fits», solo la munición de las armas montadas, como en MW5', () => {
    const fits = filterYamlInventory(catalog, { ...all, category: 'ammo', fitsOnly: true }, nightstar, stock, null);
    expect(fits.length).toBeGreaterThan(0);
    expect(fits.every(({ id }) => isAmmoForMountedWeapon(stock, id))).toBe(true);
    expect(fits.some(({ id }) => id === 'Gauss_Standard_AmmoEquipment')).toBe(true);
    expect(fits.some(({ id }) => id === 'LRM_AmmoEquipment')).toBe(false);
    expect(filterYamlInventory(catalog, { ...all, category: 'ammo', fitsOnly: true }, nightstar, empty, null)).toEqual([]);
    expect(getYamlDropZones(nightstar, empty, 'Gauss_Standard_AmmoEquipment')).toEqual([]);
  });
});
