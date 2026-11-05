import { describe, expect, it } from 'vitest';
import starmapData from '../data/starmap.json';
import type { StarmapData } from '../types/starmap';
import {
  buildTerritoryIndex,
  clampDate,
  countSystemsByOwner,
  dateToDays,
  daysToDate,
  describeZoneLevel,
  formatGameDate,
  getCurrentEvent,
  getDistanceToTerra,
  getClusterLevels,
  getClusterOutline,
  getFactionColor,
  getHubLevels,
  getHubs,
  getNextEvent,
  getOwnerAt,
  getOwnerChanges,
  getPreviousEvent,
  getTerritoryContours,
  getTerritoryOwner,
  parseMapQuery,
  searchSystems,
  toMapQuery
} from './starmap';

// Criterios de aceptación de docs/specs/mapa-estelar.md (issue #61).
const data = starmapData as unknown as StarmapData;
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

  it('el control deslizante pasa de días a fechas sin perder ninguna', () => {
    expect(daysToDate(dateToDays('3042-01-21'))).toBe('3042-01-21');
    expect(dateToDays('3015-01-02') - dateToDays('3015-01-01')).toBe(1);
    expect(daysToDate(dateToDays('3048-02-28') + 1)).toBe('3048-02-29');
    expect(getCurrentEvent(data.events, '3049-06-01')?.name).toMatch(/Clan Invasion/);
    expect(getCurrentEvent(data.events, '3020-01-01')).toBeNull();
  });

  it('las facciones llevan el logo del juego, y cada logo existe', () => {
    expect(data.factions.Davion.logo).toBe('Faction_Davion_1024PX_STD_UIX.png');
    expect(data.factions.ClanWolf.logo).toBeDefined();
    const logos = Object.values(data.factions).flatMap(faction => (faction.logo ? [faction.logo] : []));
    const files = Object.keys(import.meta.glob('../../public/starmap/logos/*.png')).map(path => path.split('/').at(-1));
    expect(logos.every(logo => files.includes(logo))).toBe(true);
    // Arc-Royal no tiene asset en el juego: se queda con las siglas.
    expect(data.factions.ArcRoyalDefenseCordon.logo).toBeUndefined();
  });

  it('la ficha da la distancia a Terra en años luz, no las coordenadas', () => {
    expect(system('Terra')).toMatchObject({ x: 0, y: 0 });
    expect(getDistanceToTerra(system('Terra'))).toBe(0);
    expect(getDistanceToTerra(system('Tharkad'))).toBe(264);
  });

  it('al saltar de un evento a otro se sabe qué sistemas cambian de dueño', () => {
    const changes = getOwnerChanges(data.systems, '3049-12-31', '3050-04-01');
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(changed => getOwnerAt(changed, '3049-12-31') !== getOwnerAt(changed, '3050-04-01'))).toBe(true);
    expect(changes.some(changed => getOwnerAt(changed, '3050-04-01')?.startsWith('Clan'))).toBe(true);
    // Tukayyid cae ante Ghost Bear y vuelve a Rasalhague entre esas dos fechas: no cuenta como cambio.
    expect(getOwnerChanges(data.systems, '3052-04-30', '3052-06-01').map(changed => changed.name)).not.toContain('Tukayyid');
    expect(getOwnerChanges(data.systems, '3042-01-21', '3042-01-21')).toEqual([]);
  });

  it('la leyenda cuenta los sistemas de cada facción, de mayor a menor', () => {
    const counts = countSystemsByOwner(data.systems, '3015-01-01');
    expect(counts.slice(0, 5).map(([faction]) => faction).sort()).toEqual(['Davion', 'Kurita', 'Liao', 'Marik', 'Steiner']);
    expect(counts.map(([, count]) => count)).toEqual([...counts.map(([, count]) => count)].sort((a, b) => b - a));
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
    const startsWithText = searchSystems(data.systems, 'new', 100).map(result => result.name.toLowerCase().startsWith('new'));
    expect(startsWithText).toContain(true);
    expect(startsWithText).toContain(false);
    expect(startsWithText).toEqual([...startsWithText].sort((a, b) => Number(b) - Number(a)));
    expect(searchSystems(data.systems, '')).toEqual([]);
  });

  it('CA10: un punto junto a Tharkad es de su dueño y uno lejos de todo, de nadie', () => {
    const tharkad = system('Tharkad');
    const index = buildTerritoryIndex(data.systems);
    expect(getTerritoryOwner(index, data.systems, tharkad.x + 1, tharkad.y + 1, '3015-01-01')).toBe('Steiner');
    expect(getTerritoryOwner(index, data.systems, 2000, 2000, '3015-01-01')).toBeNull();
  });

  it('un hueco sin sistemas rodeado de territorio es de los sistemas de su borde', () => {
    // Con el radio del mapa (renderer.ts).
    const index = buildTerritoryIndex(data.systems, { radius: 34 });
    // Entre Shimonoseki, Worrell y Unity no hay ningún sistema a menos de 34 años luz.
    expect(getTerritoryOwner(index, data.systems, 257, 254, '3025-06-01')).toBe('Kurita');
    // Junto a Campoleone, entre Marik, la Marian Hegemony y la periferia.
    expect(getTerritoryOwner(index, data.systems, -349, -324, '3025-06-01')).not.toBeNull();
    // Un sistema sin dueño sigue siendo un hueco.
    const jp = system('JP-AA-632');
    expect(getTerritoryOwner(index, data.systems, jp.x, jp.y, '3025-06-01')).toBeNull();
  });

  it('el contorno de cada facción rodea sus sistemas y deja fuera los de otras', () => {
    const index = buildTerritoryIndex(data.systems);
    const contours = getTerritoryContours(index, data.systems, '3015-01-01');
    // Regla par-impar: un punto está dentro si cruza un número impar de lados.
    const inside = (loops: [number, number][][], [x, y]: [number, number]) => loops.reduce((count, loop) => count + loop.filter(([ax, ay], i) => {
      const [bx, by] = loop[(i + 1) % loop.length];
      return (ay > y) !== (by > y) && x < ax + ((y - ay) * (bx - ax)) / (by - ay);
    }).length, 0) % 2 === 1;
    const tharkad = system('Tharkad');
    const luthien = system('Luthien');
    expect(inside(contours.get('Steiner')!, [tharkad.x, tharkad.y])).toBe(true);
    expect(inside(contours.get('Steiner')!, [luthien.x, luthien.y])).toBe(false);
    expect(inside(contours.get('Kurita')!, [luthien.x, luthien.y])).toBe(true);
  });

  it('los centros industriales unen sus estrellas con las líneas de la malla del juego', () => {
    const diboll = getHubs(data).find(hub => hub.capital.name === 'Diboll')!;
    expect(data.hubs[diboll.id].links).toHaveLength(6);
    expect(data.hubs[diboll.id].links).toContainEqual([diboll.capital.id, system('Broaddus').id]);
    const members = new Set(diboll.systems.map(member => member.id));
    expect(data.hubs[diboll.id].links.flat().every(id => members.has(id))).toBe(true);
  });

  it('CA13: la fecha y el sistema se leen y se escriben en la URL', () => {
    expect(parseMapQuery('?date=3042-01-21&system=Tukayyid', data)).toEqual({ date: '3042-01-21', systemId: system('Tukayyid').id });
    expect(parseMapQuery('?date=ayer&system=Not%20a%20system', data)).toEqual({ date: '3015-01-01', systemId: null });
    expect(parseMapQuery('?date=3099-01-01', data).date).toBe('3060-12-31');
    expect(toMapQuery({ date: '3042-01-21', systemId: system('Tukayyid').id }, data)).toBe('?date=3042-01-21&system=Tukayyid');
  });
});

