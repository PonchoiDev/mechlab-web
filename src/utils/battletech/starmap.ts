import type { BtStarmapData, BtSystemDetails, BtTag } from '../../types/battletech';
import { getFactionEmblems as getEmblemsAt, normalize, type FactionEmblem } from '../starmap';

// Gris de Locals y NoFaction, que no traen color de mapa. El mismo valor está en
// tools/generar_mapa_battletech.py.
export const NEUTRAL_COLOR = '#9aa3b2';

// Grupos de etiquetas de la ficha de un sistema, por el prefijo de su id.
const TAG_GROUPS: { prefix: string; label: string }[] = [
  { prefix: 'planet_climate_', label: 'Climate' },
  { prefix: 'planet_size_', label: 'Size' },
  { prefix: 'planet_pop_', label: 'Population' },
  { prefix: 'planet_civ_', label: 'Civilization' },
  { prefix: 'planet_industry_', label: 'Industry' },
  { prefix: 'planet_', label: 'Other' }
];

export const groupTags = (tags: BtTag[]): { label: string; tags: BtTag[] }[] =>
  TAG_GROUPS
    .map(({ label }, index) => ({
      label,
      // Cada etiqueta va en el primer grupo cuyo prefijo coincide: «Other» recoge lo que queda.
      tags: tags.filter(tag => TAG_GROUPS.findIndex(group => tag.id.startsWith(group.prefix)) === index)
    }))
    .filter(group => group.tags.length > 0);

