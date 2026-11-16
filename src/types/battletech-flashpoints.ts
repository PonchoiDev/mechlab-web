import type { BtSource } from './battletech-mechlab';

// Flashpoints de BATTLETECH (src/data/battletech/flashpoints.json, de generar_flashpoints_battletech.py).
export type BtFlashpointSource = Exclude<BtSource, 'base'>;

export interface BtFlashpointContract {
  id: string;
  name: string;
  // Tipo del juego: SimpleBattle, CaptureBase, Assassinate…; null si el juego no lo da.
  type: string | null;
  objective: string | null;
  description: string | null;
}

// choice: se elige uno de sus 'Mechs al final.
export interface BtFlashpointReward {
  title: string;
  description: string;
  choice: boolean;
  mechs: { id: string; name: string; inMechLab: boolean }[];
}

export interface BtFlashpointPath {
  // «A», «B», «A, then B» o «A or B, then B» si dos se juegan igual; «Main» si no hay ninguna decisión.
  label: string;
  // Nombre de la decisión cuando se conoce («Light lance» en Yang Virtanen's Big Score).
  name: string | null;
  // Los contratos propios del camino, después de los del tronco.
  contracts: BtFlashpointContract[];
  funds: number;
  morale: number;
  reputation: { faction: string; value: number }[];
  // La recompensa del camino, si cada uno da la suya; si no, la del flashpoint.
  reward: BtFlashpointReward | null;
}

export interface BtFlashpoint {
  id: string;
  name: string;
  summary: string | null;
  description: string | null;
  source: BtFlashpointSource;
  // De 1 a 10, como en los datos del juego (la mitad en calaveras).
  difficulty: number;
  length: 'short' | 'medium' | 'long';
  employer: string | null;
  target: string | null;
  system: string;
  requirements: { ally: string | null; reputation: { faction: string; min: number }[] };
  repeatable: boolean;
  cancelable: boolean;
  // El tronco: los contratos que hacen todos los caminos al principio.
  contracts: BtFlashpointContract[];
  paths: BtFlashpointPath[];
  reward: BtFlashpointReward | null;
}
