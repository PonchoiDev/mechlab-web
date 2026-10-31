import { describe, expect, it } from 'vitest';
import { encodeBuild, getStockBuild } from './buildCode';
import { getBuildSummary } from './calculators';
import {
  compareBuilds,
  getBarShares,
  getDefaultComparison,
  groupLoadout,
  pickWinner,
  resolveSavedBuild,
  toComparedSide,
  type ComparedSide
} from './compare';
import { allItems, allMechs, getMech } from '../test/fixtures';

// Criterios de aceptación de docs/specs/comparar-chasis.md (issue #58).
const stockSide = (id: string): ComparedSide => {
  const mech = getMech(id);
  const stock = getStockBuild(mech, allMechs, allItems)!;
  return { mech, summary: getBuildSummary(mech, stock.loadout, stock.armor) };
};

const rowsByKey = (a: ComparedSide, b: ComparedSide) =>
  Object.fromEntries(compareBuilds(a, b).flatMap(group => group.rows).map(row => [row.key, row]));

describe('comparar dos chasis', () => {
  const rows = rowsByKey(stockSide('AS7-D'), stockSide('KGC-000'));

  it('CA1: el AS7-D gana en armadura, daño por salva y refrigeración', () => {
    expect(rows.armor).toMatchObject({ a: '608', b: '573', winner: 'a' });
    expect(rows.firepower).toMatchObject({ a: '78.4', b: '68', winner: 'a' });
    expect(rows.cooling).toMatchObject({ a: '1.9', b: '1.5', winner: 'a' });
  });

  it('CA2: el KGC-000 gana en anclajes balísticos y el AS7-D en energía', () => {
    expect(rows.ballistic).toMatchObject({ a: '1', b: '2', winner: 'b' });
    expect(rows.energy).toMatchObject({ a: '4', b: '1', winner: 'a' });
  });

  it('CA3: empatan en velocidad, pico de calor y alcance máximo', () => {
    expect(rows.speed).toMatchObject({ a: '48.6', b: '48.6', winner: null, difference: null });
    expect(rows.heatSpike).toMatchObject({ a: '24', b: '24', winner: null });
    expect(rows.maxRange).toMatchObject({ a: '900', b: '900', winner: null });
  });

  it('CA4: en el pico de calor gana el valor más bajo', () => {
    expect(pickWinner(20, 30, 'lower')).toBe('a');
    expect(pickWinner(20, 30, 'higher')).toBe('b');
    expect(pickWinner(null, 30, 'higher')).toBeNull();
  });

  it('CA5: un \'Mech comparado consigo mismo no tiene ganador en ninguna fila', () => {
    const side = stockSide('AS7-D');
    expect(compareBuilds(side, side).flatMap(group => group.rows).filter(row => row.winner !== null)).toEqual([]);
  });

  it('marca la diferencia en la fila que tiene ganador', () => {
    expect(rows.armor.difference).toBe('+35');
    expect(rows.ballistic.difference).toBe('+1');
  });
});

describe('con quién comparar al abrir el panel', () => {
  it('CA6: propone otra variante del mismo chasis', () => {
    const atlas = getMech('AS7-D');
    const proposed = allMechs[getDefaultComparison(allMechs, atlas)];
    expect(proposed.name).toBe('Atlas');
    expect(proposed.id).not.toBe('AS7-D');
  });

  it('CA7: si es la única variante de su chasis, propone el primer \'Mech de la lista que no sea él', () => {
    const only = allMechs.find(mech => allMechs.filter(other => other.name === mech.name).length === 1)!;
    const proposed = allMechs[getDefaultComparison(allMechs, only)];
    expect(proposed.id).toBe(allMechs.find(mech => mech.id !== only.id)!.id);
  });
});

describe('tarjetas y builds guardadas', () => {
  const atlas = getMech('AS7-D');
  const stock = getStockBuild(atlas, allMechs, allItems)!;

  it('CA8: agrupa el loadout por componente, con las repeticiones juntas y sin componentes vacíos', () => {
    const groups = groupLoadout(stock.loadout);
    const rightTorso = groups.find(group => group.zone === 'rightTorso')!;
    expect(rightTorso.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Autocannon/20', type: 'weapon', count: 1 }),
      expect.objectContaining({ name: 'AC/20 Ammo', type: 'ammo', count: 2 })
    ]));
    // Las armas van primero, como en el tablero.
    expect(rightTorso.items[0].type).toBe('weapon');
    expect(groups.every(group => group.items.length > 0)).toBe(true);
  });

  it('CA9: una build guardada se compara con sus mejoras', () => {
    const code = encodeBuild(atlas, stock.loadout, stock.armor, allItems, ['IncreasedArmor_Trait2']);
    const saved = resolveSavedBuild({ id: '1', name: 'Atlas blindado', code, savedAt: '2026-10-31' }, allMechs, allItems)!;
    expect(saved.mech.id).toBe('AS7-D');
    const withUpgrades = toComparedSide(saved);
    const plain = toComparedSide(stock);
    expect(withUpgrades.summary.armorPoints).toBeGreaterThan(plain.summary.armorPoints);
  });

  it('CA10: una build guardada con un código que ya no vale no se compara', () => {
    expect(resolveSavedBuild({ id: '2', name: 'Rota', code: 'no-es-un-codigo', savedAt: '2026-10-31' }, allMechs, allItems)).toBeNull();
  });

  it('CA11: la barra del valor mayor ocupa todo el ancho y la otra, su proporción', () => {
    const [a, b] = getBarShares(608, 573);
    expect(a).toBe(1);
    expect(b).toBeCloseTo(0.94, 2);
    expect(getBarShares(0, 0)).toEqual([0, 0]);
    expect(getBarShares(null, 5)).toEqual([0, 1]);
  });
});
