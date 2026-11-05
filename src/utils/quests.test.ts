import { describe, expect, it } from 'vitest';
import starmapData from '../data/starmap.json';
import type { Quest, StarmapData } from '../types/starmap';
import { getQuestAvailability, getQuestRoute, getQuestsForSystem, parseQuestQuery, searchQuests } from './quests';
import { toMapQuery } from './starmap';

// Criterios de aceptación de docs/specs/misiones-hrq.md (issue #64).
const data = starmapData as unknown as StarmapData;
const systemId = (name: string) => {
  const found = data.systems.find(system => system.name === name);
  if (!found) throw new Error(`${name} no existe en starmap.json`);
  return found.id;
};
const systemName = (id: number) => data.systems.find(system => system.id === id)?.name;
const quest = (name: string): Quest => {
  const found = data.quests.find(candidate => candidate.name === name);
  if (!found) throw new Error(`La misión ${name} no existe en starmap.json`);
  return found;
};

describe('misiones de alta recompensa', () => {
  it('CA1: Bow and Arrow se ofrece en Holt y sus cuatro misiones van de Holt a Berenson', () => {
    const archer = quest('Bow and Arrow');
    expect(archer).toMatchObject({ id: 'bow-and-arrow', dlc: 1, offer: systemId('Holt') });
    expect(archer.missions.map(mission => systemName(mission.system))).toEqual(['Holt', 'Ibstock', 'Bernardo', 'Berenson']);
    expect(archer.missions[1].title).toMatch(/Pt\. ?2/);
  });

  it('CA2: Tributes for the Imperator es del DLC 2 y se juega entera en Bethonolog', () => {
    const tributes = quest('Tributes for the Imperator');
    expect(tributes).toMatchObject({ dlc: 2, offer: systemId('Bethonolog') });
    expect(tributes.missions.map(mission => systemName(mission.system))).toEqual(['Bethonolog', 'Bethonolog', 'Bethonolog']);
    expect(tributes.missions[0].summary).toMatch(/Canopian Fusiliers/);
  });

  it('CA3: Those in Need es del DLC 3, con cinco misiones en Benfled', () => {
    const hatchetman = quest('Those in Need');
    expect(hatchetman.dlc).toBe(3);
    expect(hatchetman.missions).toHaveLength(5);
    expect(hatchetman.missions.every(mission => mission.system === systemId('Benfled'))).toBe(true);
  });

  it('CA4: Pirate Hunt es de campaña y de carrera y va de Irece a Unity', () => {
    const hunt = quest('Pirate Hunt');
    expect([...hunt.modes].sort()).toEqual(['campaign', 'career']);
    expect(hunt.offer).toBe(systemId('Irece'));
    expect(hunt.missions.map(mission => systemName(mission.system))).toEqual(['Irece', 'Outer Volta', 'Unity']);
  });

  it('CA5: Return of the Rangers es solo de carrera', () => {
    const rangers = quest('Return of the Rangers');
    expect(rangers.modes).toEqual(['career']);
    expect(rangers.missions.map(mission => systemName(mission.system))).toEqual(['Rijeka', 'Mezzana', 'Acrux']);
  });

  it('CA6: los nombres no llevan la parte, no se repiten y no incluyen la historia principal', () => {
    const names = data.quests.map(candidate => candidate.name);
    expect(names.filter(name => /Pt\.?\s*\d+$/i.test(name))).toEqual([]);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain('Target of Opportunity');
    expect(names).not.toContain('The Alarion Periphery');
    expect(data.quests.length).toBeGreaterThan(50);
    expect(data.quests.every(candidate => candidate.missions.length > 0)).toBe(true);
  });
});

