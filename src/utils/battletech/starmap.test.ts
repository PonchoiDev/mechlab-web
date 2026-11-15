import { describe, expect, it } from 'vitest';
import starmapData from '../../data/battletech/starmap.json';
import type { BtStarmapData } from '../../types/battletech';
import { searchSystems } from '../starmap';
import { NEUTRAL_COLOR, getLegend, groupTags, parseBtQuery, toBtQuery } from './starmap';

// Criterios de aceptación de docs/specs/battletech-mapa.md (issue #103).
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
});
