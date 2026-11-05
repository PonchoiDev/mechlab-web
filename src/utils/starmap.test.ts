import { describe, expect, it } from 'vitest';
import starmapData from '../data/starmap.json';
import type { StarmapData } from '../types/starmap';
import {
  buildTerritoryIndex,
  clampDate,
  formatGameDate,
  getClusterOutline,
  getFactionColor,
  getHubs,
  getNextEvent,
  getOwnerAt,
  getPreviousEvent,
  getTerritoryOwner,
  parseMapQuery,
  searchSystems,
  toMapQuery
} from './starmap';

// Criterios de aceptación de docs/specs/mapa-estelar.md (issue #61).
const data = starmapData as StarmapData;
const system = (name: string) => {
  const found = data.systems.find(candidate => candidate.name === name);
  if (!found) throw new Error(`${name} no existe en starmap.json`);
  return found;
};

describe('propietario de cada sistema por fecha', () => {
  it('CA1: Tukayyid pasa de Rasalhague a Ghost Bear y vuelve a Rasalhague en 3052', () => {
    const tukayyid = system('Tukayyid');
    expect(getOwnerAt(tukayyid, '3049-12-31')).toBe('FreeRasalhagueRepublic');
    expect(getOwnerAt(tukayyid, '3052-05-10')).toBe('ClanGhostBear');
    expect(getOwnerAt(tukayyid, '3052-06-01')).toBe('FreeRasalhagueRepublic');
  });

  it('CA2: al empezar la partida, cada capital es de su casa', () => {
    const owners = ['Tharkad', 'New Avalon', 'Luthien', 'Sian', 'Atreus']
      .map(name => getOwnerAt(system(name), '3015-01-01'));
    expect(owners).toEqual(['Steiner', 'Davion', 'Kurita', 'Liao', 'Marik']);
  });

  it('CA3: en 3041 Tharkad y New Avalon son de la Federated Commonwealth, con el color de los Federated Suns', () => {
    expect(getOwnerAt(system('Tharkad'), '3041-01-01')).toBe('FederatedCommonwealth');
    expect(getOwnerAt(system('New Avalon'), '3041-01-01')).toBe('FederatedCommonwealth');
    expect(getFactionColor(data, 'FederatedCommonwealth')).toBe(getFactionColor(data, 'Davion'));
  });

  it('CA8: un sistema sin dueño no tiene propietario ni territorio', () => {
    const unowned = data.systems.find(candidate => getOwnerAt(candidate, data.range.start) === null);
    expect(unowned).toBeDefined();
    const index = buildTerritoryIndex(data.systems);
    expect(getTerritoryOwner(index, data.systems, unowned!.x, unowned!.y, data.range.start)).toBeNull();
  });
});

describe('eventos y fechas', () => {
  it('CA4: los 19 eventos del juego van de 3025 a 3060, con la invasión de los Clanes en 3049', () => {
    expect(data.events).toHaveLength(19);
    expect(data.events.map(event => event.date)).toEqual([...data.events.map(event => event.date)].sort());
    expect(data.events[0].date).toBe('3025-01-01');
    expect(data.events.find(event => event.date === '3049-01-01')?.name).toMatch(/Clan Invasion/);
    expect(data.events.at(-1)!.date).toBe('3060-01-01');
  });

  it('CA5: desde junio de 3050, el evento siguiente es la tercera oleada y el anterior la segunda', () => {
    expect(getNextEvent(data.events, '3050-06-15')?.date).toBe('3050-08-01');
    expect(getPreviousEvent(data.events, '3050-06-15')?.date).toBe('3050-06-01');
    expect(getNextEvent(data.events, '3060-06-01')).toBeNull();
    expect(getPreviousEvent(data.events, '3015-01-01')).toBeNull();
  });

  it('CA7: las fechas se ajustan al rango de la partida', () => {
    expect(data.range).toEqual({ start: '3015-01-01', end: '3060-12-31' });
    expect(clampDate('2900-05-05', data.range)).toBe('3015-01-01');
    expect(clampDate('3070-01-01', data.range)).toBe('3060-12-31');
    expect(clampDate('3042-01-21', data.range)).toBe('3042-01-21');
  });

  it('CA12: la fecha se muestra como en el juego', () => {
    expect(formatGameDate('3042-01-21')).toBe('21 JAN 3042');
    expect(formatGameDate('3015-12-01')).toBe('1 DEC 3015');
  });
});

describe('centros industriales y clústeres', () => {
  it('CA6: hay 35 centros industriales, con Diboll como capital de uno y Blue Diamond dentro de otro', () => {
    const hubs = getHubs(data);
    expect(hubs).toHaveLength(35);
    expect(hubs.some(hub => hub.capital.name === 'Diboll')).toBe(true);
    expect(hubs.some(hub => hub.systems.some(member => member.name === 'Blue Diamond'))).toBe(true);
    expect(system('Blue Diamond').hub).toBeDefined();
  });

  it('CA11: el polígono de un clúster contiene todos sus sistemas', () => {
    const members = data.systems.filter(candidate => candidate.cluster === 'TaurianCorridor');
    expect(members.length).toBeGreaterThan(3);
    const outline = getClusterOutline(members.map(member => [member.x, member.y]), 6);
    const inside = ([x, y]: [number, number]) => outline.every(([ax, ay], i) => {
      const [bx, by] = outline[(i + 1) % outline.length];
      return (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= 0;
    });
    expect(members.every(member => inside([member.x, member.y]))).toBe(true);
  });
});

describe('búsqueda, territorios y URL', () => {
  it('CA9: busca sin distinguir mayúsculas y pone primero los nombres que empiezan por el texto', () => {
    expect(searchSystems(data.systems, 'tuk')[0].name).toBe('Tukayyid');
    expect(searchSystems(data.systems, 'TUKAYYID')[0].name).toBe('Tukayyid');
    const results = searchSystems(data.systems, 'new');
    const firstContaining = results.findIndex(result => !result.name.toLowerCase().startsWith('new'));
    expect(results.slice(firstContaining).every(result => !result.name.toLowerCase().startsWith('new'))).toBe(true);
    expect(searchSystems(data.systems, '')).toEqual([]);
  });

  it('CA10: un punto junto a Tharkad es de su dueño y uno lejos de todo, de nadie', () => {
    const tharkad = system('Tharkad');
    const index = buildTerritoryIndex(data.systems);
    expect(getTerritoryOwner(index, data.systems, tharkad.x + 1, tharkad.y + 1, '3015-01-01')).toBe('Steiner');
    expect(getTerritoryOwner(index, data.systems, 2000, 2000, '3015-01-01')).toBeNull();
  });

  it('CA13: la fecha y el sistema se leen y se escriben en la URL', () => {
    expect(parseMapQuery('?date=3042-01-21&system=Tukayyid', data)).toEqual({ date: '3042-01-21', systemId: system('Tukayyid').id });
    expect(parseMapQuery('?date=ayer&system=Nowhere', data)).toEqual({ date: '3015-01-01', systemId: null });
    expect(parseMapQuery('?date=3099-01-01', data).date).toBe('3060-12-31');
    expect(toMapQuery({ date: '3042-01-21', systemId: system('Tukayyid').id }, data)).toBe('?date=3042-01-21&system=Tukayyid');
  });
});
