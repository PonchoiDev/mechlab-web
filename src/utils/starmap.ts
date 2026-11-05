import type { DateRange, GameDate, StarEvent, StarSystem, StarmapData } from '../types/starmap';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

// Las fechas son texto ISO (3042-01-21): con años de cuatro cifras se comparan como texto.
export const getOwnerAt = (system: StarSystem, date: GameDate): string | null => {
  let owner = system.owners[0]?.[1] ?? null;
  for (const [changedOn, faction] of system.owners) {
    if (changedOn > date) break;
    owner = faction;
  }
  return owner;
};

// Las facciones con sistemas en esa fecha, de mayor a menor, para la leyenda.
export const countSystemsByOwner = (systems: StarSystem[], date: GameDate): [string, number][] => {
  const counts = new Map<string, number>();
  for (const system of systems) {
    const owner = getOwnerAt(system, date);
    if (owner) counts.set(owner, (counts.get(owner) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

export const getFactionColor =(data: StarmapData, factionId: string | null): string | null =>
  factionId ? data.factions[factionId]?.color ?? null : null;

export const isValidDate = (date: string): boolean => {
  const match = DATE_PATTERN.exec(date);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

export const clampDate = (date: GameDate, range: DateRange): GameDate =>
  date < range.start ? range.start : date > range.end ? range.end : date;

// El control deslizante trabaja en días; la fecha se guarda como texto.
export const dateToDays = (date: GameDate): number => {
  const [year, month, day] = date.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
};

export const daysToDate = (days: number): GameDate => {
  const date = new Date(days * DAY_MS);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

// Como la fecha del juego: 21 JAN 3042.
export const formatGameDate = (date: GameDate): string => {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
};

export const getNextEvent = (events: StarEvent[], date: GameDate): StarEvent | null =>
  events.find(event => event.date > date) ?? null;

export const getPreviousEvent = (events: StarEvent[], date: GameDate): StarEvent | null =>
  events.findLast(event => event.date < date) ?? null;

// El último evento que ya ha pasado en esa fecha, para decir en qué época está el mapa.
export const getCurrentEvent = (events: StarEvent[], date: GameDate): StarEvent | null =>
  events.findLast(event => event.date <= date) ?? null;

export interface Hub {
  id: string;
  capital: StarSystem;
  systems: StarSystem[];
}

export const getHubs = (data: StarmapData): Hub[] => Object.entries(data.hubs).flatMap(([id, hub]) => {
  const capital = data.systems.find(system => system.id === hub.capital);
  return capital ? [{ id, capital, systems: data.systems.filter(system => system.hub === id) }] : [];
});

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Primero los nombres que empiezan por el texto y después los que solo lo contienen.
export const searchSystems = (systems: StarSystem[], query: string, limit = 8): StarSystem[] => {
  const needle = normalize(query);
  if (!needle) return [];
  const byName = (a: StarSystem, b: StarSystem) => a.name.localeCompare(b.name);
  const starts = systems.filter(system => normalize(system.name).startsWith(needle)).sort(byName);
  const contains = systems
    .filter(system => !normalize(system.name).startsWith(needle) && normalize(system.name).includes(needle))
    .sort(byName);
  return [...starts, ...contains].slice(0, limit);
};

export interface TerritoryIndex {
  originX: number;
  originY: number;
  cellSize: number;
  cols: number;
  rows: number;
  // Para cada celda, el índice del sistema más cercano dentro del radio, o -1 si no hay ninguno.
  nearest: Int32Array;
}

export interface TerritoryOptions {
  cellSize?: number;
  radius?: number;
  // Deformación de las distancias (0 a 1) para que las fronteras no sean rectas, como en el juego.
  wobble?: number;
}

// Ruido de valor determinista: el mismo punto siempre se deforma igual.
const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const valueNoise = (x: number, y: number) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * sx;
  const bottom = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
};

// A qué sistema pertenece cada punto del mapa. No depende de la fecha: al cambiarla solo cambia el
// dueño de cada sistema, así que la rejilla se calcula una vez.
export const buildTerritoryIndex = (
  systems: StarSystem[],
  { cellSize = 2, radius = 30, wobble = 0 }: TerritoryOptions = {}
): TerritoryIndex => {
  const xs = systems.map(system => system.x);
  const ys = systems.map(system => system.y);
  const originX = Math.min(...xs) - radius;
  const originY = Math.min(...ys) - radius;
  const cols = Math.ceil((Math.max(...xs) + radius - originX) / cellSize) + 1;
  const rows = Math.ceil((Math.max(...ys) + radius - originY) / cellSize) + 1;
  const nearest = new Int32Array(cols * rows).fill(-1);
  const best = new Float32Array(cols * rows).fill(Infinity);
  const reach = Math.ceil(radius / cellSize);

  systems.forEach((system, index) => {
    const col = Math.round((system.x - originX) / cellSize);
    const row = Math.round((system.y - originY) / cellSize);
    for (let r = Math.max(0, row - reach); r <= Math.min(rows - 1, row + reach); r++) {
      for (let c = Math.max(0, col - reach); c <= Math.min(cols - 1, col + reach); c++) {
        const x = originX + c * cellSize;
        const y = originY + r * cellSize;
        let distance = Math.hypot(x - system.x, y - system.y);
        if (distance > radius) continue;
        if (wobble) distance *= 1 + wobble * (valueNoise(x / 9, y / 9) - 0.5) * 2;
        const cell = r * cols + c;
        if (distance < best[cell]) {
          best[cell] = distance;
          nearest[cell] = index;
        }
      }
    }
  });

  return { originX, originY, cellSize, cols, rows, nearest };
};

export const getTerritoryOwner = (
  index: TerritoryIndex,
  systems: StarSystem[],
  x: number,
  y: number,
  date: GameDate
): string | null => {
  const col = Math.round((x - index.originX) / index.cellSize);
  const row = Math.round((y - index.originY) / index.cellSize);
  if (col < 0 || row < 0 || col >= index.cols || row >= index.rows) return null;
  const system = index.nearest[row * index.cols + col];
  return system < 0 ? null : getOwnerAt(systems[system], date);
};

type Point = [number, number];

const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

// Contorno de un clúster: envolvente convexa de sus sistemas con un margen redondeado, en sentido
// antihorario. Con uno o dos sistemas sale un círculo o una cápsula.
export const getClusterOutline = (points: Point[], padding: number, segments = 12): Point[] => {
  const expanded: Point[] = points.flatMap(([x, y]) => Array.from({ length: segments }, (_, i): Point => {
    const angle = (i / segments) * Math.PI * 2;
    // Se divide por el coseno del medio segmento para que el polígono no recorte el círculo.
    const distance = padding / Math.cos(Math.PI / segments);
    return [x + Math.cos(angle) * distance, y + Math.sin(angle) * distance];
  }));
  const sorted = expanded.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower: Point[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Point[] = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

export interface MapQuery {
  date: GameDate;
  systemId: number | null;
}

export const parseMapQuery = (search: string, data: StarmapData): MapQuery => {
  const params = new URLSearchParams(search);
  const date = params.get('date');
  const name = params.get('system');
  const system = name ? data.systems.find(candidate => normalize(candidate.name) === normalize(name)) : undefined;
  return {
    date: date && isValidDate(date) ? clampDate(date, data.range) : data.range.start,
    systemId: system?.id ?? null
  };
};

export const toMapQuery = ({ date, systemId }: MapQuery, data: StarmapData): string => {
  const params = new URLSearchParams({ date });
  const system = systemId === null ? undefined : data.systems.find(candidate => candidate.id === systemId);
  if (system) params.set('system', system.name);
  return `?${params.toString()}`;
};
