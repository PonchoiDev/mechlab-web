import type { BtSource, BtWeightClass } from './battletech-mechlab';

// Vehículos y torretas de BATTLETECH (src/data/battletech/units.json, de generar_unidades_battletech.py).
export type BtUnitKind = 'tracked' | 'wheeled' | 'turret';

// Las torretas tienen una sola ubicación: body.
export type BtUnitLocation = 'front' | 'left' | 'right' | 'rear' | 'turret' | 'body';

export interface BtUnitLine {
  id: string;
  count: number;
}

export interface BtUnit {
  id: string;
  name: string;
  kind: BtUnitKind;
  source: BtSource;
  weightClass: BtWeightClass;
  // null en las torretas: el tonelaje de su chasis no sale en el juego.
  tonnage: number | null;
  noncombatant: boolean;
  locations: { location: BtUnitLocation; armor: number; structure: number }[];
  // Metros por turno; null en las torretas, que no se mueven.
  walk: number | null;
  sprint: number | null;
  weapons: BtUnitLine[];
  ammo: BtUnitLine[];
  equipment: BtUnitLine[];
  sarna?: { page: string; image: string | null };
}
