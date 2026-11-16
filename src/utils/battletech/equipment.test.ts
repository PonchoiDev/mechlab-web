import { describe, expect, it } from 'vitest';
import itemsJson from '../../data/battletech/items.json';
import type { BtItem } from '../../types/battletech-mechlab';
import {
  DEFAULT_BT_EQUIPMENT_VIEW,
  DEFAULT_BT_WEAPON_FILTER,
  filterBtWeaponRows,
  getBtAmmoRows,
  getBtEquipmentEffects,
  getBtWeaponRows,
  groupBtEquipment,
  groupBtUpgrades,
  parseBtEquipmentQuery,
  sortBtWeaponRows,
  toBtEquipmentQuery,
  toggleBtWeaponSort,
  type BtWeaponFilter,
  type BtWeaponRow
} from './equipment';

// Criterios de aceptación de docs/specs/battletech-equipo.md.
const items = itemsJson as unknown as BtItem[];
const rows = getBtWeaponRows(items);
const weapon = (name: string, manufacturer: string) => {
  const found = rows.find(row => row.item.name === name && row.item.manufacturer === manufacturer);
  if (!found) throw new Error(`${name} de ${manufacturer} no está en la tabla`);
  return found;
};
const item = (name: string) => {
  const found = items.find(candidate => candidate.name === name);
  if (!found) throw new Error(`${name} no está en items.json`);
  return found;
};
const filter = (change: Partial<BtWeaponFilter>) => filterBtWeaponRows(rows, { ...DEFAULT_BT_WEAPON_FILTER, ...change });
const label = (row: BtWeaponRow) => `${row.item.name} ${row.item.manufacturer}`;

