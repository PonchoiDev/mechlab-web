import { describe, expect, it } from 'vitest';
import {
  distributeDynamicFillerGroups, distributeDynamicFillers, getBuildIssues, getHardpointUsage, getInternalLabel,
  getZoneRows, removeItemAt, setArmor, setMaxArmor
} from './board';
import { createStockBuild, setInternal, stripBuild } from './build';
import { findYamlMech, getYamlItem } from './data';
import { GENERAL_SLOT } from './stats';
import { ZONE_LABELS } from '../zones';

// Lo que pinta la página del MechLab de YAML a partir de la build del NSR-9J.
const nightstar = findYamlMech('NSR-9J')!;
const stock = createStockBuild(nightstar);

describe('tablero del MechLab de YAML', () => {
  it('sin pieza, cada ranura interna dice la estándar', () => {
    expect(getInternalLabel(stock, 'Gyro')).toBe('Gyro standard');
    expect(getInternalLabel(stock, 'EngineTypeSlot')).toBe('XL Engine');
  });

  it('las filas de una ubicación: armas, equipo, rellenos fijos del motor y ranuras libres', () => {
    const fillers = distributeDynamicFillerGroups(nightstar, stock);
    const leftTorso = getZoneRows(nightstar, stock, 'leftTorso', fillers);
    expect(leftTorso.filter(row => row.kind === 'fixedFiller')).toEqual([{ kind: 'fixedFiller', label: 'XL Engine', slots: 3, slotType: 'EngineTypeSlot' }]);
    expect(leftTorso.reduce((sum, row) => sum + row.slots, 0)).toBe(12);
    const rightArm = getZoneRows(nightstar, stock, 'rightArm', fillers);
    expect(rightArm.filter(row => row.kind === 'weapon').map(row => row.slots).sort()).toEqual([1, 7]);
  });

  it('los rellenos dinámicos del Endo se reparten por las ranuras libres', () => {
    const endo = setInternal(stripBuild(stock), 'Structureslot', 'ENDO');
    const fillers = distributeDynamicFillers(nightstar, endo);
    expect(Object.values(fillers).reduce((sum, count) => sum + count, 0)).toBe(14);
    const groups = distributeDynamicFillerGroups(nightstar, endo);
    expect(getZoneRows(nightstar, endo, 'rightTorso', groups).filter(row => row.kind === 'dynamicFiller'))
      .toEqual([{ kind: 'dynamicFiller', label: 'Structure Endo', slots: fillers.rightTorso, slotType: 'Structureslot' }]);
  });

  it('el uso de anclajes no cuenta los de cuerpo a cuerpo', () => {
    expect(getHardpointUsage(nightstar, stock, 'rightArm')).toEqual([
      { type: 'ballistic', used: 1, total: 1 },
      { type: 'energy', used: 1, total: 2 }
    ]);
  });

  it('la armadura de delante y la de detrás comparten el máximo de la ubicación', () => {
    expect(setArmor(nightstar, stock, 'centerTorso', 'front', 200).armor.centerTorso).toEqual({ front: 100, rear: 20 });
    expect(setArmor(nightstar, stock, 'head', 'front', -5).armor.head.front).toBe(0);
    expect(setMaxArmor(nightstar, stripBuild(stock)).armor.head).toEqual({ front: 30, rear: 0 });
  });

  it('los problemas: sobrepeso y falta de núcleo; los rellenos que no caben, no (CA43)', () => {
    expect(getBuildIssues(nightstar, stock).filter(issue => issue.severity === 'error')).toEqual([]);
    const issues = getBuildIssues(nightstar, setInternal(setInternal(stock, 'Armorslot', 'ARMOR_PRIMITIVE'), 'Structureslot', 'ENDO'));
    expect(issues.map(issue => issue.message).join(' ')).toMatch(/Over tonnage/);
    expect(issues.map(issue => issue.message).join(' ')).not.toMatch(/filler/i);
    expect(getBuildIssues(nightstar, setInternal(stock, 'Engine', null)).some(issue => /core/.test(issue.message))).toBe(true);
    expect(removeItemAt(stock, 0).items).toHaveLength(stock.items.length - 1);
  });
});

