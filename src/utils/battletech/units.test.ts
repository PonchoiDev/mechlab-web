import { describe, expect, it } from 'vitest';
import itemsJson from '../../data/battletech/items.json';
import unitsJson from '../../data/battletech/units.json';
import type { BtItem } from '../../types/battletech-mechlab';
import type { BtUnit } from '../../types/battletech-units';
import {
  DEFAULT_BT_UNITS_VIEW,
  filterBtUnits,
  getBtUnitArmor,
  getBtUnitFirepower,
  getBtUnitWeapons,
  parseBtUnitsQuery,
  sortBtUnits,
  toBtCatalog,
  toBtUnitsQuery
} from './units';

// Criterios de aceptación de docs/specs/battletech-unidades.md, con los datos reales.
const units = (unitsJson as unknown as { units: BtUnit[] }).units;
const catalog = toBtCatalog(itemsJson as unknown as BtItem[]);
const unit = (name: string) => {
  const found = units.find(candidate => candidate.name === name);
  if (!found) throw new Error(`No está ${name}`);
  return found;
};

describe('unidades enemigas de BATTLETECH', () => {
  it('CA1: 37 unidades sin vetadas y con todo su inventario en el catálogo', () => {
    expect(units).toHaveLength(37);
    const kinds = (kind: string) => units.filter(candidate => candidate.kind === kind).length;
    expect([kinds('tracked'), kinds('wheeled'), kinds('turret')]).toEqual([13, 12, 12]);
    expect(units.some(candidate => /Target Dummy|SLDF|Ammunition Transport|Armored/.test(candidate.name))).toBe(false);
    for (const candidate of units) {
      for (const line of [...candidate.weapons, ...candidate.ammo, ...candidate.equipment]) {
        expect(catalog.has(line.id), `${candidate.name}: ${line.id}`).toBe(true);
      }
    }
  });

  it('CA2: el Manticore, con su blindaje, estructura y movimiento', () => {
    const manticore = unit('Manticore');
    expect(manticore).toMatchObject({ kind: 'tracked', weightClass: 'heavy', tonnage: 60, source: 'base', walk: 120, sprint: 200, noncombatant: false });
    expect(manticore.locations).toEqual([
      { location: 'front', armor: 210, structure: 12 },
      { location: 'left', armor: 165, structure: 12 },
      { location: 'right', armor: 165, structure: 12 },
      { location: 'rear', armor: 130, structure: 12 },
      { location: 'turret', armor: 210, structure: 12 }
    ]);
    expect(getBtUnitArmor(manticore)).toEqual({ armor: 880, structure: 60 });
  });

  it('CA3: las armas del Manticore y su potencia de fuego', () => {
    const manticore = unit('Manticore');
    const weapons = getBtUnitWeapons(catalog, manticore);
    expect(weapons.map(weapon => `${weapon.count} ${weapon.item.name}`).sort()).toEqual(['1 LRM10', '1 M Laser', '1 PPC', '1 SRM6']);
    expect(weapons.find(weapon => weapon.item.name === 'LRM10')).toMatchObject({ damage: 40, maxRange: 630 });
    expect(getBtUnitFirepower(catalog, manticore)).toEqual({ damage: 163, instability: 58, heatDamage: 0, maxRange: 630 });
  });

  it('CA4: una torreta, con una ubicación y sin movimiento', () => {
    const turret = unit('Heavy Shredder Turret');
    expect(getBtUnitFirepower(catalog, turret)).toMatchObject({ damage: 216, heatDamage: 40 });
    expect(turret).toMatchObject({ kind: 'turret', weightClass: 'heavy', tonnage: null, walk: null, sprint: null });
    expect(turret.locations).toHaveLength(1);
    expect(getBtUnitArmor(turret).armor).toBe(300);
  });

  it('CA5: el Swift Wind no lleva armas ni combate', () => {
    const swiftWind = unit('Swift Wind');
    expect(swiftWind.weapons).toEqual([]);
    expect(swiftWind.noncombatant).toBe(true);
    expect(getBtUnitFirepower(catalog, swiftWind).damage).toBe(0);
  });

  it('CA6: el Packrat lleva el ECM y es de Urban Warfare', () => {
    const packrat = unit('Packrat Support Vehicle');
    expect(packrat.source).toBe('urbanwarfare');
    expect(packrat.equipment.map(line => line.id)).toContain('Gear_Sensor_Prototype_ECM');
  });

  it('CA7: filtro por tipo y búsqueda sin distinguir mayúsculas', () => {
    expect(filterBtUnits(units, { kind: 'turret', query: '' })).toHaveLength(12);
    expect(filterBtUnits(units, { kind: 'all', query: 'CARRIER' }).map(candidate => candidate.name).sort())
      .toEqual(['Inferno Carrier', 'LRM Carrier', 'SRM Carrier']);
  });

  it('CA8: orden por daño y por velocidad, con las torretas al final', () => {
    expect(sortBtUnits(catalog, units, 'damage')[0].name).toBe('SRM Carrier');
    const bySpeed = sortBtUnits(catalog, units, 'speed');
    expect(bySpeed.slice(0, 2).map(candidate => candidate.name)).toEqual(['Rotunda Recon Vehicle', 'Swift Wind']);
    expect(bySpeed.slice(-12).every(candidate => candidate.kind === 'turret')).toBe(true);
  });

  it('CA9: páginas y dibujos de Sarna', () => {
    expect(unit('Scorpion').sarna?.page).toMatch(/Scorpion_%28Combat_Vehicle%29$/);
    expect(unit('Scorpion Mk II').sarna?.page).toBe(unit('Scorpion').sarna?.page);
    expect(unit('Inferno Carrier').sarna?.page).toBe(unit('SRM Carrier').sarna?.page);
    expect(unit('Alsvin').sarna).toBeUndefined();
    expect(units.filter(candidate => candidate.kind === 'turret').every(candidate => !candidate.sarna)).toBe(true);
    for (const candidate of units) {
      if (candidate.sarna?.image) expect(candidate.sarna.image).toMatch(/^https:\/\/cfw\.sarna\.net\//);
    }
  });

  it('CA10: la vista va y vuelve de la URL', () => {
    const view = { kind: 'wheeled' as const, query: 'striker', sort: 'armor' as const };
    expect(parseBtUnitsQuery(toBtUnitsQuery(view))).toEqual(view);
    expect(toBtUnitsQuery(DEFAULT_BT_UNITS_VIEW)).toBe('');
    expect(parseBtUnitsQuery('?kind=nope&sort=nope')).toEqual(DEFAULT_BT_UNITS_VIEW);
  });
});
