import { describe, expect, it } from 'vitest';
import type { BtBuild, BtLoadout } from '../../types/battletech-mechlab';
import { createExportFile } from '../savedBuilds';
import { clearArmor, getArmorTonnage, setArmor, stepArmor } from './armor';
import { decodeBtBuild, encodeBtBuild, getBtBuildFromParams } from './buildCode';
import { compareBtBuilds } from './compare';
import {
  DEFAULT_ITEM_FILTERS,
  DEFAULT_MECH_FILTERS,
  filterBtItems,
  filterBtMechs,
  getPreferredTab
} from './filters';
import { createStockBuild, getHardpointViews, getLocationUsage, groupZoneEquipment, getMountProblem, mountItem, removeItem } from './fitting';
import { getBtBuildIssues } from './issues';
import { BT_ITEMS, BT_MECHS, findMech, getItem } from './mechlabData';
import { createBtExportFile, parseBtImportFile } from './savedBuilds';
import { getBuildSummary, getBuildTonnage } from './stats';

// Criterios de aceptación de docs/specs/battletech-mechlab.md (issue #102).
const mech = (id: string) => {
  const found = findMech(id);
  if (!found) throw new Error(`${id} no está en el MechLab de BATTLETECH`);
  return found;
};
const item = (id: string) => {
  const found = getItem(id);
  if (!found) throw new Error(`${id} no está en el catálogo de BATTLETECH`);
  return found;
};
const stock = (id: string): BtBuild => createStockBuild(mech(id));
const emptyLoadout = (): BtLoadout => ({
  head: [], centerTorso: [], leftTorso: [], rightTorso: [], leftArm: [], rightArm: [], leftLeg: [], rightLeg: []
});
const mount = (build: BtBuild, zone: keyof BtLoadout, id: string): BtBuild => {
  const result = mountItem(build.mech, build.loadout, zone, item(id));
  if (!result.ok) throw new Error(`${id} no cabe en ${zone}: ${result.problem}`);
  return { ...build, loadout: result.loadout };
};

const MEDIUM_LASER = 'Weapon_Laser_MediumLaser_0-STOCK';
const SMALL_LASER = 'Weapon_Laser_SmallLaser_0-STOCK';
const AC2 = 'Weapon_Autocannon_AC2_0-STOCK';
const FLAMER = 'Weapon_Flamer_Flamer_0-STOCK';
const HEAT_SINK = 'Gear_HeatSink_Generic_Standard';
const DOUBLE_HEAT_SINK = 'Gear_HeatSink_Generic_Double';
const EXCHANGER = 'Gear_HeatSink_Generic_Thermal-Exchanger-I';
const JUMP_JET = 'Gear_JumpJet_Generic_Standard';
const HEAVY_JUMP_JET = 'Gear_JumpJet_Generic_Heavy';
const AC20_AMMO = 'Ammo_AmmunitionBox_Generic_AC20';

describe('MechLab de BATTLETECH: datos', () => {
  it('CA1: 96 variantes disponibles de 96 chasis, con su fuente, icono y movimiento', () => {
    expect(BT_MECHS).toHaveLength(96);
    expect(new Set(BT_MECHS.map(candidate => candidate.chassisId)).size).toBe(96);
    const bySource = Object.fromEntries(['base', 'heavymetal', 'flashpoint', 'urbanwarfare']
      .map(source => [source, BT_MECHS.filter(candidate => candidate.source === source).length]));
    expect(bySource).toEqual({ base: 70, heavymetal: 15, flashpoint: 6, urbanwarfare: 5 });
    expect(BT_MECHS.filter(candidate => /_fp_|TARGETDUMMY|TESTDUMMY/i.test(candidate.id))).toEqual([]);
    expect(BT_MECHS.filter(candidate => !candidate.icon || candidate.walk === null || candidate.sprint === null)).toEqual([]);
  });

  it('CA2: armas, munición, disipadores, retrorreactores y mejoras, sin ataques ni plantillas', () => {
    const count = (kind: string, source?: string) =>
      BT_ITEMS.filter(candidate => candidate.kind === kind && (!source || candidate.source === source)).length;
    expect(count('weapon')).toBe(210);
    expect(count('weapon', 'base')).toBe(167);
    expect(count('weapon', 'heavymetal')).toBe(43);
    expect(count('ammo')).toBe(16);
    expect(count('heatSink')).toBe(8);
    expect(count('jumpJet')).toBe(4);
    expect(count('upgrade')).toBe(72);
    expect(BT_ITEMS.filter(candidate => /MeleeAttack|DFAAttack|AI_Imaginary|_SPECIAL-|Template/.test(candidate.id))).toEqual([]);
    expect(getItem('Weapon_Gauss_Gauss_0-STOCK')).toBeDefined();
    expect(getItem(DOUBLE_HEAT_SINK)).toBeDefined();
  });

  it('CA3: el número de «+» del nombre es la versión del arma', () => {
    expect(item('Weapon_Laser_MediumLaser_2-Magna')).toMatchObject({
      name: 'M Laser + +', plus: 2, baseName: 'M Laser', manufacturer: 'Magna', hardpoint: 'energy'
    });
  });
});