// docs/specs/avisos-yaml.md
describe('avisos del MechLab de YAML', () => {
  const archer = findYamlMech('ARC-T')!;
  const archerStock = createStockBuild(archer);
  const withoutAmmo = { ...archerStock, items: archerStock.items.filter(mounted => getYamlItem(mounted.item)?.kind !== 'ammo') };

  it('CA1: los avisos nombran la ubicación con su etiqueta', () => {
    const crammed = { ...stock, items: [...stock.items, ...Array.from({ length: 12 }, () => ({ zone: 'head' as const, slotType: GENERAL_SLOT, item: 'LRM_AmmoEquipment' }))] };
    const slots = getBuildIssues(nightstar, crammed).filter(issue => /slots/.test(issue.message));
    expect(slots.length).toBeGreaterThan(0);
    for (const issue of slots) expect(issue.message.startsWith(`${ZONE_LABELS[issue.zone!]}:`)).toBe(true);
  });

  it('CA2: un aviso por arma distinta sin munición, en la ubicación de la primera', () => {
    const ammo = getBuildIssues(archer, withoutAmmo).filter(issue => /ammo/.test(issue.message));
    expect(ammo).toEqual([expect.objectContaining({ severity: 'warning', zone: 'leftTorso', message: 'LRM 20 has no ammo' })]);
  });

  it('CA3: avisa de la munición que no usa ningún arma', () => {
    const extra = { ...archerStock, items: [...archerStock.items, { zone: 'leftLeg' as const, slotType: GENERAL_SLOT, item: 'AC20_Standard_AmmoEquipment' }] };
    const name = getYamlItem('AC20_Standard_AmmoEquipment')!.name;
    expect(getBuildIssues(archer, extra)).toContainEqual(expect.objectContaining({
      severity: 'warning', zone: 'leftLeg', message: `${name} is not used by any weapon`
    }));
  });

  it('CA4: las cargas de consumibles no son munición sin uso', () => {
    const assault = findYamlMech('AS7-SP')!;
    expect(getBuildIssues(assault, createStockBuild(assault)).filter(issue => /ammo|weapon/.test(issue.message))).toEqual([]);
  });

  it('CA5: sin aviso de anclajes libres y un solo aviso de armadura', () => {
    const issues = getBuildIssues(archer, archerStock);
    expect(issues.some(issue => /hardpoint/i.test(issue.message))).toBe(false);
    expect(issues.filter(issue => /Armor/.test(issue.message))).toEqual([
      expect.objectContaining({ severity: 'warning', zone: 'head', message: 'Armor below max in 4 components' })
    ]);
  });

  it('CA6 y CA7: la armadura al máximo salvo la cabeza, y entera', () => {
    const maxed = setMaxArmor(archer, archerStock);
    const headless = setArmor(archer, maxed, 'head', 'front', 10);
    expect(getBuildIssues(archer, headless).find(issue => /Armor/.test(issue.message))?.message).toBe('Armor below max: Head');
    expect(getBuildIssues(archer, maxed).some(issue => /Armor/.test(issue.message))).toBe(false);
  });

  it('CA8: los errores primero y los ids sin repetir', () => {
    const heavy = setInternal(setInternal(stock, 'Armorslot', 'ARMOR_PRIMITIVE'), 'Structureslot', 'ENDO');
    const issues = getBuildIssues(nightstar, stripArmor(heavy));
    expect(issues[0].message).toMatch(/Over tonnage/);
    expect(issues.map(issue => issue.severity)).toEqual([...issues.map(issue => issue.severity)].sort());
    expect(new Set(issues.map(issue => issue.id)).size).toBe(issues.length);
    expect(issues.some(issue => /Armor/.test(issue.message))).toBe(true);
  });
});

function stripArmor(build: ReturnType<typeof createStockBuild>) {
  return { ...build, armor: { ...build.armor, head: { front: 0, rear: 0 } } };
}
