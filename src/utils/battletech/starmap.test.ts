import { describe, expect, it } from 'vitest';
import starmapData from '../../data/battletech/starmap.json';
import type { BtStarmapData } from '../../types/battletech';
import { searchSystems } from '../starmap';
import {
  ANY_FACTION_STORE, BLACK_MARKET, NEUTRAL_COLOR, NO_FILTERS, getActiveFactions, getFactionEmblems, getFilterOptions,
  getLegend, getMatchingSystems, getSkulls, groupTags, parseBtFilters, parseBtQuery, toBtQuery
} from './starmap';

// Criterios de aceptación de docs/specs/battletech-mapa.md (issue #103 y el aspecto del juego).
const data = starmapData as unknown as BtStarmapData;
const system = (name: string) => {
  const found = data.systems.find(candidate => candidate.name === name);
  if (!found) throw new Error(`${name} no está en el mapa de BATTLETECH`);
  return found;
};
const details = (name: string) => data.details[system(name).id];

describe('mapa estelar de BATTLETECH', () => {
  it('CA1: los 219 sistemas del modo carrera, con dueño, coordenadas y detalles', () => {
    expect(data.systems).toHaveLength(219);
    expect(new Set(data.systems.map(candidate => candidate.name)).size).toBe(219);
    expect(data.systems.every(candidate => candidate.owners.length === 1 && Number.isFinite(candidate.x) && Number.isFinite(candidate.y))).toBe(true);
    expect(data.systems.every(candidate => data.details[candidate.id] !== undefined)).toBe(true);
  });

  it('CA2: la leyenda cuenta los sistemas de cada facción, de más a menos', () => {
    expect(getLegend(data).map(entry => [entry.name, entry.count])).toEqual([
      ['Capellan Confederation', 63],
      ['Planetary Government', 36],
      ['Taurian Concordat', 31],
      ['Free Worlds League', 24],
      ['Arano Restoration', 23],
      ['Federated Suns', 23],
      ['Abandoned', 11],
      ['Magistracy of Canopus', 8]
    ]);
  });

  it('CA3: Addasar, con su dificultad, su mercado negro, sus contratos y sus etiquetas', () => {
    expect(system('Addasar').owners[0][1]).toBe('MagistracyOfCanopus');
    const addasar = details('Addasar');
    expect(addasar).toMatchObject({ difficulty: 6, blackMarket: true, factionStore: null });
    expect(addasar.employers).toEqual(['Liao', 'MagistracyOfCanopus']);
    const groups = Object.fromEntries(groupTags(addasar.tags).map(group => [group.label, group.tags.map(tag => tag.name)]));
    expect(groups.Climate).toEqual(['Arctic World']);
    expect(groups.Size).toEqual(['Medium Gravity Planet']);
    expect(groups.Industry).toEqual(['Mining']);
    expect(addasar.tags.some(tag => /^planet_(name|faction|progress)_/.test(tag.id))).toBe(false);
  });

  it('CA4: Aea es de la Arano Restoration, como en carrera', () => {
    expect(system('Aea').owners[0][1]).toBe('AuriganRestoration');
  });

  it('CA5: se buscan sistemas sin distinguir tildes', () => {
    expect(searchSystems(data.systems, 'addas').map(candidate => candidate.name)).toEqual(['Addasar']);
    expect(searchSystems(data.systems, 'ur cruinne').map(candidate => candidate.name)).toEqual(['Úr Cruinne']);
  });

  it('CA6: el sistema elegido va en la URL', () => {
    expect(parseBtQuery('?system=Addasar', data)).toBe(system('Addasar').id);
    expect(parseBtQuery('?system=Terra', data)).toBeNull();
    expect(toBtQuery(system('Addasar').id, data)).toBe('?system=Addasar');
    expect(toBtQuery(null, data)).toBe('');
  });

  it('CA7: todas las facciones tienen color, y Locals y NoFaction el gris neutro', () => {
    expect(Object.values(data.factions).every(faction => /^#[0-9a-f]{6}$/.test(faction.color))).toBe(true);
    expect(data.factions.Locals.color).toBe(NEUTRAL_COLOR);
    expect(data.factions.NoFaction.color).toBe(NEUTRAL_COLOR);
  });

  it('CA8: el logo de cada facción en el centro de su territorio, más grande cuanto más grande es', () => {
    const emblems = getFactionEmblems(data);
    const factions = emblems.map(emblem => emblem.faction);
    expect(new Set(factions).size).toBe(factions.length);
    expect(factions).toEqual(expect.arrayContaining(['Liao', 'TaurianConcordat', 'Marik', 'AuriganRestoration', 'Davion', 'MagistracyOfCanopus']));
    for (const emblem of emblems) {
      expect(emblem.logo).toBe(data.factions[emblem.faction].logo);
      const nearest = data.systems.reduce((best, system) =>
        Math.hypot(system.x - emblem.x, system.y - emblem.y) < Math.hypot(best.x - emblem.x, best.y - emblem.y) ? system : best);
      expect(nearest.owners[0][1]).toBe(emblem.faction);
    }
    const size = (faction: string) => emblems.find(emblem => emblem.faction === faction)!.size;
    expect(size('Liao')).toBeGreaterThan(size('MagistracyOfCanopus'));
  });

  it('CA9: la dificultad en calaveras, media por punto, como Yuris en el juego', () => {
    expect(details('Yuris').difficulty).toBe(7);
    expect(getSkulls(7)).toEqual(['full', 'full', 'full', 'half', 'empty']);
    expect(getSkulls(1)).toEqual(['half', 'empty', 'empty', 'empty', 'empty']);
    expect(getSkulls(2)).toEqual(['full', 'empty', 'empty', 'empty', 'empty']);
    expect(getSkulls(10)).toEqual(['full', 'full', 'full', 'full', 'full']);
  });

  it('CA10: las opciones de los filtros salen de los datos', () => {
    const options = getFilterOptions(data);
    expect(options.difficulties).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(options.biomes).toHaveLength(12);
    expect(options.biomes).toEqual([...options.biomes].sort((a, b) => a.localeCompare(b)));
    expect(options.biomes).toContain('Urban');
    // Mercado negro, cualquier tienda de facción y después cada facción con tienda, por nombre.
    expect(options.stores.map(store => store.value)).toEqual([
      BLACK_MARKET, ANY_FACTION_STORE, 'Liao', 'Kurita', 'Davion', 'Marik', 'Steiner', 'MagistracyOfCanopus', 'TaurianConcordat'
    ]);
    expect(options.stores[0].label).toBe('Black market');
    expect(options.stores.find(store => store.value === 'Liao')?.label).toBe('Capellan Confederation store');
  });

  it('CA11: los filtros se combinan y atenúan lo que no cumple', () => {
    expect(getMatchingSystems(data, NO_FILTERS)).toBeNull();
    const byDifficulty = getMatchingSystems(data, { ...NO_FILTERS, difficulty: 7 })!;
    expect(byDifficulty.size).toBe(37);
    expect(byDifficulty.has(system('Yuris').id)).toBe(true);
    expect(getMatchingSystems(data, { ...NO_FILTERS, biome: 'Urban' })!.size).toBe(31);
    expect(getMatchingSystems(data, { ...NO_FILTERS, store: BLACK_MARKET })!.size).toBe(40);
    expect(getMatchingSystems(data, { ...NO_FILTERS, store: 'Liao' })!.size).toBe(2);
    expect(getMatchingSystems(data, { ...NO_FILTERS, store: ANY_FACTION_STORE })!.size).toBe(12);
    const both = getMatchingSystems(data, { ...NO_FILTERS, difficulty: 7, biome: 'Urban' })!;
    expect(both.size).toBeGreaterThan(0);
    for (const id of both) expect(data.details[id]).toMatchObject({ difficulty: 7, biomes: expect.arrayContaining(['Urban']) });
    expect([...byDifficulty].filter(id => data.details[id].biomes.includes('Urban'))).toHaveLength(both.size);
  });

  it('CA12: los filtros van en la URL y los valores que no existen se ignoran', () => {
    const search = '?system=Yuris&difficulty=7&biome=Urban&store=blackmarket';
    const filters = parseBtFilters(search, data);
    expect(filters).toEqual({ difficulty: 7, biome: 'Urban', store: BLACK_MARKET });
    expect(parseBtQuery(search, data)).toBe(system('Yuris').id);
    expect(toBtQuery(system('Yuris').id, data, filters)).toBe(search);
    expect(parseBtFilters('?difficulty=11&biome=Moon&store=Clans', data)).toEqual(NO_FILTERS);
    expect(parseBtFilters('?difficulty=abc', data)).toEqual(NO_FILTERS);
    const spring = { ...NO_FILTERS, biome: 'Highlands (spring)' };
    expect(parseBtFilters(toBtQuery(null, data, spring), data)).toEqual(spring);
    expect(toBtQuery(null, data, NO_FILTERS)).toBe('');
  });

  it('CA13: la ficha de Yuris, con su planeta y sus facciones activas', () => {
    expect(details('Yuris').planet).toBe('planet_climate_terran.png');
    expect(data.systems.every(candidate => data.details[candidate.id].planet !== null)).toBe(true);
    const factions = getActiveFactions(data, details('Yuris'));
    expect(factions.map(faction => faction.id)).toEqual([
      'Marik', 'Kurita', 'Davion', 'Liao', 'Steiner', 'TaurianConcordat',
      'AuriganDirectorate', 'MagistracyOfCanopus', 'AuriganRestoration', 'ComStar', 'AuriganPirates'
    ]);
    expect(factions.filter(faction => faction.active).map(faction => faction.name)).toEqual([
      'Federated Suns', 'Capellan Confederation', 'ComStar', 'Local pirate organization'
    ]);
    expect(factions.find(faction => faction.id === 'ComStar')).toMatchObject({ employer: true, target: false });
    expect(factions.find(faction => faction.id === 'Liao')).toMatchObject({ employer: true, target: true });
  });
});
