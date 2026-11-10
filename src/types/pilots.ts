// Pilotos hero, rasgos de piloto y programas de las academias (src/data/pilots.json, de tools/generar_pilotos.py).
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
  // Subgrupo dentro de la categoría («Light 'Mechs», «Ballistic», «Nobles»…); null en los graduados.
  group: string | null;
  // Rasgo raro: todos los pilotos hero del DLC7 traen uno, y los contratados y las academias solo a veces.
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

export interface HeroPilotSkill {
  name: string;
  level: number;
  cap: number;
}

// Piloto con nombre y rasgos fijos, como un chasis hero.
export interface HeroPilot {
  id: string;
  name: string;
  // Solo si no está ya en el nombre.
  callsign: string | null;
  dlc: number | null;
  // Regular, Veteran…
  rank: string | null;
  // La sala de contratación lo puede ofrecer como Elite Pilot; si no, solo llega como recompensa.
  hiringHall: boolean;
  // Misiones u objetivos que lo dan; story si son de la campaña de la historia.
  rewards: { title: string; story: boolean }[];
  hiringCost: number | null;
  salary: number | null;
  skills: HeroPilotSkill[];
  // Ids de PilotTrait.
  traits: string[];
  bio: string[];
}

export type ProgramFamilyId = 'simpod' | 'vocational' | 'semester' | 'fullYear' | 'undergraduate' | 'graduate' | 'academy';

export interface ProgramFamily {
  id: ProgramFamilyId;
  name: string;
  description: string;
}

export interface TrainingProgramEntry {
  id: string;
  family: ProgramFamilyId;
  // Lo que lo distingue dentro de su familia: «Level 2», «Remedial» o la academia.
  label: string;
  name: string;
  // Nivel del programa (SemesterEnrollment1 a 4); null en los propios de una academia.
  level: number | null;
  days: number;
  fee: number;
  tuition: number;
  skill: [number, number];
  stars: { skill: number; traits: number; xp: number };
  academies: { id: string; name: string; system: string }[];
  // Ids de PilotTrait: el que da siempre y los que favorece su propia lista.
  guaranteedTrait: string | null;
  favouredTraits: string[];
}

export interface PilotsData {
  heroes: HeroPilot[];
  traits: PilotTrait[];
  programFamilies: ProgramFamily[];
  programs: TrainingProgramEntry[];
}
