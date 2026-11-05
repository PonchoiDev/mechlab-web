import type { AvailabilityData, CampaignReward, GameDate, Market, MechAvailability, Quest, Rarity, StarmapData, UniqueMech } from '../types/starmap';
import { getQuestRoute } from './quests';
import { countSystemsByOwner, getOwnerAt, normalize } from './starmap';

// Con pocos sistemas, la ficha los nombra: su color apenas se ve con el mapa entero.
const SMALL_FACTION_SYSTEMS = 5;
// Si las facciones que la venden suman pocos sistemas, el mapa los encuadra al elegir la variante.
const FOCUS_SYSTEMS = 30;

export const RARITY_ORDER: Rarity[] = ['veryCommon', 'common', 'uncommon', 'rare', 'veryRare', 'unique', 'unavailable'];

export const RARITY_NAMES: Record<Rarity, string> = {
  veryCommon: 'Very common',
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  veryRare: 'Very rare',
  unique: 'Unique',
  unavailable: 'Unavailable'
};

// Las facciones menores no tienen tabla propia y usan la de su alianza (Canopus, la de Periphery).
export const getFactionTable = (availability: AvailabilityData, factionId: string): string | null =>
  availability.factions[factionId] ?? null;

// Rareza en el mercado de una facción del mapa; null si esa facción no la vende.
export const getMarketRarity = (availability: AvailabilityData, mech: MechAvailability, factionId: string): Rarity | null => {
  const table = getFactionTable(availability, factionId);
  return table ? mech.rarity[table] ?? null : null;
};

export const isProduced = (mech: MechAvailability, date: GameDate): boolean => mech.from <= date;

export interface RarityGroup {
  rarity: Rarity | null;
  factions: { id: string; systems: number; systemIds?: number[] }[];
}

// Facciones con sistemas en la fecha, agrupadas de más a menos común; las que no la venden, al final.
export const getAvailabilityAt = (data: StarmapData, availability: AvailabilityData, mech: MechAvailability, date: GameDate): RarityGroup[] => {
  const groups = new Map<Rarity | null, RarityGroup['factions']>();
  for (const [id, systems] of countSystemsByOwner(data.systems, date)) {
    const rarity = getMarketRarity(availability, mech, id);
    const entry = systems <= SMALL_FACTION_SYSTEMS
      ? { id, systems, systemIds: data.systems.filter(system => getOwnerAt(system, date) === id).map(system => system.id) }
      : { id, systems };
    groups.set(rarity, [...(groups.get(rarity) ?? []), entry]);
  }
  return [...RARITY_ORDER, null].flatMap(rarity => {
    const factions = groups.get(rarity);
    return factions ? [{ rarity, factions }] : [];
  });
};

export interface FixedSources {
  quests: Quest[];
  markets: Market[];
  uniques: UniqueMech[];
  rewards: CampaignReward[];
}

// Sitios donde se consigue siempre: recompensa de una HRQ, mercado especial, 'Mech único colocado o
// recompensa de una misión que no es una HRQ.
export const getFixedSources = (data: StarmapData, mechId: string): FixedSources => ({
  quests: data.quests.filter(quest => quest.rewards.some(reward => reward.mechs.some(entry => entry.id === mechId))),
  markets: data.markets.filter(market => market.mechs.some(entry => entry.id === mechId)),
  uniques: data.uniqueMechs.filter(unique => unique.mech === mechId),
  rewards: data.rewards.filter(reward => reward.mechs.some(entry => entry.id === mechId))
});

export const countSources = ({ quests, markets, uniques, rewards }: FixedSources) => quests.length + markets.length + uniques.length + rewards.length;

// Cómo se consigue una recompensa fuera de las HRQ, también si no está en el mapa ni es una misión.
export const describeRewardSource = (reward: CampaignReward): string => {
  const dlc = reward.dlc ? ` (DLC ${reward.dlc})` : '';
  switch (reward.kind) {
    case 'promotion':
      // Con sistema, la ficha añade el sistema detrás: «… when you arrive at Valentina».
      return `${reward.partner} promotion${reward.careerOnly ? ', career mode only' : ''}: arrives as a message (${reward.title})${reward.system === undefined ? '' : ' when you arrive'}`;
    case 'intel':
      return `Reach Bounty Hunter intel level ${reward.level}${dlc}`;
    case 'arenaRank':
      return `Reach the ${reward.title} fame rank in the Solaris arenas${dlc}`;
    case 'campaignComplete':
      return `Complete the DLC ${reward.dlc} campaign (${reward.title})`;
    default:
      return `Mission reward: ${reward.title}${dlc}`;
  }
};

