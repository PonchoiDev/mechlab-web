import { describe, expect, it } from 'vitest';
import {
  distributeDynamicFillers, getBuildIssues, getHardpointUsage, getInternalLabel,
  getZoneRows, removeItemAt, setArmor, setMaxArmor
} from './board';
import { createStockBuild, setInternal, stripBuild } from './build';
import { findYamlMech } from './data';

// Lo que pinta la página del MechLab de YAML a partir de la build del NSR-9J.
const nightstar = findYamlMech('NSR-9J')!;
const stock = createStockBuild(nightstar);

describe('tablero del MechLab de YAML', () => {
  it('sin pieza, cada ranura interna dice la estándar', () => {
    expect(getInternalLabel(stock, 'Gyro')).toBe('Gyro standard');
    expect(getInternalLabel(stock, 'EngineTypeSlot')).toBe('XL Engine');
  });

  it('las filas de una ubicación: armas, equipo, rellenos fijos del motor y ranuras libres', () => {
    const fillers = distributeDynamicFillers(nightstar, stock);
    const leftTorso = getZoneRows(nightstar, stock, 'leftTorso', fillers);
    expect(leftTorso.filter(row => row.kind === 'fixedFiller')).toEqual([{ kind: 'fixedFiller', label: 'XL Engine', slots: 3 }]);
    expect(leftTorso.reduce((sum, row) => sum + row.slots, 0)).toBe(12);
    const rightArm = getZoneRows(nightstar, stock, 'rightArm', fillers);
    expect(rightArm.filter(row => row.kind === 'weapon').map(row => row.slots).sort()).toEqual([1, 7]);
  });

  it('los rellenos dinámicos del Endo se reparten por las ranuras libres', () => {
    const endo = setInternal(stripBuild(stock), 'Structureslot', 'ENDO');
    const fillers = distributeDynamicFillers(nightstar, endo);
    expect(Object.values(fillers).reduce((sum, count) => sum + count, 0)).toBe(14);
    expect(getZoneRows(nightstar, endo, 'rightTorso', fillers).some(row => row.kind === 'dynamicFiller')).toBe(true);
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

  it('los problemas: sobrepeso, rellenos que no caben y falta de núcleo', () => {
    expect(getBuildIssues(nightstar, stock)).toEqual([]);
    const issues = getBuildIssues(nightstar, setInternal(setInternal(stock, 'Armorslot', 'ARMOR_PRIMITIVE'), 'Structureslot', 'ENDO'));
    expect(issues.map(issue => issue.message).join(' ')).toMatch(/Overweight/);
    expect(issues.map(issue => issue.message).join(' ')).toMatch(/Dynamic fillers need 14/);
    expect(getBuildIssues(nightstar, setInternal(stock, 'Engine', null)).some(issue => /core/.test(issue.message))).toBe(true);
    expect(removeItemAt(stock, 0).items).toHaveLength(stock.items.length - 1);
  });
});