describe('búsqueda, sistemas, ruta y URL', () => {
  it('CA7: busca por nombre, por sistema y sin distinguir mayúsculas', () => {
    expect(searchQuests(data, 'arrow')[0].name).toBe('Bow and Arrow');
    expect(searchQuests(data, 'holt').map(found => found.name)).toContain('Bow and Arrow');
    expect(searchQuests(data, 'BETHONOLOG')[0].name).toBe('Tributes for the Imperator');
    expect(searchQuests(data, '')).toHaveLength(data.quests.length);
  });

  it('CA8: en Benfled se ofrece Those in Need', () => {
    const { offered, played } = getQuestsForSystem(data, systemId('Benfled'));
    expect(offered.map(found => found.name)).toContain('Those in Need');
    expect(played.map(found => found.name)).toContain('Those in Need');
  });

  it('CA9: la ruta de Bow and Arrow no repite Holt', () => {
    expect(getQuestRoute(quest('Bow and Arrow')).map(systemName)).toEqual(['Holt', 'Ibstock', 'Bernardo', 'Berenson']);
  });

  it('CA10: la HRQ elegida va en la URL', () => {
    expect(parseQuestQuery('?quest=bow-and-arrow', data)).toBe('bow-and-arrow');
    expect(parseQuestQuery('?quest=no-existe', data)).toBeNull();
    expect(toMapQuery({ date: '3042-01-21', systemId: null, questId: 'bow-and-arrow' }, data)).toBe('?date=3042-01-21&quest=bow-and-arrow');
  });
});

// Criterios de aceptación de docs/specs/condiciones-hrq.md (issue #68).
describe('condiciones de las HRQ', () => {
  it('CA1: Bow and Arrow pide reputación 8 y se ofrece desde el 20 de diciembre de 3023', () => {
    expect(quest('Bow and Arrow').requirements).toEqual([{ mode: null, reputation: 8, from: '3023-12-20', until: null }]);
  });

  it('CA2: The False Flag pide 10 en campaña y 12 en carrera, sin fecha', () => {
    const requirements = quest('The False Flag').requirements;
    expect(requirements).toEqual(expect.arrayContaining([
      { mode: 'campaign', reputation: 10, from: null, until: null },
      { mode: 'career', reputation: 12, from: null, until: null }
    ]));
    expect(requirements).toHaveLength(2);
  });

  it('CA3: Adam Steiner solo se ofrece entre junio y diciembre de 3055', () => {
    const adam = quest('Adam Steiner');
    expect(adam.requirements[0]).toMatchObject({ from: '3055-06-20', until: '3055-12-15' });
    expect(getQuestAvailability(adam, '3055-01-01')).toEqual({ state: 'upcoming', date: '3055-06-20' });
    expect(getQuestAvailability(adam, '3055-07-01')).toEqual({ state: 'available' });
    expect(getQuestAvailability(adam, '3056-01-01')).toEqual({ state: 'expired', date: '3055-12-15' });
  });

  it('CA4: Tributes for the Imperator no se ofrece hasta 3020', () => {
    const tributes = quest('Tributes for the Imperator');
    expect(getQuestAvailability(tributes, '3019-01-01').state).toBe('upcoming');
    expect(getQuestAvailability(tributes, '3021-01-01').state).toBe('available');
    expect(tributes.requirements[0].reputation).toBe(5);
  });

  it('CA5: Pirate Hunt no tiene fecha y se ofrece desde el principio', () => {
    expect(getQuestAvailability(quest('Pirate Hunt'), '3015-01-01').state).toBe('available');
  });

  it('CA6: todas tienen alguna condición, y solo Adam Steiner y Guerrero no piden reputación', () => {
    const hasCondition = (candidate: Quest) => candidate.requirements.some(requirement => requirement.reputation !== null || requirement.from !== null);
    expect(data.quests.filter(candidate => !hasCondition(candidate)).map(candidate => candidate.name)).toEqual([]);
    const withoutReputation = data.quests.filter(candidate => !candidate.requirements.some(requirement => requirement.reputation !== null));
    expect(withoutReputation.map(candidate => candidate.name).sort()).toEqual(['Adam Steiner', 'Ideals of War']);
  });
});