describe('MechLab de BATTLETECH: reglas de montaje', () => {
  it('CA4: las 96 builds de serie pesan el tonelaje de su chasis', () => {
    const wrong = BT_MECHS
      .map(candidate => ({ id: candidate.id, tonnage: getBuildTonnage(createStockBuild(candidate)), expected: candidate.tonnage }))
      .filter(entry => Math.abs(entry.tonnage - entry.expected) > 1e-9);
    expect(wrong).toEqual([]);
    const hunchback = stock('HBK-4G');
    expect(getBuildTonnage(hunchback)).toBe(50);
    expect(getBuildSummary(hunchback).armorPoints).toBe(800);
    expect(getArmorTonnage(800)).toBe(10);
  });

  it('CA5: cada arma necesita un anclaje libre de su tipo en su ubicación', () => {
    const hunchback = stock('HBK-4G');
    expect(getMountProblem(hunchback.mech, hunchback.loadout, 'leftArm', item(MEDIUM_LASER))).toBe('hardpoint');
    expect(getMountProblem(hunchback.mech, hunchback.loadout, 'rightTorso', item(MEDIUM_LASER))).toBe('hardpoint');
    const withTwoAc2 = mount(mount(hunchback, 'rightTorso', AC2), 'rightTorso', AC2);
    expect(getMountProblem(withTwoAc2.mech, withTwoAc2.loadout, 'rightTorso', item(AC2))).toBe('hardpoint');
    expect(getLocationUsage(withTwoAc2.mech, withTwoAc2.loadout, 'rightTorso').hardpoints.ballistic).toEqual({ used: 3, capacity: 3 });
    const emptyArm = { ...hunchback, loadout: removeItem(hunchback.loadout, 'leftArm', 0) };
    expect(getMountProblem(emptyArm.mech, emptyArm.loadout, 'leftArm', item(SMALL_LASER))).toBe('hardpoint');
    expect(getMountProblem(emptyArm.mech, emptyArm.loadout, 'leftArm', item(MEDIUM_LASER))).toBeNull();
  });

  it('CA6: todos los componentes ocupan ranuras', () => {
    const empty: BtBuild = { ...stock('HBK-4G'), loadout: emptyLoadout() };
    const withDouble = mount(empty, 'leftLeg', DOUBLE_HEAT_SINK);
    expect(getLocationUsage(withDouble.mech, withDouble.loadout, 'leftLeg').slots).toEqual({ used: 3, capacity: 4 });
    expect(getMountProblem(withDouble.mech, withDouble.loadout, 'leftLeg', item(HEAT_SINK))).toBeNull();
    expect(getMountProblem(withDouble.mech, withDouble.loadout, 'leftLeg', item(DOUBLE_HEAT_SINK))).toBe('slots');
  });

  it('CA7: cada componente solo va donde lo permite el juego', () => {
    const { mech: hunchback, loadout } = { ...stock('HBK-4G'), loadout: emptyLoadout() };
    const gyro = item('Gear_Gyro_Coventry_Mark-75');
    const cockpit = item('Gear_Cockpit_StarCorps_Improved');
    expect(getMountProblem(hunchback, loadout, 'centerTorso', gyro)).toBeNull();
    expect(getMountProblem(hunchback, loadout, 'leftTorso', gyro)).toBe('location');
    expect(getMountProblem(hunchback, loadout, 'head', cockpit)).toBeNull();
    expect(getMountProblem(hunchback, loadout, 'centerTorso', cockpit)).toBe('location');
    expect(getMountProblem(hunchback, loadout, 'leftArm', item(JUMP_JET))).toBe('location');
    expect(getMountProblem(hunchback, loadout, 'head', item(JUMP_JET))).toBe('location');
    expect(getMountProblem(hunchback, loadout, 'leftLeg', item(JUMP_JET))).toBeNull();
  });

  it('CA8: retrorreactores hasta el máximo del chasis y de su tramo de tonelaje', () => {
    const jenner = mount(mount(stock('JR7-D'), 'leftTorso', JUMP_JET), 'rightTorso', JUMP_JET);
    expect(getMountProblem(jenner.mech, jenner.loadout, 'leftLeg', item(JUMP_JET))).toBe('jumpJetLimit');
    const hunchback = stock('HBK-4G');
    expect(getMountProblem(hunchback.mech, hunchback.loadout, 'centerTorso', item(JUMP_JET))).toBeNull();
    expect(getMountProblem(hunchback.mech, hunchback.loadout, 'centerTorso', item(HEAVY_JUMP_JET))).toBe('jumpJetTonnage');
    const rifleman = { ...stock('RFL-3N'), loadout: emptyLoadout() };
    expect(getMountProblem(rifleman.mech, rifleman.loadout, 'centerTorso', item(HEAVY_JUMP_JET))).toBeNull();
    expect(getMountProblem(rifleman.mech, rifleman.loadout, 'centerTorso', item(JUMP_JET))).toBe('jumpJetTonnage');
  });

  it('CA9: el equipo fijo cuenta y no se puede quitar ni montar', () => {
    const marauder = stock('MAD-3R');
    expect(marauder.mech.fixed).toEqual([['leftTorso', 'Gear_General_Lance_Command_Module']]);
    expect(marauder.loadout.leftTorso).not.toContain('Gear_General_Lance_Command_Module');
    const module = item('Gear_General_Lance_Command_Module');
    expect(getLocationUsage(marauder.mech, marauder.loadout, 'leftTorso').slots.used)
      .toBe(module.slots + marauder.loadout.leftTorso.reduce((total, id) => total + item(id).slots, 0));
    expect(getBuildTonnage(marauder)).toBe(75);
    expect(getMountProblem(marauder.mech, emptyLoadout(), 'rightTorso', module)).toBe('builtIn');
  });

  it('CA10: el blindaje respeta los máximos delantero y trasero y va en pasos de 5', () => {
    const hunchback = stock('HBK-4G');
    const center = hunchback.mech.locations.centerTorso;
    expect(setArmor(hunchback.mech, hunchback.armor, 'centerTorso', 'front', 999).centerTorso.front).toBe(center.maxArmor);
    expect(setArmor(hunchback.mech, hunchback.armor, 'centerTorso', 'rear', 999).centerTorso.rear).toBe(center.maxRearArmor);
    expect(setArmor(hunchback.mech, hunchback.armor, 'centerTorso', 'front', -10).centerTorso.front).toBe(0);
    expect(setArmor(hunchback.mech, hunchback.armor, 'head', 'rear', 20).head.rear).toBe(0);
    expect(stepArmor(hunchback.mech, hunchback.armor, 'centerTorso', 'front', -1).centerTorso.front).toBe(125);
    expect(stepArmor(hunchback.mech, hunchback.armor, 'centerTorso', 'front', 1).centerTorso.front).toBe(135);
    expect(getArmorTonnage(80)).toBe(1);
    expect(getBuildSummary({ ...hunchback, armor: clearArmor() }).armorPoints).toBe(0);
  });
});

