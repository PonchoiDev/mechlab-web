import type { Rarity } from '../types/starmap';

// De verde (fácil de encontrar) a rojo (muy raro); Unique y Unavailable aparte.
export const RARITY_COLORS: Record<Rarity, string> = {
  veryCommon: '#35e08a',
  common: '#9fe05a',
  uncommon: '#f2d94e',
  rare: '#f29b38',
  veryRare: '#ea5a3c',
  unique: '#c77dff',
  unavailable: '#7d8594'
};
export const NOT_SOLD_COLOR = '#2b313b';
