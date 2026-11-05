import type { AvailabilityData, GameDate, Market, MechAvailability, Quest, Rarity, StarmapData, UniqueMech } from '../types/starmap';
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
}

// Sitios donde se consigue siempre: recompensa de una HRQ, mercado especial o 'Mech único colocado.
export const getFixedSources = (data: StarmapData, mechId: string): FixedSources => ({
  quests: data.quests.filter(quest => quest.rewards.some(reward => reward.mechs.some(entry => entry.id === mechId))),
  markets: data.markets.filter(market => market.mechs.some(entry => entry.id === mechId)),
  uniques: data.uniqueMechs.filter(unique => unique.mech === mechId)
});

const hasSources = ({ quests, markets, uniques }: FixedSources) => quests.length + markets.length + uniques.length > 0;

export const getHeroMechs = (data: StarmapData, availability: AvailabilityData): { mech: MechAvailability; sources: FixedSources }[] =>
  availability.mechs
    .filter(mech => mech.hero)
    .map(mech => ({ mech, sources: getFixedSources(data, mech.id) }))
    .filter(({ sources }) => hasSources(sources))
    .sort((a, b) => a.mech.name.localeCompare(b.mech.name) || a.mech.id.localeCompare(b.mech.id));

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
  if ((mech.hero || selling.length === 0) && hasSources(sources)) {
    const [quest] = sources.quests;
    if (quest) return { systemIds: getQuestRoute(quest), questId: quest.id };
    return { systemIds: [...new Set([...sources.uniques, ...sources.markets].map(source => source.system))], questId: null };
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
    if (normalize(mech.name).startsWith(needle)) return 2;
    if (id.includes(needle) || normalize(mech.name).includes(needle)) return 3;
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

// Fecha en que entra en producción la primera variante que coincide con la búsqueda, sin mirar la
// fecha del mapa: para ofrecer ir a ella cuando todavía no existe ninguna.
export const getFirstProduction = (availability: AvailabilityData, query: string): GameDate | null =>
  searchMechs(availability, query, undefined, Infinity).reduce<GameDate | null>(
    (first, mech) => (first === null || mech.from < first ? mech.from : first),
    null
  );

export const parseMechQuery = (search: string, availability: AvailabilityData): string | null => {
  const id = new URLSearchParams(search).get('mech');
  return id && availability.mechs.some(mech => mech.id === id) ? id : null;
};
