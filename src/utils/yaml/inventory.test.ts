import { describe, expect, it } from 'vitest';
import { createStockBuild, stripBuild } from './build';
import { findYamlMech, getYamlItem } from './data';
import {
  autoPlaceYamlItem, chooseYamlInternal, countYamlByFilter, filterYamlInventory, getYamlDropZones, getYamlInternalChoices,
  getYamlInventoryItems, getYamlTargetFilter, isAmmoForMountedWeapon, matchesYamlInventoryFilter, placeYamlItem, sortYamlInventory, YAML_INVENTORY_FILTERS
} from './inventory';

// El inventario del MechLab de YAML con el NSR-9J: lo mismo que el de MW5 con las reglas de YAML.
const nightstar = findYamlMech('NSR-9J')!;
const stock = createStockBuild(nightstar);
const empty = stripBuild(stock);
const catalog = getYamlInventoryItems();
const all = { filter: null, search: '', fitsOnly: false };

describe('inventario del MechLab de YAML', () => {
  // Las piezas internas salen, como en el mod (docs/specs/filtros-inventario-yaml.md, CA6); las «fixed» y los
  // rellenos, no.
  it('no lleva niveles de arma, armas de vehículos, rellenos ni piezas «fixed»; sí las internas', () => {
    expect(catalog.some(({ id }) => /_Lvl\d|Vehicle/.test(id))).toBe(false);
    expect(catalog.some(({ id }) => id === 'XLfiller' || id === 'std100_FIXED')).toBe(false);
    expect(catalog.some(({ id }) => id === 'ENDO')).toBe(true);
    expect(catalog.some(({ id }) => id === 'std285')).toBe(true);
    expect(catalog.some(({ id }) => id === 'GaussRifle')).toBe(true);
    expect(catalog.some(({ id }) => id === 'DoubleHeatSink')).toBe(true);
  });

  it('con «Fits» y una ubicación elegida, solo lo que cabe en ella; los filtros cuentan con lo demás marcado', () => {
    const target = { zone: 'rightArm' as const, hardpoint: null, internal: null };
    const fits = filterYamlInventory(catalog, { ...all, fitsOnly: true }, nightstar, empty, target);
    expect(fits.some(({ id }) => id === 'GaussRifle')).toBe(true);
    // El AC/20 (10) cabe: ocupa las 8 ranuras del brazo y lleva 2 al torso derecho.
    expect(fits.some(({ id }) => id === 'Autocannon20')).toBe(true);
    expect(fits.some(({ id }) => id === 'AntiMissileSystem')).toBe(false);
    const counts = countYamlByFilter(fits);
    expect(counts.weapons + counts.equipment).toBe(fits.length);
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
    const fits = filterYamlInventory(catalog, { ...all, filter: 'ammo', fitsOnly: true }, nightstar, stock, null);
    expect(fits.length).toBeGreaterThan(0);
    expect(fits.every(({ id }) => isAmmoForMountedWeapon(stock, id))).toBe(true);
    expect(fits.some(({ id }) => id === 'Gauss_Standard_AmmoEquipment')).toBe(true);
    expect(fits.some(({ id }) => id === 'LRM_AmmoEquipment')).toBe(false);
    expect(filterYamlInventory(catalog, { ...all, filter: 'ammo', fitsOnly: true }, nightstar, empty, null)).toEqual([]);
    expect(getYamlDropZones(nightstar, empty, 'Gauss_Standard_AmmoEquipment')).toEqual([]);
  });

  // Los filtros del mod Yet Another Mechlab (docs/specs/filtros-inventario-yaml.md).
  const filtersOf = (id: string) => YAML_INVENTORY_FILTERS.filter(filter => matchesYamlInventoryFilter(getYamlItem(id)!, filter)).map(filter => filter.id);

  it('CA1: los diecinueve filtros del mod, en tres filas, con su icono, color y texto de ayuda', () => {
    const rows = (row: string) => YAML_INVENTORY_FILTERS.filter(filter => filter.row === row).map(filter => filter.id);
    expect(rows('weapon')).toEqual(['weapons', 'ballistic', 'energy', 'missile', 'ams', 'melee', 'artillery']);
    expect(rows('equipment')).toEqual(['equipment', 'ammo', 'cooling', 'mobility', 'electronics', 'sensorstargeting', 'internal']);
    expect(rows('misc')).toEqual(['misc', 'misc.enginecore', 'misc.enginetype', 'misc.consumable', 'misc.defense']);
    for (const filter of YAML_INVENTORY_FILTERS) {
      expect(filter.tooltip).toMatch(/^Filter /);
      expect(filter.color).toMatch(/^#[0-9a-f]{6}$/);
      if (filter.text) expect(filter.icon).toBeUndefined();
      else expect(filter.icon).toMatch(/\.png$/);
    }
    expect(YAML_INVENTORY_FILTERS.filter(filter => filter.text).map(filter => filter.text)).toEqual(['ALL W', 'ALL E']);
  });

  it('CA2: un arma de artillería balística sale en Ballistic, Artillery y ALL W', () => {
    expect(filtersOf('LongTomCannon79')).toEqual(['weapons', 'ballistic', 'artillery']);
    expect(filtersOf('ArrowIV')).toEqual(['weapons', 'missile', 'artillery']);
  });

  it('CA3: la munición, solo en Ammunition y ALL E', () => {
    expect(filtersOf('Gauss_Standard_AmmoEquipment')).toEqual(['equipment', 'ammo']);
    expect(filtersOf('DoubleHeatSink')).not.toContain('ammo');
    expect(filtersOf('DoubleHeatSink')).toContain('cooling');
  });

  it('CA4: un núcleo de motor sale en Engine cores, Misc y ALL E', () => {
    expect(filtersOf('std285')).toEqual(['equipment', 'misc', 'misc.enginecore']);
  });

  it('CA5: manda la categoría de las propiedades del mod sobre la etiqueta', () => {
    expect(filtersOf('PPC_CAPACITOR')).toEqual(['equipment', 'electronics']);
  });

  it('CA6 y CA7: un núcleo de motor del inventario se monta en su ranura del torso central', () => {
    const core = getYamlInternalChoices(nightstar, empty, 'Engine').find(choice => !choice.error && choice.id !== stock.internal.Engine)!;
    expect(catalog.some(({ id }) => id === core.id)).toBe(true);
    expect(placeYamlItem(nightstar, empty, core.id, 'centerTorso').build?.internal.Engine).toBe(core.id);
    expect(placeYamlItem(nightstar, empty, core.id, 'leftArm').error).toBeDefined();
    expect(getYamlDropZones(nightstar, empty, core.id)).toEqual(['centerTorso']);
    expect(autoPlaceYamlItem(nightstar, empty, core.id).build?.internal.Engine).toBe(core.id);
  });

  it('CA8: los colores lineales del mod pasados a sRGB', () => {
    expect(YAML_INVENTORY_FILTERS.find(filter => filter.id === 'ballistic')!.color).toBe('#9781b8');
  });

  // docs/specs/filtro-del-anclaje.md
  const gaussTarget = { zone: 'rightArm' as const, hardpoint: 'Forearm_Right_BH1_gaussrifle', internal: null };

  it('CA3: al elegir un anclaje, el filtro de su tipo; sin anclaje, ninguno', () => {
    expect(getYamlTargetFilter(nightstar, gaussTarget)).toBe('ballistic');
    expect(getYamlTargetFilter(nightstar, { ...gaussTarget, hardpoint: 'Forearm_Right_EH1_mediumpulselaser' })).toBe('energy');
    expect(getYamlTargetFilter(nightstar, { ...gaussTarget, hardpoint: null })).toBeNull();
  });

  it('CA4: en un anclaje, con «Fits», solo las armas que admite', () => {
    const fits = filterYamlInventory(catalog, { ...all, fitsOnly: true }, nightstar, stock, gaussTarget);
    expect(fits.length).toBeGreaterThan(0);
    expect(fits.every(({ item }) => item.kind === 'weapon' && item.hardpoint === 'ballistic')).toBe(true);
    expect(fits.some(({ item }) => item.name === 'Alu-Ceramic Shoulder' || item.name === 'Battle Fist')).toBe(false);
  });
});
