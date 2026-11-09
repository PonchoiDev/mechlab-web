import type { DateRange, GameDate, StarEvent, StarSystem, StarmapData, ZoneLevel } from '../types/starmap';

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

// Terra está en el origen de las coordenadas del juego, así que la distancia sale directamente.
export const getDistanceToTerra = (system: StarSystem): number => Math.round(Math.hypot(system.x, system.y));

// Los sistemas que cambian de dueño entre dos fechas, para resaltarlos al saltar de un evento a otro.
export const getOwnerChanges = (systems: StarSystem[], from: GameDate, to: GameDate): StarSystem[] =>
  systems.filter(system => getOwnerAt(system, from) !== getOwnerAt(system, to));

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

// Si todos los modos piden lo mismo, un solo nivel sin modo.
const mergeModes = (levels: ZoneLevel[]): ZoneLevel[] => {
  const withoutMode = (level: ZoneLevel) => JSON.stringify({ ...level, mode: null });
  const same = levels.every(level => withoutMode(level) === withoutMode(levels[0]));
  return levels.length > 1 && same ? [{ ...levels[0], mode: null }] : levels;
};

export const getClusterLevels = (data: StarmapData, id: string): ZoneLevel[] => mergeModes(data.clusters[id]?.levels ?? []);

export const getHubLevels = (data: StarmapData, id: string): ZoneLevel[] => mergeModes(data.hubs[id]?.levels ?? []);

export const describeZoneLevel = (level: ZoneLevel): string => [
  level.reputation && `Recommended reputation ${level.reputation}`,
  level.difficulty !== null && `Difficulty ${level.difficulty}`
].filter(Boolean).join(' · ');

export const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

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
  // Para cada celda, el índice del sistema más cercano dentro del radio (o, en un hueco cerrado, del
  // sistema más cercano de su borde), o -1 si no hay ninguno.
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
  // La deformación solo depende de la celda: se calcula una vez por celda y no por cada sistema que
  // la alcanza, que era lo que más tardaba al cargar el mapa.
  const wobbles = new Float64Array(wobble ? cols * rows : 0).fill(Number.NaN);

  systems.forEach((system, index) => {
    const col = Math.round((system.x - originX) / cellSize);
    const row = Math.round((system.y - originY) / cellSize);
    for (let r = Math.max(0, row - reach); r <= Math.min(rows - 1, row + reach); r++) {
      for (let c = Math.max(0, col - reach); c <= Math.min(cols - 1, col + reach); c++) {
        const x = originX + c * cellSize;
        const y = originY + r * cellSize;
        let distance = Math.hypot(x - system.x, y - system.y);
        if (distance > radius) continue;
        const cell = r * cols + c;
        if (wobble) {
          if (Number.isNaN(wobbles[cell])) wobbles[cell] = 1 + wobble * (valueNoise(x / 9, y / 9) - 0.5) * 2;
          distance *= wobbles[cell];
        }
        if (distance < best[cell]) {
          best[cell] = distance;
          nearest[cell] = index;
        }
      }
    }
  });

  fillEnclosedGaps(systems, { originX, originY, cellSize, cols, rows, nearest });
  return { originX, originY, cellSize, cols, rows, nearest };
};

// Hay zonas sin ningún sistema a menos del radio rodeadas de territorio (entre Shimonoseki, Worrell y
// Unity, dentro de la Draconis Combine). Sin esto se verían como espacio vacío con su frontera. Cada
// celda de un hueco cerrado pasa al sistema más cercano de su borde; el espacio exterior toca el
// borde de la rejilla y se queda vacío.
const fillEnclosedGaps = (systems: StarSystem[], { originX, originY, cellSize, cols, rows, nearest }: TerritoryIndex) => {
  const seen = new Uint8Array(cols * rows);
  for (let start = 0; start < nearest.length; start++) {
    if (nearest[start] >= 0 || seen[start]) continue;
    const cells: number[] = [];
    const border = new Set<number>();
    let isOpen = false;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const cell = stack.pop()!;
      cells.push(cell);
      const col = cell % cols;
      const row = (cell - col) / cols;
      if (col === 0 || row === 0 || col === cols - 1 || row === rows - 1) isOpen = true;
      const neighbours = [col > 0 ? cell - 1 : -1, col < cols - 1 ? cell + 1 : -1, row > 0 ? cell - cols : -1, row < rows - 1 ? cell + cols : -1];
      for (const next of neighbours) {
        if (next < 0) continue;
        if (nearest[next] >= 0) border.add(nearest[next]);
        else if (!seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    if (isOpen) continue;
    for (const cell of cells) {
      const x = originX + (cell % cols) * cellSize;
      const y = originY + Math.floor(cell / cols) * cellSize;
      let best = Infinity;
      for (const index of border) {
        const distance = Math.hypot(x - systems[index].x, y - systems[index].y);
        if (distance < best) {
          best = distance;
          nearest[cell] = index;
        }
      }
    }
  }
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

// Segmentos de marching squares para cada combinación de esquinas dentro del territorio. Las
// esquinas van 0 abajo izquierda, 1 abajo derecha, 2 arriba derecha y 3 arriba izquierda; los lados,
// 0 abajo, 1 derecha, 2 arriba y 3 izquierda.
const SQUARE_SEGMENTS: [number, number][][] = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]], [[3, 1]], [[0, 1]], [[3, 0]], []
];