describe('MechLab de BATTLETECH: cifras', () => {
  it('CA11: calor de la salva frente a disipación, con los intercambiadores', () => {
    const hunchback = stock('HBK-4G');
    expect(getBuildSummary(hunchback).heat).toMatchObject({ dissipation: 39, alpha: 54, maxHeat: 100, overheat: 60 });
    const cooled = mount(hunchback, 'centerTorso', EXCHANGER);
    expect(getBuildSummary(cooled).heat.alpha).toBeCloseTo(54 * 0.9);
  });

  it('CA12: daño, inestabilidad y daño por distancia del HBK-4G', () => {
    const summary = getBuildSummary(stock('HBK-4G'));
    expect(summary.alphaDamage).toBe(170);
    expect(summary.instability).toBe(40);
    const at = (distance: number) => summary.rangeProfile.find(entry => entry.distance === distance);
    expect(at(90)).toMatchObject({ damage: 170, belowMin: 0 });
    expect(at(270)).toMatchObject({ damage: 150 });
    expect(at(360)).toMatchObject({ damage: 0 });
  });

  it('CA13: el LRM 20 del AS7-D hace 80 y a 90 m está por debajo de su alcance mínimo', () => {
    const summary = getBuildSummary(stock('AS7-D'));
    expect(summary.weapons.find(line => line.item.id === 'Weapon_LRM_LRM20_0-STOCK')).toMatchObject({ count: 1, damage: 80 });
    expect(summary.rangeProfile.find(entry => entry.distance === 90)?.belowMin).toBe(80);
  });

  it('CA14: munición por tipo y avisos de munición', () => {
    const hunchback = stock('HBK-4G');
    expect(getBuildSummary(hunchback).ammo.find(line => line.category === 'AC20')).toMatchObject({ rounds: 10, attacks: 10, weapons: 1 });
    // Los láseres no usan munición: su Category (Energy) no es una categoría de munición.
    expect(getBuildSummary(hunchback).ammo.map(line => line.category)).toEqual(['AC20']);
    expect(getBtBuildIssues(hunchback).filter(issue => issue.id.startsWith('missing-ammo'))).toEqual([]);
    const noAmmo = { ...hunchback, loadout: { ...hunchback.loadout, leftTorso: [] } };
    expect(getBtBuildIssues(noAmmo).map(issue => issue.id)).toContain('missing-ammo-AC20');
    const flamer = mount({ ...noAmmo, loadout: { ...noAmmo.loadout, head: [] } }, 'head', FLAMER);
    expect(getBtBuildIssues(flamer).map(issue => issue.id)).not.toContain('missing-ammo-Flamer');
  });

  it('CA15: movimiento y coste del HBK-4G', () => {
    const summary = getBuildSummary(stock('HBK-4G'));
    expect(summary).toMatchObject({ walk: 120, sprint: 200, cost: 5_090_000 });
    expect(summary.cost).toBe(mech('HBK-4G').stockCost);
  });

  it('CA16: problemas de la build', () => {
    const hunchback = stock('HBK-4G');
    const heavy = mount(mount(hunchback, 'leftTorso', AC20_AMMO), 'leftTorso', AC20_AMMO);
    const overweight = getBtBuildIssues(heavy).find(issue => issue.id === 'overweight');
    expect(overweight).toMatchObject({ severity: 'error', message: 'Over tonnage by 2 t' });
    const crowded = { ...hunchback, loadout: { ...hunchback.loadout, leftLeg: [DOUBLE_HEAT_SINK, DOUBLE_HEAT_SINK] } };
    expect(getBtBuildIssues(crowded).find(issue => issue.id === 'slots-leftLeg')?.severity).toBe('error');
    const extraWeapon = { ...hunchback, loadout: { ...hunchback.loadout, leftArm: [MEDIUM_LASER, MEDIUM_LASER] } };
    expect(getBtBuildIssues(extraWeapon).find(issue => issue.id === 'hardpoints-leftArm')?.severity).toBe('error');
    const unusedAmmo = mount({ ...hunchback, loadout: emptyLoadout() }, 'leftTorso', AC20_AMMO);
    expect(getBtBuildIssues(unusedAmmo).find(issue => issue.id === 'unused-ammo-AC20')?.severity).toBe('warning');
  });
});

