export type GameDate = string;

export interface StarSystem {
  id: number;
  name: string;
  // Años luz, con Terra en el origen y el norte (Lyran, Kurita) hacia y positivas.
  x: number;
  y: number;
  // Dueño al empezar la partida y cada cambio hasta 3060: [fecha, facción o null si queda sin dueño].
  owners: [GameDate, string | null][];
  cluster?: string;
  hub?: string;
}

export interface Faction {
  name: string;
  short: string;
  color: string;
  // Logo del juego en public/starmap/logos/; sin él, el emblema muestra las siglas.
  logo?: string;
}

export interface StarEvent {
  id: string;
  date: GameDate;
  name: string;
}

export interface DateRange {
  start: GameDate;
  end: GameDate;
}

// Misión de alta recompensa (HRQ): se ofrece en un sistema y sus misiones se juegan en otros.
export interface QuestMission {
  title: string;
  summary: string | null;
  system: number;
}

// Condiciones con las que el juego ofrece una HRQ, por modo (null en las de los DLC).
export interface QuestRequirement {
  mode: 'campaign' | 'career' | null;
  reputation: number | null;
  from: GameDate | null;
  until: GameDate | null;
  // HRQ que hay que completar antes, y HRQ de bandos opuestos: si se hace una, la otra ya no se ofrece.
  after: string | null;
  excludes: string[];
}

// Lo que paga una HRQ al completarse, por modo (null en las de los DLC).
export interface QuestReward {
  mode: 'campaign' | 'career' | null;
  cbills: number;
  reputation: number;
  mechs: { id: string; name: string }[];
  weapons: { name: string; tier: string | null; count: number }[];
  equipment: { name: string; count: number }[];
  // Pilotos que se unen a la compañía (Valten Ryder en la de Adam Steiner); hero si están en la página de pilotos.
  pilots: { id: string; name: string; hero: boolean }[];
  // Texto de agradecimiento de la última misión que paga.
  debrief: string | null;
}

export interface Quest {
  id: string;
  name: string;
  // DLC que la añade; null en las del juego base.
  dlc: number | null;
  // Modos en los que aparece; vacío en las de los DLC.
  modes: ('campaign' | 'career')[];
  employer: string | null;
  offer: number;
  visibleEverywhere: boolean;
  missionTypes: string[];
  missions: QuestMission[];
  requirements: QuestRequirement[];
  rewards: QuestReward[];
}

// Misión de la campaña de un DLC, con el pago base de su contrato y lo que da al completarla.
export interface CampaignMission {
  title: string;
  summary: string | null;
  system: number;
  employer: string | null;
  cbills: number;
  reputation: number;
  mechs: { id: string; name: string }[];
  // Pilotos que se unen a la compañía (Morgan Trensky en Leading the Charge); hero si están en la página de pilotos.
  pilots: { id: string; name: string; hero: boolean }[];
  weapons: { name: string; tier: string | null; count: number }[];
  equipment: { name: string; count: number }[];
}

// Campaña de un DLC: una historia de misiones en orden dentro del modo carrera.
export interface Campaign {
  id: string;
  dlc: number;
  name: string;
  // Sistema al que lleva la primera parte; puede no tener misión (Tharkad en el DLC9).
  start: number;
  // Desde cuándo se ofrece; null si desde el principio.
  from: GameDate | null;
  missions: CampaignMission[];
  // Lo que da completar la campaña, si da algo más que sus misiones.
  completion: { title: string; mechs: { id: string; name: string }[] } | null;
}

// Mercado con inventario fijo de la campaña de un DLC.
export interface Market {
  id: string;
  system: number;
  dlc: number;
  // Momento de la campaña en que se abre: Prologue, Act 1, Mission 5, Black market…
  stage: string;
  blackMarket: boolean;
  mechs: { id: string; name: string }[];
  weapons: { name: string; tier: string | null; count: number }[];
  equipment: { name: string; count: number }[];
  pilots: { count: number; minSkill: number | null; maxSkill: number | null } | null;
}

// 'Mech que el juego coloca en un sistema a partir de una fecha, como el Atlas II en Romulus.
export interface UniqueMech {
  mech: string;
  name: string;
  dlc: number;
  system: number;
  from: GameDate;
}

// Rareza de una variante en el mercado de una facción, de su unit card (FactionRarity).
export type Rarity = 'veryCommon' | 'common' | 'uncommon' | 'rare' | 'veryRare' | 'unique' | 'unavailable';

export interface MechAvailability {
  id: string;
  name: string;
  // Nombre en la Esfera Interior de los 'Mechs de los Clanes (el Puma es el Adder).
  otherName?: string;
  hero?: boolean;
  // Hero que el juego puede poner a la venta (HeroMechsForPurchase): no tiene un sitio fijo.
  heroMarket?: boolean;
  // Fecha de introducción: antes no existe.
  from: GameDate;
  // Por facción con tabla; si no está, esa facción no la vende.
  rarity: Record<string, Rarity>;
}

