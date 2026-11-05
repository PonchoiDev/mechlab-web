import type { GameDate, Market, StarmapData, UniqueMech } from '../types/starmap';
import { normalize } from './starmap';

export const getMarketsForSystem = (data: StarmapData, systemId: number): Market[] =>
  data.markets.filter(market => market.system === systemId);

// Los 'Mechs únicos solo aparecen a partir de su fecha.
export const getUniqueMechsAt = (data: StarmapData, date: GameDate): UniqueMech[] =>
  data.uniqueMechs.filter(unique => unique.from <= date);

export interface MarketResult {
  system: number;
  market?: Market;
  unique?: UniqueMech;
  // Lo que coincide con la búsqueda, para mostrarlo en la lista.
  matches: string[];
}

// Dónde se vende un 'Mech (por nombre o variante), un arma o un equipo, o qué hay en un sistema.
// Sin texto, todos: los 'Mechs únicos y después los mercados por DLC.
export const searchMarkets = (data: StarmapData, query: string): MarketResult[] => {
  const needle = normalize(query);
  if (!needle) {
    return [
      ...data.uniqueMechs.map(unique => ({ system: unique.system, unique, matches: [] })),
      ...[...data.markets].sort((a, b) => a.dlc - b.dlc).map(market => ({ system: market.system, market, matches: [] }))
    ];
  }
  const systemName = new Map(data.systems.map(system => [system.id, normalize(system.name)]));
  const hits = (texts: string[]) => texts.filter(text => normalize(text).includes(needle));

  const markets = data.markets.flatMap((market): MarketResult[] => {
    const inSystem = systemName.get(market.system)?.includes(needle);
    const matches = [
      ...hits(market.mechs.map(mech => `${mech.name} ${mech.id}`)),
      ...hits(market.weapons.map(weapon => weapon.name)),
      ...hits(market.equipment.map(item => item.name))
    ];
    return inSystem || matches.length ? [{ system: market.system, market, matches: [...new Set(matches)] }] : [];
  });
  const uniques = data.uniqueMechs.flatMap((unique): MarketResult[] => {
    const matches = hits([`${unique.name} ${unique.mech}`]);
    return matches.length || systemName.get(unique.system)?.includes(needle) ? [{ system: unique.system, unique, matches }] : [];
  });
  return [...uniques, ...markets];
};

// Ruta del MechLab de Mercenaries, la misma que enlaza la cabecera del mapa.
const MECHLAB_PATH = '/mercs/';

// Cada 'Mech se abre en el MechLab con su build de serie.
export const getMechLabUrl = (mechId: string): string => `${MECHLAB_PATH}?mech=${encodeURIComponent(mechId)}`;
