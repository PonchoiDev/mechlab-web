import { describe, expect, it } from 'vitest';
import starmapJson from '../data/starmap.json';
import type { StarmapData } from '../types/starmap';
import { getClusterLevels, getHubLevels } from './starmap';
import { describeMultiMission, describeRepair, findClusterAt, getArena, getClusterOutlines } from './zones';

// Criterios de aceptación de docs/specs/zonas-arenas.md (issue #80).
const data = starmapJson as unknown as StarmapData;
const system = (name: string) => {
  const found = data.systems.find(candidate => candidate.name === name);
  if (!found) throw new Error(`${name} no existe en starmap.json`);
  return found;
};

describe('ficha de las zonas de conflicto', () => {
  it('CA1: Liao/Davion Border trae descripción, capital, reparación y contratos de varias misiones', () => {
    const zone = data.clusters.DavionBorder;
    expect(zone.description).toBeTruthy();
    expect(zone.capital).toBe(650);
    const [campaign, career] = getClusterLevels(data, 'DavionBorder');
    expect(campaign).toEqual(expect.objectContaining({ mode: 'campaign', repair: { cost: 0.6, time: 1 }, multiMission: { min: 2, max: 3, odds: 0.3 } }));
    expect(career).toEqual(expect.objectContaining({ mode: 'career', repair: { cost: 0.35, time: 0.6 } }));
  });

  it('CA2: se sabe qué zona hay bajo un punto del mapa', () => {
    const outlines = getClusterOutlines(data, 7);
    const capital = data.systems.find(candidate => candidate.id === 650)!;
    expect(findClusterAt(outlines, capital.x, capital.y)).toBe('DavionBorder');
    expect(findClusterAt(outlines, 2000, 2000)).toBeNull();
  });

  it('CA3: el centro industrial de Diboll trae la reparación de cada modo', () => {
    const levels = getHubLevels(data, 'SafeZone_1');
    expect(levels.length).toBeGreaterThan(0);
    expect(levels.every(level => level.repair && level.repair.cost > 0)).toBe(true);
  });

  it('CA6: la reparación y los contratos se describen', () => {
    expect(describeRepair({ cost: 0.6, time: 1 })).toBe('Repairs ×0.6 cost · ×1 time');
    expect(describeMultiMission({ min: 2, max: 3, odds: 0.3 })).toBe('Multi-mission contracts: 2 to 3 missions (30%)');
  });
});

describe('arenas', () => {
  it('CA4: hay 9 sistemas con arena, y Solaris tiene mercado negro, mercenarios y variante especial', () => {
    expect(data.arenas.systems.map(arena => data.systems.find(candidate => candidate.id === arena.system)?.name).sort()).toEqual(
      ['Galatea', 'Hardcore', 'Herotitus', 'Northwind', 'Numenor', 'Outreach', 'Solaris', 'Torrence', 'Westerhand']
    );
    expect(getArena(data, system('Solaris').id)).toEqual(expect.objectContaining({ blackMarket: true, mercEncounters: true, special: true }));
    expect(getArena(data, system('Tharkad').id)).toBeNull();
  });

  it('CA5: hay 11 rangos de fama, y Rudiarius pide 975 puntos', () => {
    const { ranks } = data.arenas;
    expect(ranks).toHaveLength(11);
    expect(ranks[0]).toEqual(expect.objectContaining({ name: 'Nobody From Nowhere', points: 0 }));
    expect(ranks.at(-1)?.name).toBe('Champion');
    const rudiarius = ranks.find(rank => rank.name === 'Rudiarius')!;
    expect(rudiarius.points).toBe(975);
    expect(rudiarius.reward.cbills).toBe(2400000);
    expect(rudiarius.reward.weapons).toEqual([
      { name: 'Autocannon/20 rapid-fire', tier: 'Tier 4', count: 1 },
      { name: 'Heavy Rifle Burst Fire', tier: 'Tier 4', count: 1 }
    ]);
    expect(rudiarius.reward.equipment).toEqual([{ name: 'Arena Supercharger MK IV', count: 1 }]);
  });
});
