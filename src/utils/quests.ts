import type { GameDate, Quest, StarmapData } from '../types/starmap';
import { normalize } from './starmap';

// Busca por el nombre de la misión, por quien la encarga y por los sistemas donde se ofrece o se
// juega. Sin texto, todas, por nombre.
export const searchQuests = (data: StarmapData, query: string): Quest[] => {
  const byName = (a: Quest, b: Quest) => a.name.localeCompare(b.name);
  const needle = normalize(query);
  if (!needle) return [...data.quests].sort(byName);
  const names = new Map(data.systems.map(system => [system.id, normalize(system.name)]));
  const systemsOf = (quest: Quest) => [quest.offer, ...quest.missions.map(mission => mission.system)].map(id => names.get(id) ?? '');
  const inName = data.quests.filter(quest => normalize(quest.name).includes(needle)).sort(byName);
  const elsewhere = data.quests
    .filter(quest => !normalize(quest.name).includes(needle))
    .filter(quest => normalize(quest.employer ?? '').includes(needle) || systemsOf(quest).some(name => name.includes(needle)))
    .sort(byName);
  return [...inName, ...elsewhere];
};

export const getQuestsForSystem = (data: StarmapData, systemId: number): { offered: Quest[]; played: Quest[] } => ({
  offered: data.quests.filter(quest => quest.offer === systemId),
  played: data.quests.filter(quest => quest.missions.some(mission => mission.system === systemId))
});

// Sistemas por los que pasa la misión, en orden: la oferta y después cada misión, sin repetir el
// mismo sistema dos veces seguidas.
export const getQuestRoute = (quest: Quest): number[] =>
  [quest.offer, ...quest.missions.map(mission => mission.system)]
    .filter((system, index, route) => index === 0 || system !== route[index - 1]);

export type QuestAvailability =
  | { state: 'available' }
  | { state: 'upcoming'; date: GameDate }
  | { state: 'expired'; date: GameDate };

// Si la HRQ se ofrece en esa fecha. Con varios modos basta con que se ofrezca en uno: aún no se
// ofrece si todos tienen una fecha posterior, y ya no si todos caducaron.
export const getQuestAvailability = (quest: Quest, date: GameDate): QuestAvailability => {
  const { requirements } = quest;
  if (requirements.length && requirements.every(requirement => requirement.from !== null && requirement.from > date)) {
    return { state: 'upcoming', date: requirements.map(requirement => requirement.from!).sort()[0] };
  }
  if (requirements.length && requirements.every(requirement => requirement.until !== null && requirement.until <= date)) {
    return { state: 'expired', date: requirements.map(requirement => requirement.until!).sort().at(-1)! };
  }
  return { state: 'available' };
};

export const parseQuestQuery = (search: string, data: StarmapData): string | null => {
  const id = new URLSearchParams(search).get('quest');
  return id && data.quests.some(quest => quest.id === id) ? id : null;
};