// Facciones con sistemas en el mapa, de más a menos.
export const getLegend = (data: BtStarmapData): { id: string; name: string; color: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const system of data.systems) {
    const owner = system.owners[0]?.[1];
    if (owner) counts.set(owner, (counts.get(owner) ?? 0) + 1);
  }
  return [...counts]
    .map(([id, count]) => ({ id, name: data.factions[id]?.name ?? id, color: data.factions[id]?.color ?? NEUTRAL_COLOR, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

// El sistema elegido va en la URL por su nombre (?system=Addasar); uno que no existe se ignora.
export const parseBtQuery = (search: string, data: BtStarmapData): number | null => {
  const name = new URLSearchParams(search).get('system');
  if (!name) return null;
  return data.systems.find(system => normalize(system.name) === normalize(name))?.id ?? null;
};

export const toBtQuery = (systemId: number | null, data: BtStarmapData, filters: BtFilters = NO_FILTERS): string => {
  const system = systemId === null ? undefined : data.systems.find(candidate => candidate.id === systemId);
  const params = new URLSearchParams();
  if (system) params.set('system', system.name);
  if (filters.difficulty !== null) params.set('difficulty', String(filters.difficulty));
  if (filters.biome !== null) params.set('biome', filters.biome);
  if (filters.store !== null) params.set('store', filters.store);
  const query = params.toString();
  return query ? `?${query}` : '';
};

// Dificultad de carrera en calaveras, como la enseña el juego (CHALLENGE): cinco calaveras y cada punto
// de dificultad, de 1 a 10, es media. Yuris, de dificultad 7, tiene tres y media.
export type Skull = 'full' | 'half' | 'empty';
const SKULLS = 5;

export const getSkulls = (difficulty: number): Skull[] =>
  Array.from({ length: SKULLS }, (_, index) => {
    const halves = difficulty - index * 2;
    return halves >= 2 ? 'full' : halves === 1 ? 'half' : 'empty';
  });

export const skullLabel = (difficulty: number): string => {
  const skulls = difficulty / 2;
  return `${skulls} ${skulls === 1 ? 'skull' : 'skulls'}`;
};

// Filtros del mapa del juego (Difficulty Filter, Biome Filter y Store Filter). null es «No filter».
// El del juego filtra las tiendas por el equipo que suelen tener; aquí, sin su contenido, por el tipo
// de tienda: mercado negro, cualquier tienda de facción o la de una facción.
export interface BtFilters {
  difficulty: number | null;
  biome: string | null;
  store: string | null;
}

export const NO_FILTERS: BtFilters = { difficulty: null, biome: null, store: null };
export const BLACK_MARKET = 'blackmarket';
export const ANY_FACTION_STORE = 'faction';

export interface BtFilterOptions {
  difficulties: number[];
  biomes: string[];
  stores: { value: string; label: string }[];
}

export const getFilterOptions = (data: BtStarmapData): BtFilterOptions => {
  const details = Object.values(data.details);
  const factionStores = [...new Set(details.flatMap(system => (system.factionStore ? [system.factionStore] : [])))]
    .map(id => ({ value: id, label: `${data.factions[id]?.name ?? id} store` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return {
    difficulties: [...new Set(details.map(system => system.difficulty))].sort((a, b) => a - b),
    biomes: [...new Set(details.flatMap(system => system.biomes))].sort((a, b) => a.localeCompare(b)),
    stores: [
      { value: BLACK_MARKET, label: 'Black market' },
      { value: ANY_FACTION_STORE, label: 'Any faction store' },
      ...factionStores
    ]
  };
};

const matchesStore = (system: BtSystemDetails, store: string) =>
  store === BLACK_MARKET ? system.blackMarket
    : store === ANY_FACTION_STORE ? system.factionStore !== null
      : system.factionStore === store;

export const matchesFilters = (system: BtSystemDetails, filters: BtFilters): boolean =>
  (filters.difficulty === null || system.difficulty === filters.difficulty)
  && (filters.biome === null || system.biomes.includes(filters.biome))
  && (filters.store === null || matchesStore(system, filters.store));

export const hasFilters = (filters: BtFilters) => filters.difficulty !== null || filters.biome !== null || filters.store !== null;

// Sistemas que cumplen los filtros; null si no hay ninguno puesto (no se atenúa nada).
export const getMatchingSystems = (data: BtStarmapData, filters: BtFilters): Set<number> | null => {
  if (!hasFilters(filters)) return null;
  return new Set(data.systems.filter(system => matchesFilters(data.details[system.id], filters)).map(system => system.id));
};

// Los filtros van en la URL (?difficulty=7&biome=Urban&store=blackmarket); un valor que no es una
// opción se ignora.
export const parseBtFilters = (search: string, data: BtStarmapData): BtFilters => {
  const params = new URLSearchParams(search);
  const options = getFilterOptions(data);
  const difficulty = Number(params.get('difficulty'));
  const biome = params.get('biome');
  const store = params.get('store');
  return {
    difficulty: options.difficulties.includes(difficulty) ? difficulty : null,
    biome: biome !== null && options.biomes.includes(biome) ? biome : null,
    store: store !== null && options.stores.some(option => option.value === store) ? store : null
  };
};

// Facciones de ACTIVE FACTIONS, en el orden de la ficha del juego: las 11 que enseña siempre (la captura
// de Yuris) y, al final, otra que ofrezca contratos o sea el objetivo en este sistema, como el gobierno
// planetario (Locals) en los suyos. Las que lo hacen en este sistema se resaltan.
const ACTIVE_FACTION_ORDER = [
  'Marik', 'Kurita', 'Davion', 'Liao', 'Steiner', 'TaurianConcordat',
  'AuriganDirectorate', 'MagistracyOfCanopus', 'AuriganRestoration', 'ComStar', 'AuriganPirates'
];

export interface ActiveFaction {
  id: string;
  name: string;
  logo: string | null;
  employer: boolean;
  target: boolean;
  active: boolean;
}

export const getActiveFactions = (data: BtStarmapData, system: BtSystemDetails): ActiveFaction[] => {
  const shown = new Set([...ACTIVE_FACTION_ORDER, ...system.employers, ...system.targets]);
  const rank = (id: string) => {
    const index = ACTIVE_FACTION_ORDER.indexOf(id);
    return index < 0 ? ACTIVE_FACTION_ORDER.length : index;
  };
  return [...shown]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map(id => {
      const employer = system.employers.includes(id);
      const target = system.targets.includes(id);
      return { id, name: data.factions[id]?.name ?? id, logo: data.factions[id]?.logo ?? null, employer, target, active: employer || target };
    });
};

// Logos de las facciones sobre su territorio, como los pinta el juego (la lógica es la del mapa de MW5).
// El mapa de BATTLETECH tiene una sola fecha, y sus facciones, mucho más pequeñas que los Estados
// Sucesores, se quedan en 100 años luz como mucho.
const EMBLEM_MAX_SIZE = 100;

export const getFactionEmblems = (data: BtStarmapData): FactionEmblem[] =>
  getEmblemsAt(data, data.range.start, EMBLEM_MAX_SIZE);
