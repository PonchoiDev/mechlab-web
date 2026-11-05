import { describe, expect, it } from 'vitest';
import starmapData from '../data/starmap.json';
import type { Market, StarmapData } from '../types/starmap';
import { getMarketsForSystem, getMechLabUrl, getUniqueMechsAt, searchMarkets } from './markets';

// Criterios de aceptación de docs/specs/mercados-especiales.md (issue #66).
const data = starmapData as unknown as StarmapData;
const systemId = (name: string) => {
  const found = data.systems.find(system => system.name === name);
  if (!found) throw new Error(`${name} no existe en starmap.json`);
  return found.id;
};
const market = (systemName: string, dlc: number): Market => {
  const found = data.markets.find(candidate => candidate.system === systemId(systemName) && candidate.dlc === dlc);
  if (!found) throw new Error(`No hay mercado del DLC ${dlc} en ${systemName}`);
  return found;
};

describe('Mechs únicos', () => {
  it('CA1: el Atlas II aparece en Romulus desde el 10 de mayo de 3043', () => {
    expect(data.uniqueMechs).toContainEqual({ mech: 'AS7-D-H', name: 'Atlas II', dlc: 7, system: systemId('Romulus'), from: '3043-05-10' });
    expect(getUniqueMechsAt(data, '3043-05-09').map(unique => unique.mech)).not.toContain('AS7-D-H');
    expect(getUniqueMechsAt(data, '3043-05-10').map(unique => unique.mech)).toContain('AS7-D-H');
  });
});

describe('mercados especiales', () => {
  it('CA2: hay 22 mercados, todos en un sistema del mapa', () => {
    expect(data.markets).toHaveLength(22);
    expect(data.markets.every(candidate => data.systems.some(system => system.id === candidate.system))).toBe(true);
  });

  it('CA3: el mercado del DLC4 en Rasalhague es de la misión 5 y vende 9 Mechs', () => {
    const rasalhague = market('Rasalhague', 4);
    expect(rasalhague.stage).toBe('Mission 5');
    expect(rasalhague.mechs).toHaveLength(9);
    expect(rasalhague.mechs.map(mech => mech.id)).toEqual(expect.arrayContaining(['TDR-5S', 'BLR-1G']));
    expect(rasalhague.mechs.find(mech => mech.id === 'TDR-5S')?.name).toBe('Thunderbolt');
  });

  it('CA4: el mercado negro del DLC7 en Alleghe vende el STK-3H', () => {
    const alleghe = market('Alleghe', 7);
    expect(alleghe.blackMarket).toBe(true);
    expect(alleghe.mechs.map(mech => mech.id)).toEqual(['STK-3H']);
  });

  it('CA5: las armas llevan su tier como en el MechLab', () => {
    expect(market('Bangor', 9).weapons).toContainEqual({ name: 'Ultra Autocannon 10', tier: 'Lost Tech tier', count: 1 });
  });

  it('solo lista lo que se vende: ninguna arma ni equipo con cantidad 0', () => {
    const items = data.markets.flatMap(candidate => [...candidate.weapons, ...candidate.equipment]);
    expect(items.filter(item => item.count <= 0)).toEqual([]);
  });

  it('CA6: Rasalhague tiene el mercado del DLC4 y el mercado negro del DLC7', () => {
    expect(getMarketsForSystem(data, systemId('Rasalhague')).map(found => found.dlc).sort()).toEqual([4, 7]);
  });
});

describe('búsqueda y enlace al MechLab', () => {
  it('CA7: «atlas» da los mercados con algún Atlas y el Atlas II de Romulus', () => {
    const results = searchMarkets(data, 'atlas');
    const systems = results.map(result => data.systems.find(system => system.id === result.system)?.name);
    expect(systems).toEqual(expect.arrayContaining(['Predlitz', 'Radstadt', 'Bangor', 'Romulus']));
    expect(results.find(result => result.unique)?.unique?.mech).toBe('AS7-D-H');
    expect(searchMarkets(data, 'ultra autocannon').length).toBeGreaterThan(0);
    // Sin texto, todos: los Mechs únicos primero y después los mercados por DLC.
    const all = searchMarkets(data, '');
    expect(all).toHaveLength(data.markets.length + data.uniqueMechs.length);
    expect(all[0].unique?.mech).toBe('AS7-D-H');
    expect(all.slice(1).map(result => result.market!.dlc)).toEqual([...all.slice(1).map(result => result.market!.dlc)].sort((a, b) => a - b));
  });

  it('CA8: cada Mech se abre en el MechLab con su build de serie', () => {
    expect(getMechLabUrl('AS7-D-H')).toBe('/mercs/?mech=AS7-D-H');
  });
});