describe('MechLab de BATTLETECH: compartir, guardar y comparar', () => {
  it('CA17: el código de la build se decodifica igual y descarta lo que no cabe', () => {
    const build = mount(stock('HBK-4G'), 'rightTorso', AC2);
    const decoded = decodeBtBuild(encodeBtBuild(build));
    expect(decoded).toEqual(build);
    expect(decodeBtBuild('roto')).toBeNull();
    const tooMany = { ...build, loadout: { ...build.loadout, leftArm: [MEDIUM_LASER, MEDIUM_LASER] } };
    expect(decodeBtBuild(encodeBtBuild(tooMany))?.loadout.leftArm).toEqual([MEDIUM_LASER]);
    expect(getBtBuildFromParams(new URLSearchParams('mech=HBK-4G'))).toEqual({ build: stock('HBK-4G') });
    expect(getBtBuildFromParams(new URLSearchParams('mech=hunchback_HBK-4G'))?.build?.mech.variant).toBe('HBK-4G');
    expect(getBtBuildFromParams(new URLSearchParams('b=roto'))).toEqual({ build: null });
    expect(getBtBuildFromParams(new URLSearchParams(''))).toBeNull();
  });

  it('CA18: las builds exportadas son de BATTLETECH y no se mezclan con las de MW5', () => {
    const code = encodeBtBuild(stock('HBK-4G'));
    const file = createBtExportFile([{ id: '1', name: 'Hunch', code, savedAt: '2026-11-14T10:00:00.000Z' }]);
    expect(JSON.parse(file)).toMatchObject({ format: 'mw-builder-builds', game: 'battletech' });
    expect(parseBtImportFile(file)).toEqual({ entries: [{ name: 'Hunch', code, savedAt: '2026-11-14T10:00:00.000Z' }], invalid: 0 });
    const mercs = createExportFile([{ id: '1', name: 'Atlas', code, savedAt: '2026-11-14T10:00:00.000Z' }]);
    expect(parseBtImportFile(mercs)).toBeNull();
  });

  it('CA19: la comparación dice quién gana cada cifra, y en el calor gana el más bajo', () => {
    const rows = Object.fromEntries(compareBtBuilds(stock('HBK-4G'), stock('AS7-D'))
      .flatMap(group => group.rows).map(row => [row.key, row]));
    expect(rows.alphaDamage).toMatchObject({ a: '170', b: '328', winner: 'b' });
    expect(rows.alphaHeat).toMatchObject({ a: '54', b: '102', winner: 'a', lowerIsBetter: true });
    expect(rows.walk).toMatchObject({ a: '120', b: '95', winner: 'a' });
  });
});

