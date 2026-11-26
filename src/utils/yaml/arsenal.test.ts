import { describe, expect, it } from 'vitest';
import {
  DEFAULT_YAML_ARSENAL_VIEW,
  DEFAULT_YAML_WEAPON_FILTER,
  filterYamlWeaponRows,
  getYamlAmmoRows,
  getYamlEquipmentEffects,
  getYamlWeaponRows,
  groupYamlEquipment,
  parseYamlArsenalQuery,
  sortYamlWeaponRows,
  toggleYamlWeaponSort,
  toYamlArsenalQuery,
  type YamlWeaponRow
} from './arsenal';
import { getYamlItem } from './data';

// Criterios de aceptación de docs/specs/pagina-equipo-yaml.md.
const tier1 = getYamlWeaponRows('1');
const row = (rows: YamlWeaponRow[], id: string) => {
  const found = rows.find(candidate => candidate.id === id);
  if (!found) throw new Error(`${id} no está en la tabla`);
  return found;
};
const count = (filter: Partial<typeof DEFAULT_YAML_WEAPON_FILTER>) => filterYamlWeaponRows(tier1, { ...DEFAULT_YAML_WEAPON_FILTER, ...filter }).length;
const effects = (id: string) => Object.fromEntries(getYamlEquipmentEffects(getYamlItem(id)!).map(effect => [effect.label, effect.value]));

describe('página de armas y equipo de YAML', () => {
  it('CA1: hay 380 armas de seis tipos, 141 Clan, y su origen', () => {
    expect(tier1).toHaveLength(380);
    expect(['energy', 'ballistic', 'missile', 'artillery', 'melee', 'ams'].map(type => count({ type: type as never }))).toEqual([77, 125, 137, 2, 34, 5]);
    expect(tier1.filter(candidate => candidate.clan)).toHaveLength(141);
    expect(['base', 'yet-another-weapon', 'yet-another-weapon-clan', 'yet-another-mechlab'].map(source => count({ source }))).toEqual([172, 123, 83, 2]);
  });

  it('CA2: el M Laser en Tier 1', () => {
    const laser = row(tier1, 'MediumLaser');
    expect(laser).toMatchObject({ slots: 1, tons: 1, damage: 5, heat: 2.25, cooldown: 4, rpm: 12, dps: 1, damagePerTon: 5, range: 270, maxRange: 540, speed: null, ammoPerTon: null, volleysPerTon: null });
  });

  it('CA3: el LRM 10 en Tier 1', () => {
    const lrm = row(tier1, 'LRM10');
    expect(lrm).toMatchObject({ slots: 2, tons: 5, damage: 12, range: 900, maxRange: 900, speed: 250, ammoPerTon: 440, volleysPerTon: 44 });
  });

  it('CA4: un arma sin Tier 0 enseña su nivel por defecto y lo dice', () => {
    const tier0 = getYamlWeaponRows('0');
    const lrm = row(tier0, 'LRM10');
    expect(lrm).toMatchObject({ tier: 0, tierMissing: false });
    const withoutTier0 = tier0.find(candidate => !Object.hasOwn(getYamlItem(candidate.id)!.combat!.tiers, '0'))!;
    expect(withoutTier0.tierMissing).toBe(true);
    expect(withoutTier0.tier).not.toBe(0);
  });

  it('CA5: filtros por tipo, tecnología, origen y búsqueda', () => {
    expect(count({ type: 'energy' })).toBe(77);
    expect(count({ tech: 'clan' })).toBe(141);
    expect(count({ source: 'yet-another-weapon' })).toBe(123);
    const lrm10 = filterYamlWeaponRows(tier1, { ...DEFAULT_YAML_WEAPON_FILTER, query: 'lrm 10' }).map(candidate => candidate.name);
    expect(lrm10).toContain('LRM 10');
    expect(lrm10.every(name => /LRM 10/.test(name))).toBe(true);
  });

  it('CA6: orden por DPS en los dos sentidos, sin el dato al final', () => {
    const desc = sortYamlWeaponRows(tier1, { key: 'dps', dir: 'desc' });
    const maxDps = Math.max(...tier1.map(candidate => candidate.dps ?? -1));
    expect(desc[0].dps).toBe(maxDps);
    const toggled = toggleYamlWeaponSort({ key: 'dps', dir: 'desc' }, 'dps');
    expect(toggled).toEqual({ key: 'dps', dir: 'asc' });
    const asc = sortYamlWeaponRows(tier1, toggled);
    const withSpeed = sortYamlWeaponRows(tier1, { key: 'speed', dir: 'asc' });
    expect(withSpeed.at(-1)!.speed).toBeNull();
    expect(sortYamlWeaponRows(tier1, { key: 'speed', dir: 'desc' }).at(-1)!.speed).toBeNull();
    expect(asc.at(-1)!.dps).toBe(maxDps);
  });

  it('CA7: el equipo por categorías, sin rellenos ni piezas fijas', () => {
    const groups = groupYamlEquipment({ ...DEFAULT_YAML_WEAPON_FILTER, category: 'all' });
    expect(Object.fromEntries(groups.filter(group => group.id !== 'ammo').map(group => [group.id, group.items.length]))).toEqual({
      heatSinks: 22, engines: 89, structureArmor: 46, internals: 52, jumpJets: 15, motive: 31,
      electronics: 15, targetingComputers: 18, actuators: 36, other: 33
    });
    const all = groups.flatMap(group => group.items.map(entry => entry.item));
    expect(all.some(item => item.fixed || (item.category ?? '').startsWith('Equipment.Filler'))).toBe(false);
  });

  it('CA8: los efectos del equipo', () => {
    expect(effects('DoubleHeatSink')).toMatchObject({ Cooling: '+0.2', 'Heat capacity': '+2' });
    expect(getYamlItem('DoubleHeatSink')!.slots).toBe(3);
    expect(effects('std300')).toMatchObject({ 'Engine rating': '300' });
    expect(effects('ENGINE_XL')).toMatchObject({ 'Engine weight': '-50%', 'Filler slots': 'Left torso 3, Right torso 3' });
  });

  it('CA9: la munición LRM y las armas que la usan', () => {
    const ammo = getYamlAmmoRows().find(candidate => candidate.item.name === 'LRM Ammo')!;
    expect(ammo).toMatchObject({ perTon: 440 });
    expect(ammo.item).toMatchObject({ tons: 1, capacity: 440 });
    expect(ammo.users).toHaveLength(20);
    expect(ammo.users).toEqual(expect.arrayContaining(['LRM 5', 'LRM 20', 'MML 9']));
  });

  it('CA10: la vista en la URL', () => {
    const view = { ...DEFAULT_YAML_ARSENAL_VIEW, tab: 'equipment' as const, query: 'gauss', type: 'ballistic' as const, tech: 'clan' as const,
      source: 'yet-another-weapon', tier: '5', sort: { key: 'dps' as const, dir: 'asc' as const }, category: 'engines' as const };
    expect(parseYamlArsenalQuery(toYamlArsenalQuery(view))).toEqual(view);
    expect(toYamlArsenalQuery(DEFAULT_YAML_ARSENAL_VIEW)).toBe('');
    expect(parseYamlArsenalQuery('?tab=nope&type=laser&tier=9&sort=foo&cat=bar&source=nada')).toEqual(DEFAULT_YAML_ARSENAL_VIEW);
  });
});
