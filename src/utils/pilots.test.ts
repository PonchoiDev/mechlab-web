import { describe, expect, it } from 'vitest';
import pilotsJson from '../data/pilots.json';
import type { PilotTrait, PilotsData } from '../types/pilots';
import { filterTraits, parsePilotsQuery, toPilotsQuery } from './pilots';

// Criterios de aceptación de docs/specs/pagina-pilotos.md (issue #79).
const data = pilotsJson as unknown as PilotsData;
const trait = (name: string) => {
  const found = data.traits.find(candidate => candidate.name === name);
  if (!found) throw new Error(`${name} no está en pilots.json`);
  return found;
};
const group = (found: PilotTrait, scope: string) => {
  const match = found.groups.find(candidate => candidate.scope === scope);
  if (!match) throw new Error(`${found.name} no tiene efectos «${scope}»`);
  return match;
};
const effects = (found: PilotTrait, scope: string) =>
  group(found, scope).effects.map(effect => [effect.value, effect.label, effect.good]);
const names = (traits: PilotTrait[]) => traits.map(candidate => candidate.name);
const ALL = { category: 'all', heroOnly: false, query: '' } as const;

describe('rasgos de piloto', () => {
  it('CA1: hay 184 rasgos con los textos rellenados y algún efecto', () => {
    expect(data.traits).toHaveLength(184);
    expect(data.traits.every(candidate => !/[{}]/.test(candidate.name) && !/[{}]/.test(candidate.description ?? ''))).toBe(true);
    expect(data.traits.every(candidate => candidate.groups.length > 0 && candidate.groups.every(entry => entry.effects.length > 0))).toBe(true);
    const counts = Object.fromEntries(['mech', 'weapon', 'faction', 'career', 'graduate']
      .map(category => [category, data.traits.filter(candidate => candidate.category === category).length]));
    expect(counts).toEqual({ mech: 99, weapon: 35, faction: 24, career: 21, graduate: 5 });
    expect(data.traits.filter(candidate => candidate.hero)).toHaveLength(53);
  });

  it('CA2: la afinidad con el Atlas', () => {
    const atlas = trait("Atlas 'Mech Affinity");
    expect(effects(atlas, "While piloting Atlas 'Mechs")).toEqual([
      ['+10%', 'Top speed', true], ['+10%', 'Torso twist speed', true], ['+10%', 'Turn speed', true], ['+10%', 'Sensor range', true]
    ]);
    expect(atlas).toEqual(expect.objectContaining({ category: 'mech', hireable: true, trainable: true, hero: false }));
  });

  it('CA3: el experto en AC/10, con la nota de las armas que también cubre', () => {
    const expert = trait('AC/10 Expert');
    expect(group(expert, 'With AC/10').note).toBe('(Also applies to LB 10-X AC and UAC/10)');
    expect(effects(expert, 'With AC/10')).toEqual([['+5%', 'Range', true], ['+5%', 'Projectile speed', true], ['-5%', 'Spread', true]]);
  });

  it('CA4: un rasgo negativo, con efectos buenos y malos', () => {
    const hypochondriac = trait('Hypochondriac');
    expect(hypochondriac.negative).toBe(true);
    expect(effects(hypochondriac, 'Pilot')).toEqual([['-10%', 'Hiring cost', true], ['-10%', 'Salary', true], ['+15%', 'Injury chance', false]]);
  });

  it('CA5: los efectos de un noble se aplican en los contratos y en el espacio de su facción', () => {
    const noble = trait('House Davion Noble');
    expect(effects(noble, 'On contracts for House Davion')).toEqual([['+5%', 'Contract C-Bills', true]]);
    expect(effects(noble, 'In House Davion space')).toEqual([['-5%', 'Market prices', true]]);
    expect(effects(noble, 'Pilot')).toEqual([['+15%', 'Hiring cost', false], ['+15%', 'Salary', false]]);
  });

  it('CA6: solo cuentan los componentes que usa el rasgo', () => {
    const discipline = trait('Trigger Discipline');
    expect(effects(discipline, 'With Ultra Autocannon')).toEqual([
      ['-25%', 'Jam chance', true], ['-20%', 'Minimum cooldown', true], ['+25', 'Shots before jamming', true]
    ]);
    expect(discipline.groups.map(entry => entry.scope)).toEqual(['With Ultra Autocannon', 'Pilot']);
  });

  it('CA7: un rasgo hero de un DLC, con su fecha', () => {
    expect(trait("Daishi 'Mech Affinity")).toEqual(expect.objectContaining({ hero: true, dlc: 7, available: '3054-01-01' }));
  });

  it('CA8: se filtra por categoría y por hero, y se busca por nombre o por efecto', () => {
    expect(filterTraits(data.traits, { ...ALL, category: 'weapon' })).toHaveLength(35);
    expect(filterTraits(data.traits, { ...ALL, heroOnly: true })).toHaveLength(53);
    expect(names(filterTraits(data.traits, { ...ALL, query: 'atlas' }))).toEqual(["Atlas 'Mech Affinity"]);
    expect(names(filterTraits(data.traits, { ...ALL, query: 'JAM' }))).toEqual(['Trigger Discipline']);
  });
});

describe('programas de entrenamiento', () => {
  it('CA9: los programas y las academias que los ofrecen', () => {
    expect(data.programs).toHaveLength(29);
    const fullYear = data.programs.find(program => program.id === 'FullYearEnrollment1');
    expect(fullYear?.academies).toHaveLength(28);
    expect(fullYear?.academies.map(academy => academy.name)).toContain('Aitutaki Academy');
    const remedial = data.programs.find(program => program.id === 'RemedialSimpodTraining');
    expect(remedial?.academies).toHaveLength(24);
    expect(remedial?.academies.every(academy => academy.name === 'Virtual World Center')).toBe(true);
  });
});

describe('vista en la URL', () => {
  it('CA10: guarda y lee la pestaña, la categoría, el filtro hero y la búsqueda', () => {
    const view = { tab: 'traits', category: 'weapon', heroOnly: true, query: 'laser' } as const;
    const query = toPilotsQuery(view);
    expect(query).toBe('?category=weapon&hero=1&q=laser');
    expect(parsePilotsQuery(query)).toEqual(view);
    expect(toPilotsQuery({ tab: 'programs', category: 'all', heroOnly: false, query: '' })).toBe('?tab=programs');
    expect(parsePilotsQuery('?tab=nope&category=nope&hero=x')).toEqual({ tab: 'traits', category: 'all', heroOnly: false, query: '' });
  });
});
