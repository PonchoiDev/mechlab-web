import { describe, expect, it } from 'vitest';
import pilotsJson from '../data/pilots.json';
import type { PilotTrait, PilotsData } from '../types/pilots';
import {
  filterTraits, formatProgramLength, getTraitEffectColumns, groupPrograms, groupTraits, parsePilotsQuery, splitHeroPilots, toPilotsQuery
} from './pilots';

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
const traitName = (id: string) => data.traits.find(candidate => candidate.id === id)?.name;
const hero = (name: string) => {
  const found = data.heroes.find(candidate => candidate.name === name);
  if (!found) throw new Error(`${name} no está entre los pilotos hero`);
  return found;
};
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

describe('secciones de rasgos', () => {
  it('CA11: cada categoría se divide en sus subgrupos, en orden', () => {
    const sections = groupTraits(data.traits);
    const summary = Object.fromEntries(sections.map(section => [
      section.category, section.groups.map(entry => [entry.label, entry.traits.length])
    ]));
    expect(summary).toEqual({
      mech: [["Light 'Mechs", 19], ["Medium 'Mechs", 25], ["Heavy 'Mechs", 26], ["Assault 'Mechs", 29]],
      weapon: [['Ballistic', 11], ['Energy', 7], ['Missile', 10], ['Artillery', 2], ['Several weapon types', 5]],
      faction: [['Nobles', 5], ['Patriots', 5], ['Criminals', 5], ['Hatred', 5], ['Clan origins', 4]],
      career: [['Combat', 6], ['Learning', 3], ['Money and health', 12]],
      graduate: [[null, 5]]
    });
    expect(sections.map(section => section.category)).toEqual(['mech', 'weapon', 'faction', 'career', 'graduate']);
    expect(sections[0].count).toBe(99);
    expect(sections[0].groups[3].traits[0].name).toBe("Assault 'Mech Affinity");
  });

  it('CA11: con un filtro solo salen las secciones con resultados', () => {
    const sections = groupTraits(filterTraits(data.traits, { ...ALL, query: 'atlas' }));
    expect(sections.map(section => [section.category, section.groups.map(entry => entry.label)])).toEqual([['mech', ["Assault 'Mechs"]]]);
  });
});

describe('columnas de efectos', () => {
  const columns = (name: string) => {
    const { combat, pilot } = getTraitEffectColumns(trait(name));
    return {
      combat: combat.map(entry => [entry.scope, entry.note ?? null, entry.effects.length]),
      pilot: pilot.map(effect => effect.label)
    };
  };

  it('CA17: los efectos en combate, con dónde se aplican solo si no es obvio, y los del piloto aparte', () => {
    expect(columns("Atlas 'Mech Affinity")).toEqual({ combat: [[null, null, 4]], pilot: [] });
    expect(columns('AC/10 Expert')).toEqual({ combat: [['With AC/10', '(Also applies to LB 10-X AC and UAC/10)', 3]], pilot: [] });
    expect(columns('House Davion Noble')).toEqual({
      combat: [['On contracts for House Davion', null, 1], ['In House Davion space', null, 1]],
      pilot: ['Hiring cost', 'Salary']
    });
    expect(columns('Hypochondriac')).toEqual({ combat: [], pilot: ['Hiring cost', 'Salary', 'Injury chance'] });
  });
});

