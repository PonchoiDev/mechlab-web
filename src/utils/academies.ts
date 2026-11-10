import type { Academy, GameDate, StarmapData, TrainingProgram } from '../types/starmap';
import { normalize } from './starmap';

// Los Clanes del mapa son las facciones cuyo id empieza por Clan (ClanWolf, ClanJadeFalcon…), igual
// que el juego, que mira la etiqueta Persona.Faction.Clan de quien controla el sistema.
const isClan = (factionId: string | null) => factionId?.startsWith('Clan') ?? false;

// Fecha en que los Clanes destruyen la academia: la primera en que uno controla su sistema. El
// juego la guarda como destruida, así que no vuelve aunque el sistema cambie otra vez de dueño.
export const getAcademyClosing = (data: StarmapData, academy: Academy): GameDate | null => {
  if (!academy.clanDestroyed) return null;
  const system = data.systems.find(candidate => candidate.id === academy.system);
  return system?.owners.find(([, owner]) => isClan(owner))?.[0] ?? null;
};

export const isAcademyOpen = (data: StarmapData, academy: Academy, date: GameDate): boolean => {
  if (academy.founded && academy.founded > date) return false;
  const closing = getAcademyClosing(data, academy);
  return !closing || date < closing;
};

export const getAcademiesAt = (data: StarmapData, date: GameDate): Academy[] =>
  data.academies.filter(academy => isAcademyOpen(data, academy, date));

export const getSystemAcademies = (data: StarmapData, systemId: number, date: GameDate): Academy[] =>
  getAcademiesAt(data, date).filter(academy => academy.system === systemId);

export const describeProgram = (program: TrainingProgram, academyName: string): string =>
  program.description.replaceAll('{AcademyName}', academyName);

// Por el nombre de la academia o el de su sistema, sin tildes ni mayúsculas.
export const searchAcademies = (data: StarmapData, query: string, date: GameDate): Academy[] => {
  const text = normalize(query);
  const systemNames = new Map(data.systems.map(system => [system.id, normalize(system.name)]));
  return getAcademiesAt(data, date)
    .filter(academy => !text || normalize(academy.name).includes(text) || (systemNames.get(academy.system) ?? '').includes(text))
    .sort((a, b) => a.name.localeCompare(b.name) || (systemNames.get(a.system) ?? '').localeCompare(systemNames.get(b.system) ?? ''));
};

// Las franquicias con el mismo nombre (24 Virtual World Center, 7 Dutchy RTC…) van en una sola
// entrada de la lista, con todos sus sistemas.
export const groupAcademies = (academies: Academy[]): { name: string; academies: Academy[] }[] => {
  const groups = new Map<string, Academy[]>();
  for (const academy of academies) groups.set(academy.name, [...(groups.get(academy.name) ?? []), academy]);
  return [...groups].map(([name, list]) => ({ name, academies: list }));
};

// ?academy=<id> en la URL, como ?quest=: solo si la academia existe.
export const parseAcademyQuery = (search: string, data: StarmapData): string | null => {
  const id = new URLSearchParams(search).get('academy');
  return id && data.academies.some(academy => academy.id === id) ? id : null;
};
