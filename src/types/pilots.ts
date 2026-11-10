// Rasgos de piloto y programas de las academias (src/data/pilots.json, de tools/generar_pilotos.py).
export type TraitCategory = 'mech' | 'weapon' | 'faction' | 'career' | 'graduate';

export interface TraitEffect {
  label: string;
  // Con su signo y unidad: «+10%», «+150 m», «+2,500 C-Bills».
  value: string;
  // Si el efecto ayuda al jugador: subir el sueldo o el calor no ayuda.
  good: boolean;
}

// Efectos que se aplican en el mismo sitio: con unos 'Mechs, con un arma, contra una facción, al piloto…
export interface TraitEffectGroup {
  scope: string;
  // Aclaración del juego, como «(Also applies to LB 10-X AC and UAC/10)».
  note?: string;
  effects: TraitEffect[];
}

export interface PilotTrait {
  id: string;
  name: string;
  description: string | null;
  category: TraitCategory;
  // Solo en los pilotos de élite que el juego ofrece al azar.
  hero: boolean;
  // Puede salir en los pilotos que se contratan.
  hireable: boolean;
  // Se puede aprender en una academia.
  trainable: boolean;
  negative: boolean;
  unique: boolean;
  dlc: number | null;
  // Fecha desde la que existe; null si desde siempre.
  available: string | null;
  groups: TraitEffectGroup[];
}

export interface TrainingProgramEntry {
  id: string;
  name: string;
  // Nivel del programa (SemesterEnrollment1 a 4); null en los propios de una academia.
  level: number | null;
  description: string;
  days: number;
  fee: number;
  tuition: number;
  skill: [number, number];
  stars: { skill: number; traits: number; xp: number };
  academies: { id: string; name: string; system: string }[];
}

export interface PilotsData {
  traits: PilotTrait[];
  programs: TrainingProgramEntry[];
}
