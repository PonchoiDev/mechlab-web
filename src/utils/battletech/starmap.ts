import type { BtStarmapData, BtTag } from '../../types/battletech';
import { normalize } from '../starmap';

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

export const toBtQuery = (systemId: number | null, data: BtStarmapData): string => {
  const system = systemId === null ? undefined : data.systems.find(candidate => candidate.id === systemId);
  return system ? `?${new URLSearchParams({ system: system.name })}` : '';
};

// El juego pinta el logo de cada facción sobre su territorio, grande y casi transparente. Aquí se
// calcula dónde y de qué tamaño, en años luz: los sistemas de una facción a menos de EMBLEM_LINK de otro
// suyo forman un grupo, y el logo va en el centro del grupo más grande. Las facciones con sistemas
// sueltos (Locals, NoFaction) lo llevan en el mayor de sus grupos.
// Los sistemas de la Magistracy of Canopus, en la frontera, están a 20 o 23 años luz unos de otros.
const EMBLEM_LINK = 25;
// Un grupo más pequeño no da para un logo sin tapar a los vecinos.
const EMBLEM_MIN_SYSTEMS = 4;
// El lado del logo crece con la raíz del número de sistemas: ocupa más o menos su superficie.
const EMBLEM_SIZE_PER_SYSTEM = 12;
const EMBLEM_MAX_SIZE = 100;

export interface FactionEmblem {
  faction: string;
  logo: string;
  x: number;
  y: number;
  size: number;
}

export const getFactionEmblems = (data: BtStarmapData): FactionEmblem[] => {
  const byFaction = new Map<string, BtStarmapData['systems']>();
  for (const system of data.systems) {
    const owner = system.owners[0]?.[1];
    if (owner && data.factions[owner]?.logo) byFaction.set(owner, [...(byFaction.get(owner) ?? []), system]);
  }
  return [...byFaction].flatMap(([faction, systems]) => {
    let largest: typeof systems = [];
    const seen = new Set<number>();
    for (const start of systems) {
      if (seen.has(start.id)) continue;
      seen.add(start.id);
      const group = [start];
      for (let i = 0; i < group.length; i++) {
        for (const other of systems) {
          if (!seen.has(other.id) && Math.hypot(other.x - group[i].x, other.y - group[i].y) <= EMBLEM_LINK) {
            seen.add(other.id);
            group.push(other);
          }
        }
      }
      if (group.length > largest.length) largest = group;
    }
    if (largest.length < EMBLEM_MIN_SYSTEMS) return [];
    return [{
      faction,
      logo: data.factions[faction].logo!,
      x: largest.reduce((sum, system) => sum + system.x, 0) / largest.length,
      y: largest.reduce((sum, system) => sum + system.y, 0) / largest.length,
      size: Math.min(EMBLEM_MAX_SIZE, Math.sqrt(largest.length) * EMBLEM_SIZE_PER_SYSTEM)
    }];
  });
};
