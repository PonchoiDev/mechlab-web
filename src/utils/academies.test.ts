import { describe, expect, it } from 'vitest';
import starmapData from '../data/starmap.json';
import type { StarmapData } from '../types/starmap';
import { describeProgram, getAcademiesAt, getAcademyClosing, getSystemAcademies, groupAcademies, isAcademyOpen, parseAcademyQuery, searchAcademies } from './academies';
import { toMapQuery } from './starmap';

// Criterios de aceptación de docs/specs/academias.md (issue #79).
const data = starmapData as unknown as StarmapData;
const systemId = (name: string) => {
  const found = data.systems.find(system => system.name === name);
  if (!found) throw new Error(`${name} no existe en starmap.json`);
  return found.id;
};
const academy = (name: string) => {
  const found = data.academies.find(candidate => candidate.name === name);
  if (!found) throw new Error(`${name} no está en starmap.json`);
  return found;
};
const names = (systemName: string, date: string) =>
  getSystemAcademies(data, systemId(systemName), date).map(candidate => candidate.name).sort();

describe('academias de pilotos', () => {
  it('CA1: hay 93 academias en sistemas del mapa, con programas del catálogo', () => {
    expect(data.academies).toHaveLength(93);
    expect(data.academies.every(candidate => data.systems.some(system => system.id === candidate.system))).toBe(true);
    expect(data.academies.every(candidate => candidate.programs.length > 0 && candidate.programs.every(id => data.trainingPrograms[id]))).toBe(true);
    expect(data.academies.filter(candidate => candidate.name === 'Virtual World Center')).toHaveLength(24);
  });

  it('CA2: el New Avalon Institute of Science, con su fundación, su reputación y sus programas', () => {
    const nais = academy('New Avalon Institute of Science');
    expect(nais).toEqual(expect.objectContaining({ system: systemId('New Avalon'), founded: '3015-01-01', standing: 50 }));
    expect(nais.programs.map(id => data.trainingPrograms[id].name))
      .toEqual(['Semester Enrollment', 'Full Year Enrollment', 'Undergraduate Program', 'Graduate Program']);
  });

  it('CA3: la War College of Tamar abre en 3025 y cierra cuando el Clan Wolf toma Tamar', () => {
    const tamar = academy('War College of Tamar');
    expect(isAcademyOpen(data, tamar, '3024-12-31')).toBe(false);
    expect(isAcademyOpen(data, tamar, '3051-12-30')).toBe(true);
    expect(getAcademyClosing(data, tamar)).toBe('3051-12-31');
    expect(isAcademyOpen(data, tamar, '3051-12-31')).toBe(false);
  });

  it('CA4: la destrucción es permanente aunque el sistema deje de ser de un Clan', () => {
    const somerset = academy('The Military Academy of Somerset');
    expect(getAcademyClosing(data, somerset)).toBe('3050-06-01');
    expect(isAcademyOpen(data, somerset, '3051-01-01')).toBe(false);
  });

  it('CA5: una academia marcada que ningún Clan ocupa no cierra', () => {
    const pandora = academy('Pandora College of Military Sciences');
    expect(pandora.clanDestroyed).toBe(true);
    expect(getAcademyClosing(data, pandora)).toBeNull();
    expect(isAcademyOpen(data, pandora, '3060-01-01')).toBe(true);
  });

  it('CA6: las academias fundadas después de la fecha no están abiertas', () => {
    expect(getAcademiesAt(data, '3060-12-31').map(candidate => candidate.name)).not.toContain('Gunslinger Program');
  });

  it('CA7: las academias de un sistema en cada fecha', () => {
    expect(names('Sarna', '3025-01-01')).toEqual(['Dutchy RTC', 'Sarna Martial Academy']);
    expect(names('Sarna', '3030-01-01')).toEqual(['Dutchy RTC', 'Sarna Martial Academy', 'Sarna Military Academy']);
    expect(names('St. Ives', '3025-01-01')).toEqual(['Dutchy RTC', 'St. Ives Academy of Martial Sciences', 'Virtual World Center']);
  });

  it('CA8: las cifras de un programa', () => {
    expect(data.trainingPrograms.FullYearEnrollment1).toEqual(expect.objectContaining({
      name: 'Full Year Enrollment', days: 365, fee: 700000, tuition: 200000, skill: [15, 44], stars: { skill: 2, traits: 1, xp: 4 }
    }));
  });

  it('CA9: la descripción del programa lleva el nombre de la academia', () => {
    expect(describeProgram(data.trainingPrograms.FullYearEnrollment1, 'New Avalon Institute of Science'))
      .toBe('Year-long enrollment in New Avalon Institute of Science courses.');
  });

  it('CA10: se busca por academia o por sistema', () => {
    expect(searchAcademies(data, 'nagel', '3030-01-01').map(candidate => candidate.name)).toEqual(['The Nagelring']);
    const tukayyid = searchAcademies(data, 'tukayyid', '3060-06-01');
    expect(tukayyid.length).toBeGreaterThan(0);
    expect(tukayyid.every(candidate => candidate.system === systemId('Tukayyid'))).toBe(true);
  });
});

describe('academias en la lista y en la URL', () => {
  it('agrupa las franquicias con el mismo nombre', () => {
    const groups = groupAcademies(getAcademiesAt(data, '3025-01-01'));
    expect(groups.find(group => group.name === 'Virtual World Center')?.academies).toHaveLength(24);
    expect(groups.find(group => group.name === 'The Nagelring')?.academies).toHaveLength(1);
  });

  it('guarda la academia elegida en la URL y la lee, si existe', () => {
    const query = toMapQuery({ date: '3025-01-01', systemId: null, academyId: 'Tharkad_TheNargelring' }, data);
    expect(query).toBe('?date=3025-01-01&academy=Tharkad_TheNargelring');
    expect(parseAcademyQuery(query, data)).toBe('Tharkad_TheNargelring');
    expect(parseAcademyQuery('?academy=NoExiste', data)).toBeNull();
  });
});
