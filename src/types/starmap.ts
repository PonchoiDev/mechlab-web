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

export interface StarmapData {
  range: DateRange;
  colors: { cluster: string; hub: string };
  factions: Record<string, Faction>;
  events: StarEvent[];
  clusters: Record<string, { name: string }>;
  // Capital de cada centro industrial y parejas de sistemas que unen sus líneas en el mapa.
  hubs: Record<string, { capital: number; links: [number, number][] }>;
  systems: StarSystem[];
}