// src/data/availability.json, que se carga aparte del mapa.
export interface AvailabilityData {
  // Facción del mapa y facción cuya tabla de rareza usa (la suya o la de su alianza).
  factions: Record<string, string>;
  mechs: MechAvailability[];
}

// Reputación recomendada y dificultad de una zona o un centro industrial en un modo (null: los dos).
export interface ZoneLevel {
  mode: 'campaign' | 'career' | null;
  reputation: string | null;
  difficulty: number | null;
  // Recargo sobre el coste y el tiempo de reparación (markup en el juego); los centros no lo tienen.
  repair?: RepairMarkup | null;
  // Contratos de varias misiones: cuántas misiones y con qué probabilidad.
  multiMission?: MultiMission | null;
}

export interface RepairMarkup {
  cost: number;
  time: number;
}

export interface MultiMission {
  min: number;
  max: number;
  odds: number;
}

// Compañía de mercenarios rivales (DLC4).
export interface MercCompany {
  name: string;
  description: string | null;
  // Nivel de los pilotos: Regular, Veteran o Elite.
  skill: string | null;
  logo?: string;
}

// Zona de influencia de los mercenarios rivales: un círculo alrededor de sus sistemas cercanos, con
// su dueño por fechas.
export interface MercZone {
  id: string;
  systems: number[];
  center: [number, number];
  radius: number;
  owners: { from: GameDate; company: string | null; careerOnly?: boolean }[];
  // Al acabar el historial, el juego la reparte al azar: días con dueño y días vacía.
  rotation?: { owned: number; empty: number };
}

// Arena del DLC6 en un sistema.
export interface ArenaSystem {
  system: number;
  blackMarket: boolean;
  mercEncounters: boolean;
  // Solaris y Hardcore tienen combates propios.
  special: boolean;
}

export interface ArenaRank {
  level: number;
  name: string;
  description: string;
  points: number;
  reward: {
    cbills: number;
    mechs: { id: string; name: string }[];
    weapons: { name: string; tier: string | null; count: number }[];
    equipment: { name: string; count: number }[];
  };
}

// 'Mechs que da una misión u objetivo que no es una HRQ: campañas de los DLC, el Bounty Hunter o
// desbloqueos de promociones.
export interface CampaignReward {
  id: string;
  title: string;
  summary: string | null;
  dlc: number | null;
  mechs: { id: string; name: string }[];
  system?: number;
  // Cómo se consigue: una misión, completar la campaña del DLC, un nivel de información sobre el
  // Bounty Hunter (DLC4) o una promoción, que llega con un mensaje.
  kind: 'mission' | 'campaignComplete' | 'intel' | 'promotion';
  level?: number;
  partner?: string;
  careerOnly?: boolean;
}

// Academia de pilotos del DLC7: abre en su fecha de fundación y, si la destruyen los Clanes, cierra
// cuando un Clan controla su sistema.
export interface Academy {
  id: string;
  name: string;
  description: string;
  system: number;
  founded: GameDate | null;
  clanDestroyed: boolean;
  // Reputación con la facción que pide para entrar.
  standing: number | null;
  programs: string[];
}

export interface TrainingProgram {
  name: string;
  // Lleva {AcademyName}, que se sustituye por el nombre de la academia.
  description: string;
  days: number;
  fee: number;
  // C-Bills por trimestre, además de la matrícula; 0 si no tiene.
  tuition: number;
  // Habilidad del piloto que admite, mínima y máxima.
  skill: [number, number];
  // Estrellas de mejora de habilidad, de rasgos y de experiencia, como las enseña el juego.
  stars: { skill: number; traits: number; xp: number };
}

export interface StarmapData {
  range: DateRange;
  colors: { cluster: string; hub: string };
  factions: Record<string, Faction>;
  events: StarEvent[];
  clusters: Record<string, { name: string; levels: ZoneLevel[]; description?: string; capital?: number }>;
  // Capital de cada centro industrial y parejas de sistemas que unen sus líneas en el mapa.
  hubs: Record<string, { capital: number; links: [number, number][]; levels: ZoneLevel[] }>;
  systems: StarSystem[];
  quests: Quest[];
  markets: Market[];
  uniqueMechs: UniqueMech[];
  rewards: CampaignReward[];
  campaigns: Campaign[];
  arenas: { systems: ArenaSystem[]; ranks: ArenaRank[] };
  mercs: { companies: Record<string, MercCompany>; zones: MercZone[] };
  academies: Academy[];
  trainingPrograms: Record<string, TrainingProgram>;
}
