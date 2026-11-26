import { describe, expect, it } from 'vitest';
import itemsJson from '../data/items.json';
import type { Item } from '../types/item';
import {
  DEFAULT_ARSENAL_VIEW,
  DEFAULT_WEAPON_FILTER,
  filterEquipment,
  filterWeaponRows,
  getAmmoRows,
  getEquipmentEffects,
  getWeaponRows,
  groupEquipment,
  parseArsenalQuery,
  sortWeaponRows,
  toArsenalQuery,
  toggleWeaponSort,
  type WeaponRow
} from './arsenal';

// Criterios de aceptación de docs/specs/pagina-equipo.md.
const items = Object.values(itemsJson as unknown as Record<string, Item>);
const item = (id: string) => {
  const found = items.find(candidate => candidate.id === id);
  if (!found) throw new Error(`${id} no está en items.json`);
  return found;
};
const row = (rows: WeaponRow[], name: string) => {
  const found = rows.find(candidate => candidate.item.name === name);
  if (!found) throw new Error(`${name} no está en la tabla`);
  return found;
};
const names = (rows: WeaponRow[]) => rows.map(candidate => candidate.item.name);
const tier1 = getWeaponRows(items, '1');

describe('página de armas y equipo', () => {
  it('CA1: hay 190 armas de seis tipos; 60 son Clan', () => {
    expect(tier1).toHaveLength(190);
    const count = (type: string) => filterWeaponRows(tier1, { ...DEFAULT_WEAPON_FILTER, type: type as never }).length;
    expect(['energy', 'ballistic', 'missile', 'artillery', 'melee', 'ams'].map(count)).toEqual([37, 59, 66, 2, 24, 2]);
    expect(tier1.filter(candidate => candidate.clan)).toHaveLength(60);
  });

  it('CA2: el Medium Laser en tier 1 y en Lost Tech', () => {
    expect(row(tier1, 'M Laser')).toEqual(expect.objectContaining({
      tier: '1', damage: 5, heat: 2.25, cooldown: 4, rpm: 15, dps: 1.25, damagePerTon: 5, range: 270, maxRange: 405,
      speed: null, manufacturer: 'Magna Mk.II', ammoPerTon: null, volleysPerTon: null, dlc: 0
    }));
    expect(row(getWeaponRows(items, '5'), 'M Laser')).toEqual(expect.objectContaining({
      tier: '5', damage: 6.5, manufacturer: 'Krupp'
    }));
  });

  it('CA3: el Autocannon/10 en tier 1', () => {
    expect(row(tier1, 'AC/10')).toEqual(expect.objectContaining({
      damage: 10, speed: 600, ammoPerTon: 40, volleysPerTon: 40
    }));
    const autocannon = row(tier1, 'AC/10').item;
    expect([autocannon.tonnage, autocannon.weaponType, autocannon.size]).toEqual([12, 'ballistic', 'medium']);
  });

  it('CA4: el LRM 10 hace 12 de daño por salva y lleva 44 salvas por tonelada', () => {
    expect(row(tier1, 'LRM 10')).toEqual(expect.objectContaining({ damage: 12, ammoPerTon: 440, volleysPerTon: 44 }));
  });

  it('CA5: las armas Clan enseñan siempre su único tier', () => {
    expect(row(getWeaponRows(items, '3'), 'C-ER M Laser')).toEqual(expect.objectContaining({
      tier: '1', tierName: 'Clan tier', damage: 9.1, manufacturer: 'Strana Mechty MechWorks'
    }));
  });

  it('CA6: filtros por tipo, tamaño, tecnología, DLC y búsqueda', () => {
    const filter = (change: Partial<typeof DEFAULT_WEAPON_FILTER>, rows = tier1) =>
      filterWeaponRows(rows, { ...DEFAULT_WEAPON_FILTER, ...change });
    expect(filter({ type: 'energy' })).toHaveLength(37);
    expect(filter({ size: 'large' })).toHaveLength(55);
    expect(filter({ tech: 'clan' })).toHaveLength(60);
    expect(filter({ tech: 'innerSphere' })).toHaveLength(130);
    expect(filter({ dlc: 3 })).toHaveLength(17);
    expect(filter({ dlc: 0 })).toHaveLength(135);
    expect(names(filter({ query: 'gauss' })).sort()).toEqual(['C-Gauss', 'Gauss', 'Light Gauss']);
    expect(names(filter({ query: 'krupp' }, getWeaponRows(items, '5'))).sort()).toEqual(['L Laser', 'M Laser']);
  });

  it('CA7: orden por columnas, con las armas sin el dato al final', () => {
    // Las ametralladoras dan su daño por segundo (dps-rayos-continuos.md, CA2 y CA3).
    expect(tier1.find(row => row.item.name === 'C-Heavy Machine Gun')).toEqual(expect.objectContaining({ dps: 4 }));
    expect(sortWeaponRows(tier1, { key: 'dps', dir: 'desc' })[0].item.name).toBe('Assault Arena Fist');
    expect(sortWeaponRows(tier1, { key: 'damagePerTon', dir: 'desc' })[0]).toEqual(expect.objectContaining({ damagePerTon: 30 }));
    expect(sortWeaponRows(tier1, { key: 'damagePerTon', dir: 'desc' })[0].item.name).toBe('Light Knuckles');
    expect(names(sortWeaponRows(tier1, { key: 'name', dir: 'asc' })).slice(0, 3)).toEqual(['AC/10', 'AC/10 BF', 'AC/10 RF']);

    const dps = toggleWeaponSort({ key: 'name', dir: 'asc' }, 'dps');
    expect(dps).toEqual({ key: 'dps', dir: 'desc' });
    const reversed = toggleWeaponSort(dps, 'dps');
    expect(reversed).toEqual({ key: 'dps', dir: 'asc' });
    expect(sortWeaponRows(tier1, reversed).at(-1)?.item.name).toBe(sortWeaponRows(tier1, dps)[0].item.name);
    expect(toggleWeaponSort(reversed, 'name')).toEqual({ key: 'name', dir: 'asc' });

    for (const dir of ['asc', 'desc'] as const) {
      const sorted = sortWeaponRows(tier1, { key: 'ammoPerTon', dir });
      const firstWithout = sorted.findIndex(candidate => candidate.ammoPerTon === null);
      expect(firstWithout).toBeGreaterThan(0);
      expect(sorted.slice(firstWithout).every(candidate => candidate.ammoPerTon === null)).toBe(true);
    }
  });

  it('CA13: lo que se introduce después del final del juego no está en el catálogo', () => {
    // El Heavy Gauss Rifle y su munición son de 3061; el juego acaba el 31 de diciembre de 3060.
    expect(items.filter(candidate => /HeavyGauss/.test(candidate.id))).toEqual([]);
  });

  it('CA8: el equipo por categorías', () => {
    const groups = groupEquipment(items, { category: 'all', query: '', tech: 'all', dlc: 'all' });
    expect(groups.map(group => [group.id, group.items.length])).toEqual([
      ['heatSinks', 3], ['jumpJets', 5], ['motive', 20], ['electronics', 8], ['targetingComputers', 7], ['ammo', 106]
    ]);
    const electronics = groups.find(group => group.id === 'electronics')!.items;
    expect(electronics.filter(candidate => candidate.ecm)).toHaveLength(4);
    expect(electronics.filter(candidate => candidate.probe)).toHaveLength(4);
    expect(filterEquipment(items, { category: 'jumpJets', query: '', tech: 'all', dlc: 'all' })).toHaveLength(5);
    expect(filterEquipment(items, { category: 'all', query: 'masc', tech: 'clan', dlc: 'all' }).map(candidate => candidate.name))
      .toEqual(['C-MASC MK I', 'C-MASC MK II', 'C-MASC MK III', 'C-MASC MK IV', 'C-MASC MK V']);
  });

  it('CA9: los efectos de cada pieza de equipo', () => {
    const effects = (id: string) => Object.fromEntries(getEquipmentEffects(item(id)).map(effect => [effect.label, effect.value]));
    expect(effects('SingleHeatSink')).toEqual({ Cooling: '+0.1', 'Heat capacity': '+1' });
    expect(effects('JumpJet_Class3_Equipment')).toEqual({
      Thrust: '12.5 m/s', 'Burn time': '2.75 s', Recharge: '8 s', "For 'Mechs of": '60 to 75 t'
    });
    expect(effects('MASC_MKII')).toEqual({ 'Top speed': '+50%', Acceleration: '×4', 'Turn rate': '+45%', 'Overuse damages': 'Legs' });
    expect(effects('Supercharger_MKI')['Overuse damages']).toBe('Center torso');
    expect(effects('GuardianECM')).toEqual(expect.objectContaining({ 'Disrupt range': '220 m', 'Counter range': '400 m' }));
    expect(effects('BeagleActiveProbe')).toEqual(expect.objectContaining({ Range: '450 m', 'Sensor range': '+25%' }));
    expect(effects('TargetingComputer_Mk7')).toEqual({
      'Sensor range': '+22%', 'Ballistic and PPC projectile speed': '+35%', 'Laser range': '+10%'
    });
  });

  it('CA10: la munición del AC/10 y las armas que la usan', () => {
    const ammo = getAmmoRows(items).find(candidate => candidate.item.id === 'AC10_Standard_AmmoEquipment')!;
    expect([ammo.item.tonnage, ammo.item.slots, ammo.item.capacity, ammo.item.explosionDamagePerRound])
      .toEqual([1, 1, 40, 10]);
    expect(ammo.users).toEqual(['AC/10', 'AC/10 BF', 'AC/10 RF']);
  });

  it('CA11: la vista en la URL', () => {
    expect(parseArsenalQuery('')).toEqual(DEFAULT_ARSENAL_VIEW);
    expect(DEFAULT_ARSENAL_VIEW).toEqual(expect.objectContaining({ tab: 'weapons', tier: '1' }));
    const view = {
      ...DEFAULT_ARSENAL_VIEW,
      tab: 'equipment' as const, query: 'laser', type: 'energy' as const, size: 'medium' as const, tech: 'clan' as const,
      dlc: 7, tier: '5', sort: { key: 'dps' as const, dir: 'asc' as const }, category: 'jumpJets' as const
    };
    expect(parseArsenalQuery(toArsenalQuery(view))).toEqual(view);
    expect(toArsenalQuery(DEFAULT_ARSENAL_VIEW)).toBe('');
    expect(parseArsenalQuery('?tab=nope&type=lasers&size=huge&tech=x&dlc=42&tier=9&sort=foo&dir=up&cat=bad'))
      .toEqual(DEFAULT_ARSENAL_VIEW);
    expect(parseArsenalQuery('?dlc=base').dlc).toBe(0);
  });

  it('CA12: busca por el nombre corto del juego', () => {
    const search = (query: string) => names(filterWeaponRows(tier1, { ...DEFAULT_WEAPON_FILTER, query }));
    expect(search('tag')).toEqual(['TAG', 'C-TAG']);
    expect(search('ac/10-rf')).toEqual(['AC/10 RF']);
    expect(search('target')).toEqual(['TAG', 'C-TAG']);
  });
});
