import type { StarmapData } from './starmap';

// Mapa estelar de BATTLETECH (src/data/battletech/starmap.json, de tools/generar_mapa_battletech.py).
// Sigue la forma de StarmapData de MW5 para reutilizar su lienzo; lo propio va en details.

export interface BtTag {
  id: string;
  name: string;
  description: string;
}

export interface BtSystemDetails {
  description: string;
  // Dificultad en modo carrera.
  difficulty: number;
  // Etiquetas que el juego enseña, en el orden de sus grupos (clima, tamaño, población…).
  tags: BtTag[];
  blackMarket: boolean;
  // Facción con tienda propia en el sistema (su sede), o null.
  factionStore: string | null;
  // Facciones que ofrecen contratos aquí y contra las que se lucha.
  employers: string[];
  targets: string[];
  biomes: string[];
}

export interface BtStarmapData extends StarmapData {
  details: Record<number, BtSystemDetails>;
}