describe('MechLab de BATTLETECH: filtros', () => {
  it('CA20: filtros del selector de \'Mechs', () => {
    const filter = (changes: Partial<typeof DEFAULT_MECH_FILTERS>) => filterBtMechs(BT_MECHS, { ...DEFAULT_MECH_FILTERS, ...changes });
    expect(filter({})).toHaveLength(96);
    expect(filter({ weightClasses: ['assault'] })).toHaveLength(21);
    expect(filter({ sources: ['heavymetal'] })).toHaveLength(15);
    const ballistic = filter({ minHardpoints: { ...DEFAULT_MECH_FILTERS.minHardpoints, ballistic: 3 } });
    expect(ballistic.length).toBeGreaterThan(0);
    expect(ballistic.every(candidate => Object.values(candidate.locations)
      .reduce((total, location) => total + location.hardpoints.filter(type => type === 'ballistic').length, 0) >= 3)).toBe(true);
    expect(filter({ minJumpJets: 5 }).every(candidate => candidate.maxJumpJets >= 5)).toBe(true);
    expect(filter({ minJumpJets: 5 })).toHaveLength(38);
    expect(filter({ tags: ['Sniper'] }).every(candidate => candidate.tags.includes('Sniper'))).toBe(true);
    expect(filter({ query: 'hbk' }).map(candidate => candidate.name)).toEqual(expect.arrayContaining(['Hunchback']));
    expect(filter({ query: 'hbk' }).every(candidate => candidate.name === 'Hunchback')).toBe(true);
  });

  it('CA21: filtros del selector de objetos', () => {
    const filter = (changes: Partial<typeof DEFAULT_ITEM_FILTERS>) => filterBtItems(BT_ITEMS, { ...DEFAULT_ITEM_FILTERS, ...changes });
    const energy = filter({ tab: 'energy' });
    expect(energy.length).toBeGreaterThan(0);
    expect(energy.every(candidate => candidate.kind === 'weapon' && candidate.hardpoint === 'energy')).toBe(true);
    expect(filter({ tab: 'energy', plus: [2] }).every(candidate => candidate.plus === 2)).toBe(true);
    expect(filter({ tab: 'ballistic', sources: ['heavymetal'] }).every(candidate => candidate.source === 'heavymetal')).toBe(true);
    expect(filter({ tab: 'upgrade' }).some(candidate => candidate.builtIn)).toBe(false);
    const byDamage = filter({ tab: 'ballistic', sort: 'damage' });
    const damage = (id: string) => item(id).weapon!.damage * item(id).weapon!.shots;
    expect(damage(byDamage[0].id)).toBe(Math.max(...byDamage.map(candidate => damage(candidate.id))));
    expect(filter({ tab: 'energy', query: 'magna' }).every(candidate => /magna/i.test(`${candidate.name} ${candidate.manufacturer}`))).toBe(true);
  });

  it('abre la pestaña de un anclaje con sitio en la ubicación elegida', () => {
    const hunchback = stock('HBK-4G');
    expect(getPreferredTab(hunchback.mech, hunchback.loadout, 'rightTorso', 'energy')).toBe('ballistic');
    expect(getPreferredTab(hunchback.mech, hunchback.loadout, 'centerTorso', 'energy')).toBe('energy');
    expect(getPreferredTab(hunchback.mech, hunchback.loadout, 'rightTorso', 'ammo')).toBe('ammo');
  });

  it('reparte las armas por sus anclajes y agrupa el resto del equipo, como las tarjetas de MW5', () => {
    const hunchback = stock('HBK-4G');
    expect(getHardpointViews(hunchback.mech, hunchback.loadout, 'rightTorso').map(view => [view.type, view.item?.name ?? null]))
      .toEqual([['ballistic', 'AC/20'], ['ballistic', null], ['ballistic', null]]);
    expect(groupZoneEquipment(hunchback.mech, hunchback.loadout, 'leftLeg').map(group => [group.item.name, group.count, group.indices]))
      .toEqual([['Heat Sink', 2, [0, 1]]]);
    const marauder = stock('MAD-3R');
    expect(groupZoneEquipment(marauder.mech, marauder.loadout, 'leftTorso')[0]).toMatchObject({ fixed: true, indices: [] });
  });

  it('se puede quitar cada arma y cada pieza de serie, y el equipo fijo no está en el loadout', () => {
    for (const variant of ['HBK-4G', 'AS7-D', 'MAD-3R']) {
      const build = stock(variant);
      for (const zone of Object.keys(build.loadout) as (keyof BtLoadout)[]) {
        build.loadout[zone].forEach((id, index) => {
          const removed = removeItem(build.loadout, zone, index);
          expect(removed[zone]).toHaveLength(build.loadout[zone].length - 1);
          expect(getHardpointViews(build.mech, removed, zone).filter(view => view.item).length + groupZoneEquipment(build.mech, removed, zone)
            .filter(group => !group.fixed).reduce((total, group) => total + group.count, 0)).toBe(removed[zone].length);
          expect(id).toBeTruthy();
        });
      }
      expect(build.mech.fixed.every(([zone, id]) => !build.loadout[zone].includes(id))).toBe(true);
    }
  });
});