describe('página de armas y equipo de BATTLETECH', () => {
  it('CA1: hay 210 armas por anclaje, versión y fuente', () => {
    expect(rows).toHaveLength(210);
    expect(['energy', 'ballistic', 'missile', 'support'].map(hardpoint => filter({ hardpoint: hardpoint as never }).length))
      .toEqual([52, 71, 63, 24]);
    expect([0, 1, 2, 3].map(plus => filter({ plus }).length)).toEqual([40, 71, 85, 14]);
    expect(filter({ source: 'base' })).toHaveLength(167);
    expect(filter({ source: 'heavymetal' })).toHaveLength(43);
  });

  it('CA2: el AC/10 de serie', () => {
    const ac10 = weapon('AC/10', 'Western');
    expect(ac10).toEqual(expect.objectContaining({
      damage: 60, shots: 1, instability: 20, heat: 12, maxRange: 450, rangeSplit: [300, 300, 450],
      ammoPerTon: 8, attacksPerTon: 8, damagePerTon: 5
    }));
    expect([ac10.item.hardpoint, ac10.item.tonnage, ac10.item.slots, ac10.item.cost]).toEqual(['ballistic', 12, 3, 140000]);
    expect(rows.filter(row => row.item.baseName === 'AC/10')).toHaveLength(11);
  });

  it('CA3: el LRM20 de serie', () => {
    expect(weapon('LRM20', 'Jackson')).toEqual(expect.objectContaining({
      damage: 80, damagePerShot: 4, shots: 20, instability: 40, heat: 18, minRange: 180, maxRange: 630,
      indirectFire: true, ammoPerTon: 120, attacksPerTon: 6
    }));
  });

  it('CA4: las versiones de fabricante del M Laser', () => {
    const magna = weapon('M Laser +', 'Magna');
    expect([magna.damage, magna.item.bonuses, magna.item.cost]).toEqual([30, ['+ 5 Dmg.'], 70000]);
    // Los láseres ya traen +1 de precisión; la bonificación de Intek (+3) se suma.
    expect(weapon('M Laser', 'Hellion').accuracy).toBe(1);
    expect(weapon('M Laser + +', 'Intek').accuracy).toBe(4);
  });

  it('CA5: filtros por anclaje, versión, fuente, rareza y búsqueda', () => {
    expect(filter({ hardpoint: 'energy' })).toHaveLength(52);
    expect(filter({ plus: 3 })).toHaveLength(14);
    expect(filter({ source: 'heavymetal' })).toHaveLength(43);
    expect(filter({ rarity: 'special' })).toHaveLength(67);
    const kali = filter({ query: 'kali yama' });
    expect(kali.length).toBeGreaterThan(0);
    expect(kali.every(row => row.item.manufacturer === 'Kali Yama')).toBe(true);
  });

  it('CA6: orden por columnas, con las armas sin el dato al final', () => {
    expect(label(sortBtWeaponRows(rows, { key: 'damage', dir: 'desc' })[0])).toBe('UAC/20 + + Kali Yama');
    expect(sortBtWeaponRows(rows, { key: 'damage', dir: 'desc' })[0].damage).toBe(240);
    expect(label(sortBtWeaponRows(rows, { key: 'damagePerTon', dir: 'desc' })[0])).toBe('ER S Laser + + BlazeFire');
    expect(sortBtWeaponRows(rows, { key: 'damagePerTon', dir: 'desc' })[0].damagePerTon).toBe(80);
    expect(label(sortBtWeaponRows(rows, { key: 'instability', dir: 'desc' })[0])).toBe('LB 20-X + + Shengli Arms');
    const byName = sortBtWeaponRows(rows, { key: 'name', dir: 'asc' }).slice(0, 2);
    expect(byName.map(label)).toEqual(['AC/10 Western', 'AC/10 + Defiance']);

    const damage = toggleBtWeaponSort({ key: 'name', dir: 'asc' }, 'damage');
    expect(damage).toEqual({ key: 'damage', dir: 'desc' });
    expect(toggleBtWeaponSort({ key: 'name', dir: 'asc' }, 'minRange')).toEqual({ key: 'minRange', dir: 'asc' });
    const reversed = toggleBtWeaponSort(damage, 'damage');
    expect(reversed).toEqual({ key: 'damage', dir: 'asc' });
    expect(label(sortBtWeaponRows(rows, reversed).at(-1)!)).toBe('UAC/20 + + Kali Yama');

    for (const dir of ['asc', 'desc'] as const) {
      const sorted = sortBtWeaponRows(rows, { key: 'ammoPerTon', dir });
      const firstWithout = sorted.findIndex(row => row.ammoPerTon === null);
      expect(firstWithout).toBeGreaterThan(0);
      expect(sorted.slice(firstWithout).every(row => row.ammoPerTon === null)).toBe(true);
    }
  });

  it('CA7: el equipo por categorías y las mejoras por grupo', () => {
    const all = { category: 'all' as const, query: '', plus: 'all' as const, source: 'all' as const, rarity: 'all' as const };
    expect(groupBtEquipment(items, all).map(group => [group.id, group.items.length]))
      .toEqual([['heatSinks', 8], ['jumpJets', 4], ['upgrades', 72], ['ammo', 16]]);
    const upgrades = groupBtEquipment(items, all).find(group => group.id === 'upgrades')!.items;
    expect(groupBtUpgrades(upgrades).map(group => [group.group, group.items.length])).toEqual([
      ['actuator', 21], ['cockpit', 12], ['gyro', 10], ['targeting', 12], ['electronic', 3], ['artillery', 2], ['general', 12]
    ]);
  });

  it('CA8: los efectos del equipo', () => {
    const effects = (name: string) => Object.fromEntries(getBtEquipmentEffects(item(name)).map(effect => [effect.label, effect.value]));
    expect(effects('Heat Sink')).toEqual(expect.objectContaining({ 'Heat sinking': '-3 / turn' }));
    expect(effects('Heat Bank')).toEqual(expect.objectContaining({ 'Max heat': '+10', 'Overheat threshold': '+5' }));
    expect(effects('Exchanger')).toEqual(expect.objectContaining({ 'Weapon heat': '-10%' }));
    expect(effects('Jump Jet (S)')).toEqual(expect.objectContaining({ "For 'Mechs of": '10 to 55 t' }));
    expect(effects('Vectored Thrust Kit')).toEqual(expect.objectContaining({ 'Built-in': "Fixed on some 'Mechs" }));
    expect(effects('Arm Mod')).toEqual(expect.objectContaining({ 'Mounts in': 'Arms' }));
    expect(effects('Heat Sink')['Mounts in']).toBe('Anywhere');
  });

  it('CA9: la munición del LRM y las armas que la usan', () => {
    const ammo = getBtAmmoRows(items).find(row => row.item.name === 'LRM Ammo')!;
    expect([ammo.item.tonnage, ammo.item.slots, ammo.item.ammo?.capacity, ammo.item.cost]).toEqual([1, 1, 120, 20000]);
    expect(ammo.weapons).toHaveLength(36);
    expect(ammo.users).toEqual(['LRM10', 'LRM15', 'LRM20', 'LRM5']);
  });

  it('CA10: la vista en la URL', () => {
    expect(parseBtEquipmentQuery('')).toEqual(DEFAULT_BT_EQUIPMENT_VIEW);
    expect(DEFAULT_BT_EQUIPMENT_VIEW.tab).toBe('weapons');
    const view = {
      ...DEFAULT_BT_EQUIPMENT_VIEW,
      tab: 'equipment' as const, query: 'laser', hardpoint: 'energy' as const, plus: 2, source: 'heavymetal' as const,
      rarity: 'rare' as const, sort: { key: 'damage' as const, dir: 'asc' as const }, category: 'upgrades' as const
    };
    expect(parseBtEquipmentQuery(toBtEquipmentQuery(view))).toEqual(view);
    expect(toBtEquipmentQuery(DEFAULT_BT_EQUIPMENT_VIEW)).toBe('');
    expect(parseBtEquipmentQuery('?tab=x&type=lasers&plus=7&source=moon&rarity=epic&sort=foo&dir=up&cat=bad'))
      .toEqual(DEFAULT_BT_EQUIPMENT_VIEW);
  });
});
