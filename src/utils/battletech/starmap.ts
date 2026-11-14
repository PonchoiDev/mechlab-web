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
