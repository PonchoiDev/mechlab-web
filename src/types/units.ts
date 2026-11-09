import type { Item } from './item';
import type { Rarity } from './starmap';

// Unidades enemigas que no son 'Mechs (src/data/units.json, de tools/generar_unidades.py).
export type UnitKind = 'tracked' | 'hover' | 'wheeled' | 'vtol' | 'turret' | 'battleArmor';

export interface UnitWeaponRef {
  id: string;
  count: number;
}

export interface Unit {
  id: string;
  name: string;
  kind: UnitKind;
  role: string | null;
  tier: number;
  battleValue: number;
  introYear: number;
  // Vida base del blueprint: el juego la escala con la dificultad del contrato. En las armaduras de
  // combate, la de cada traje.
  hitPoints: number | null;
  // km/h; los VTOL y algunos tanques no la tienen en los datos.
  speed: number | null;
  // Trajes de cada grupo de armaduras de combate.
  squad?: number;
  weapons: UnitWeaponRef[];
  rarity: Record<string, Rarity>;
  // Página de Sarna del chasis y su dibujo principal (algunas páginas no tienen dibujo).
  sarna?: { page: string; image: string | null };
}

export interface UnitsData {
  factions: Record<string, string>;
  // Armas en el formato de items.json, con el tier que llevan las unidades.
  weapons: Record<string, Item>;
  units: Unit[];
}
