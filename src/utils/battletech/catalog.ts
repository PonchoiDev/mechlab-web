import type { BtHardpoint, BtSource } from '../../types/battletech-mechlab';

// Etiquetas del catálogo de BATTLETECH (fuente, anclaje y rareza) sin datos: las usan el MechLab y la
// página de equipo, que así no carga los 'Mechs.

export const SOURCE_LABELS: Record<BtSource, string> = {
  base: 'Base',
  heavymetal: 'Heavy Metal',
  flashpoint: 'Flashpoint',
  urbanwarfare: 'Urban Warfare'
};

export const SOURCES = Object.keys(SOURCE_LABELS) as BtSource[];

export const HARDPOINT_LABELS: Record<BtHardpoint, string> = {
  energy: 'Energy',
  ballistic: 'Ballistic',
  missile: 'Missile',
  support: 'Support'
};

export const HARDPOINT_SHORT: Record<BtHardpoint, string> = { energy: 'E', ballistic: 'B', missile: 'M', support: 'S' };

export const HARDPOINTS = Object.keys(HARDPOINT_LABELS) as BtHardpoint[];

// Rareza del juego (Description.Rarity): de 0 a 5 en las tiendas, y 99 o 100 en lo que solo sale como
// recompensa o tecnología perdida.
export type BtRarityGroup = 'common' | 'uncommon' | 'rare' | 'special';

export const RARITY_GROUPS: { group: BtRarityGroup; label: string; title: string }[] = [
  { group: 'common', label: 'Common', title: 'Rarity 0 and 1 in the game data' },
  { group: 'uncommon', label: 'Uncommon', title: 'Rarity 2 and 3 in the game data' },
  { group: 'rare', label: 'Rare', title: 'Rarity 4 and 5 in the game data' },
  { group: 'special', label: 'Special', title: 'Rarity 99 or 100: rewards and lostech that random shops do not sell' }
];

export const getRarityGroup = (rarity: number): BtRarityGroup =>
  rarity >= 99 ? 'special' : rarity >= 4 ? 'rare' : rarity >= 2 ? 'uncommon' : 'common';