type OnePlaceMech = { mech: MechAvailability; sources: FixedSources };

// 'Mechs de un solo sitio: no salen a la venta como hero y tienen una fuente fija. Los hero, y aparte
// las variantes especiales que no vende ninguna facción (el Wolverine de Razer).
export const getOnePlaceMechs = (data: StarmapData, availability: AvailabilityData): { heroes: OnePlaceMech[]; special: OnePlaceMech[] } => {
  const entries = availability.mechs
    .filter(mech => !mech.heroMarket && (mech.hero || Object.keys(mech.rarity).length === 0))
    .map(mech => ({ mech, sources: getFixedSources(data, mech.id) }))
    .filter(({ sources }) => countSources(sources) > 0)
    .sort((a, b) => a.mech.name.localeCompare(b.mech.name) || a.mech.id.localeCompare(b.mech.id));
  return { heroes: entries.filter(({ mech }) => mech.hero), special: entries.filter(({ mech }) => !mech.hero) };
};

// Qué encuadrar al elegir una variante. Un hero con fuente fija, o una variante que no vende nadie, se
// consigue en su HRQ (con la ruta marcada) o en su sistema; si la venden facciones pequeñas, sus
// sistemas. Si se vende en todas partes, nada: ya se ve con el mapa entero.
export const getMechFocus = (data: StarmapData, availability: AvailabilityData, mech: MechAvailability, date: GameDate): { systemIds: number[]; questId: string | null } => {
  const selling = isProduced(mech, date)
    ? data.systems.filter(system => {
      const owner = getOwnerAt(system, date);
      const rarity = owner ? getMarketRarity(availability, mech, owner) : null;
      return rarity !== null && rarity !== 'unavailable';
    })
    : [];
  const sources = getFixedSources(data, mech.id);
  if ((mech.hero || selling.length === 0) && countSources(sources) > 0) {
    const [quest] = sources.quests;
    if (quest) return { systemIds: getQuestRoute(quest), questId: quest.id };
    const systems = [...sources.uniques, ...sources.markets, ...sources.rewards].flatMap(source => (source.system === undefined ? [] : [source.system]));
    return { systemIds: [...new Set(systems)], questId: null };
  }
  return { systemIds: selling.length <= FOCUS_SYSTEMS ? selling.map(system => system.id) : [], questId: null };
};

// Primero las variantes cuyo id empieza por el texto, después las que lo contienen y después por nombre.
// Con fecha, solo las variantes que ya existen: buscar una que todavía no existe confunde.
export const searchMechs = (availability: AvailabilityData, query: string, date?: GameDate, limit = 30): MechAvailability[] => {
  const needle = normalize(query);
  if (!needle) return [];
  const score = (mech: MechAvailability) => {
    const id = normalize(mech.id);
    if (id === needle) return 0;
    if (id.startsWith(needle)) return 1;
    const names = [mech.name, mech.otherName ?? ''].map(normalize);
    if (names.some(name => name.startsWith(needle))) return 2;
    if (id.includes(needle) || names.some(name => name.includes(needle))) return 3;
    return -1;
  };
  return availability.mechs
    .filter(mech => !date || isProduced(mech, date))
    .map(mech => ({ mech, score: score(mech) }))
    .filter(({ score: value }) => value >= 0)
    .sort((a, b) => a.score - b.score || a.mech.name.localeCompare(b.mech.name) || a.mech.id.localeCompare(b.mech.id))
    .slice(0, limit)
    .map(({ mech }) => mech);
};

// Variantes que coinciden con la búsqueda pero entran en producción después de la fecha del mapa, y la
// fecha de la siguiente: la lista filtrada por fecha no debe hacer creer que no hay más.
export const getLaterVariants = (availability: AvailabilityData, query: string, date: GameDate): { count: number; next: GameDate | null } => {
  const later = searchMechs(availability, query, undefined, Infinity).filter(mech => !isProduced(mech, date));
  return {
    count: later.length,
    next: later.reduce<GameDate | null>((next, mech) => (next === null || mech.from < next ? mech.from : next), null)
  };
};

export const parseMechQuery = (search: string, availability: AvailabilityData): string | null => {
  const id = new URLSearchParams(search).get('mech');
  return id && availability.mechs.some(mech => mech.id === id) ? id : null;
};