describe('pilotos hero', () => {
  it('CA12: los de la sala de contratación y las recompensas, con rasgos que existen', () => {
    expect(data.heroes).toHaveLength(18);
    const { hiringHall, rewards } = splitHeroPilots(data.heroes);
    expect(hiringHall.map(pilot => pilot.name)).toEqual([
      'Ash Delmore', 'Barrett Nolan', 'Jacob Cave', 'Lance Gabel', 'Lyana Moore', 'Nick Lynch', 'Rachel Laird', 'Sasha Lockwood'
    ]);
    expect(rewards).toHaveLength(10);
    expect(rewards.every(pilot => pilot.rewards.length > 0)).toBe(true);
    expect(data.heroes.flatMap(pilot => pilot.traits).every(id => traitName(id) !== undefined)).toBe(true);
    const shenzeng = data.heroes.filter(pilot => pilot.name.includes('Shenzeng'));
    expect(shenzeng).toHaveLength(1);
    expect(shenzeng[0].traits.map(traitName)).toEqual(['House Liao Patriot', 'House Liao Noble']);
  });

  it('CA13: Ash Delmore', () => {
    const ash = hero('Ash Delmore');
    expect(ash).toEqual(expect.objectContaining({ dlc: 7, rank: 'Regular', hiringHall: true, hiringCost: 600000, salary: 24000 }));
    expect(ash.skills.map(skill => [skill.name, skill.level, skill.cap])).toEqual([
      ['Ballistics', 10, 10], ['Energy', 9, 10], ['Missile', 7, 10], ['Evasiveness', 9, 10], ['Shielding', 7, 10], ['Heat management', 8, 10]
    ]);
    expect(ash.traits.map(traitName)).toEqual(["Medium 'Mech Affinity", 'Laser Specialist', 'Eagle Eyes']);
    expect(ash.bio.length).toBeGreaterThan(0);
  });

  it('CA14: los reservados llegan como recompensa', () => {
    expect(hero('Morgan Trensky').rewards.map(reward => reward.title)).toEqual(['Leading the Charge']);
    expect(hero('Sam Hagel').rewards.map(reward => reward.title)).toEqual(['Smoke and Mirrors']);
    const valten = hero('Valten Ryder');
    expect(valten).toEqual(expect.objectContaining({ dlc: 8, hiringHall: false }));
    expect(valten.rewards.map(reward => reward.title)).toEqual(['A New March']);
    expect(valten.traits.map(traitName)).toEqual(["Bushwacker 'Mech Affinity", 'AC/10 Master', 'Survivor']);
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

describe('familias de programas', () => {
  it('CA15: cada familia con sus programas, y los rasgos de los de una academia', () => {
    const families = groupPrograms(data.programs, data.programFamilies);
    expect(families.map(entry => [entry.family.name, entry.programs.length])).toEqual([
      ['Simpod training', 5], ['Vocational training', 2], ['Semester enrollment', 4], ['Full year enrollment', 4],
      ['Undergraduate program', 5], ['Graduate program', 4], ['Academy graduate programs', 5]
    ]);
    expect(families[2].programs.map(program => program.label)).toEqual(['Level 1', 'Level 2', 'Level 3', 'Level 4']);
    const nais = data.programs.find(program => program.id === 'GraduateProgram_NAIS');
    expect(nais?.label).toBe('New Avalon Institute of Science');
    expect(traitName(nais?.guaranteedTrait ?? '')).toBe('NAIS Graduate');
    expect(nais?.favouredTraits.map(traitName)).toContain('Standard Autocannon Specialist');
    const graduate4 = data.programs.find(program => program.id === 'GraduateProgram4');
    expect(graduate4?.guaranteedTrait).toBeNull();
    expect(graduate4?.favouredTraits.map(traitName)).toEqual(['SRM Specialist', 'MRM Expert']);
  });

  it('CA16: la duración en días o en años', () => {
    expect(formatProgramLength(60)).toBe('60 days');
    expect(formatProgramLength(125)).toBe('125 days');
    expect(formatProgramLength(365)).toBe('1 year');
    expect(formatProgramLength(1460)).toBe('4 years');
  });
});

describe('vista en la URL', () => {
  it('CA10: guarda y lee la pestaña, la categoría, el filtro hero y la búsqueda', () => {
    const view = { tab: 'traits', category: 'weapon', heroOnly: true, query: 'laser' } as const;
    const query = toPilotsQuery(view);
    expect(query).toBe('?tab=traits&category=weapon&hero=1&q=laser');
    expect(parsePilotsQuery(query)).toEqual(view);
    expect(toPilotsQuery({ tab: 'programs', category: 'all', heroOnly: false, query: '' })).toBe('?tab=programs');
    expect(toPilotsQuery({ tab: 'heroes', category: 'all', heroOnly: false, query: '' })).toBe('');
    expect(parsePilotsQuery('?tab=nope&category=nope&hero=x')).toEqual({ tab: 'heroes', category: 'all', heroOnly: false, query: '' });
  });
});