// Criterios de aceptación de docs/specs/reputacion-zonas.md (issue #72).
describe('reputación recomendada y dificultad de las zonas', () => {
  it('CA1: Liao/Davion Border pide reputación 8 en campaña y 3-6 en carrera', () => {
    expect(getClusterLevels(data, 'DavionBorder')).toEqual([
      { mode: 'campaign', reputation: '8', difficulty: 45 },
      { mode: 'career', reputation: '3-6', difficulty: 20 }
    ]);
  });

  it('CA2: Rasalhague Outer Reaches tiene dos niveles distintos en carrera', () => {
    expect(getClusterLevels(data, 'RasalagueReaches')).toEqual([
      { mode: 'campaign', reputation: '13-15', difficulty: 100 },
      { mode: 'career', reputation: '1-3', difficulty: 9 },
      { mode: 'career', reputation: '7-10', difficulty: 60 }
    ]);
  });

  it('CA3: una zona solo de carrera tiene un único nivel de carrera', () => {
    expect(data.clusters.CareerCluster_3.name).toBe('Border Protectorate Region');
    expect(getClusterLevels(data, 'CareerCluster_3')).toEqual([{ mode: 'career', reputation: '15', difficulty: 100 }]);
  });

  it('CA4: Barcelona tiene reputación sin dificultad y Sarna no tiene niveles', () => {
    expect(getClusterLevels(data, 'Barcelona')).toEqual([{ mode: null, reputation: '8', difficulty: null }]);
    expect(getClusterLevels(data, 'Sarna')).toEqual([]);
  });

  it('CA5: el centro industrial de Diboll solo pide reputación en carrera', () => {
    expect(getHubLevels(data, 'SafeZone_1')).toEqual([
      { mode: 'campaign', reputation: null, difficulty: 7 },
      { mode: 'career', reputation: '1-2', difficulty: 7 }
    ]);
  });

  it('CA6: todas las zonas de más de un sistema tienen reputación recomendada', () => {
    const sinReputacion = Object.keys(data.clusters).filter(id =>
      data.systems.filter(candidate => candidate.cluster === id).length > 1 &&
      !getClusterLevels(data, id).some(level => level.reputation));
    expect(sinReputacion).toEqual([]);
  });

  it('CA7: todos los centros industriales tienen dificultad', () => {
    const sinDificultad = Object.keys(data.hubs).filter(id => !getHubLevels(data, id).some(level => level.difficulty !== null));
    expect(sinDificultad).toEqual([]);
  });

  it('CA8: el nivel se describe con la reputación y la dificultad que tenga', () => {
    expect(describeZoneLevel({ mode: 'campaign', reputation: '8', difficulty: 45 })).toBe('Recommended reputation 8 · Difficulty 45');
    expect(describeZoneLevel({ mode: 'campaign', reputation: null, difficulty: 7 })).toBe('Difficulty 7');
  });

  it('CA9: Taurian Corridor y Outworlds Border tienen cada uno su nombre', () => {
    expect(data.clusters.TaurianCorridor.name).toBe('Taurian Corridor');
    expect(data.clusters.OutworldsBorder.name).toBe('Outworlds Alliance Border');
  });

  it('si los modos dan lo mismo, queda un solo nivel sin modo', () => {
    const zona = { ...data, clusters: { Prueba: { name: 'Prueba', levels: [
      { mode: 'campaign' as const, reputation: '5', difficulty: 15 },
      { mode: 'career' as const, reputation: '5', difficulty: 15 }
    ] } } };
    expect(getClusterLevels(zona, 'Prueba')).toEqual([{ mode: null, reputation: '5', difficulty: 15 }]);
  });
});