// Suaviza un contorno cerrado recortando cada esquina (Chaikin), para que no se vea la rejilla.
const smoothLoop = (loop: Point[], iterations = 2): Point[] => {
  let points = loop;
  for (let step = 0; step < iterations; step++) {
    points = points.flatMap((point, i): Point[] => {
      const next = points[(i + 1) % points.length];
      return [
        [point[0] * 0.75 + next[0] * 0.25, point[1] * 0.75 + next[1] * 0.25],
        [point[0] * 0.25 + next[0] * 0.75, point[1] * 0.25 + next[1] * 0.75]
      ];
    });
  }
  return points;
};

// Contornos del territorio de cada facción en una fecha, en años luz: lazos cerrados (los huecos
// también son lazos, así que se rellenan con la regla par-impar). Al ser líneas y no una textura,
// el borde se ve nítido con cualquier zoom.
export const getTerritoryContours = (
  index: TerritoryIndex,
  systems: StarSystem[],
  date: GameDate
): Map<string, Point[][]> => {
  const { cols, rows, nearest, originX, originY, cellSize } = index;
  const owners = systems.map(system => getOwnerAt(system, date));
  const ownerAt = (col: number, row: number) => {
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    const system = nearest[row * cols + col];
    return system < 0 ? null : owners[system];
  };
  // Cada lado de la rejilla tiene un número: así dos cuadros vecinos comparten el mismo punto.
  const stride = cols + 2;
  const edgeKey = (col: number, row: number, side: number) => {
    const [c, r, vertical] = side === 0 ? [col, row, 0] : side === 1 ? [col + 1, row, 1] : side === 2 ? [col, row + 1, 0] : [col, row, 1];
    return (((r + 1) * stride + (c + 1)) << 1) | vertical;
  };
  const edgePoint = (key: number): Point => {
    const vertical = key & 1;
    const cell = key >> 1;
    const col = (cell % stride) - 1;
    const row = Math.floor(cell / stride) - 1;
    return [originX + (col + (vertical ? 0 : 0.5)) * cellSize, originY + (row + (vertical ? 0.5 : 0)) * cellSize];
  };

  const links = new Map<string, Map<number, number[]>>();
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const corners = [ownerAt(col, row), ownerAt(col + 1, row), ownerAt(col + 1, row + 1), ownerAt(col, row + 1)];
      if (corners[0] === corners[1] && corners[1] === corners[2] && corners[2] === corners[3]) continue;
      for (const faction of new Set(corners)) {
        if (!faction) continue;
        const mask = corners.reduce((bits, owner, i) => (owner === faction ? bits | (1 << i) : bits), 0);
        let graph = links.get(faction);
        if (!graph) links.set(faction, (graph = new Map()));
        for (const [from, to] of SQUARE_SEGMENTS[mask]) {
          const a = edgeKey(col, row, from);
          const b = edgeKey(col, row, to);
          graph.set(a, [...(graph.get(a) ?? []), b]);
          graph.set(b, [...(graph.get(b) ?? []), a]);
        }
      }
    }
  }

  const contours = new Map<string, Point[][]>();
  for (const [faction, graph] of links) {
    const visited = new Set<number>();
    const loops: Point[][] = [];
    for (const start of graph.keys()) {
      if (visited.has(start)) continue;
      const loop: Point[] = [];
      let previous = -1;
      let current = start;
      while (!visited.has(current)) {
        visited.add(current);
        loop.push(edgePoint(current));
        const next = graph.get(current)!.find(candidate => candidate !== previous && !visited.has(candidate));
        if (next === undefined) break;
        previous = current;
        current = next;
      }
      if (loop.length >= 3) loops.push(smoothLoop(loop));
    }
    contours.set(faction, loops);
  }
  return contours;
};

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
  questId?: string | null;
  mechId?: string | null;
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

export const toMapQuery = ({ date, systemId, questId, mechId }: MapQuery, data: StarmapData): string => {
  const params = new URLSearchParams({ date });
  const system = systemId === null ? undefined : data.systems.find(candidate => candidate.id === systemId);
  if (system) params.set('system', system.name);
  if (questId && data.quests.some(quest => quest.id === questId)) params.set('quest', questId);
  // La variante no se comprueba aquí: la rareza se carga aparte (parseMechQuery la valida).
  if (mechId) params.set('mech', mechId);
  return `?${params.toString()}`;
};
