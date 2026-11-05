import type { GameDate, StarSystem, StarmapData } from '../types/starmap';
import { buildTerritoryIndex, getClusterOutline, getHubs, getOwnerAt, type TerritoryIndex } from '../utils/starmap';

export interface View {
  // Centro de la pantalla en años luz y píxeles por año luz.
  x: number;
  y: number;
  scale: number;
}

type Point = [number, number];

// Una celda de la rejilla son 2 años luz y cada una ocupa 3 píxeles de la textura de territorios:
// así el borde se suaviza al escalar sin que la textura pese demasiado.
const CELL_SIZE = 2;
const TEXTURE_SCALE = 3;
const GLOW_SCALE = 1.5;
// Con este zoom (píxeles por año luz) el halo se ve entero; más cerca se atenúa.
const GLOW_REFERENCE_SCALE = 1.4;
const TERRITORY_RADIUS = 34;
const EDGE_DEPTH = 10;
const LABEL_SCALE = 2.4;
const CLUSTER_PADDING = 7;

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16)
];

const withAlpha = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export class StarmapRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly data: StarmapData;
  private readonly context: CanvasRenderingContext2D;
  private readonly index: TerritoryIndex;
  private readonly factionIds: string[];
  private readonly clusterOutlines: { points: Point[]; hub: boolean }[];
  private readonly hubCapitals: Set<number>;
  private territory: { texture: HTMLCanvasElement; glow: HTMLCanvasElement } | null = null;
  private starfield: HTMLCanvasElement | null = null;
  private owners: (string | null)[] = [];
  private frame = 0;
  private width = 0;
  private height = 0;
  private ratio = 1;

  view: View = { x: 0, y: 0, scale: 1 };
  hoveredId: number | null = null;
  selectedId: number | null = null;

  constructor(canvas: HTMLCanvasElement, data: StarmapData) {
    this.canvas = canvas;
    this.data = data;
    this.context = canvas.getContext('2d')!;
    this.index = buildTerritoryIndex(data.systems, { cellSize: CELL_SIZE, radius: TERRITORY_RADIUS, wobble: 0.18 });
    this.factionIds = Object.keys(data.factions);

    const byCluster = new Map<string, Point[]>();
    for (const system of data.systems) {
      if (system.cluster) byCluster.set(system.cluster, [...(byCluster.get(system.cluster) ?? []), [system.x, system.y]]);
    }
    const hubs = getHubs(data);
    this.hubCapitals = new Set(hubs.map(hub => hub.capital.id));
    this.clusterOutlines = [
      ...[...byCluster.values()].map(points => ({ points: getClusterOutline(points, CLUSTER_PADDING), hub: false })),
      ...hubs.map(hub => ({ points: getClusterOutline(hub.systems.map(system => [system.x, system.y]), CLUSTER_PADDING), hub: true }))
    ];
  }

  resize(width: number, height: number, ratio: number) {
    this.width = width;
    this.height = height;
    this.ratio = ratio;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.starfield = this.buildStarfield();
    this.requestDraw();
  }

  setDate(date: GameDate) {
    this.owners = this.data.systems.map(system => getOwnerAt(system, date));
    this.territory = this.buildTerritory();
    this.requestDraw();
  }

  toWorld(screenX: number, screenY: number): Point {
    return [
      this.view.x + (screenX - this.width / 2) / this.view.scale,
      this.view.y - (screenY - this.height / 2) / this.view.scale
    ];
  }

  toScreen(x: number, y: number): Point {
    return [this.width / 2 + (x - this.view.x) * this.view.scale, this.height / 2 - (y - this.view.y) * this.view.scale];
  }

  // El sistema más cercano al puntero, si está a menos de unos píxeles.
  systemAt(screenX: number, screenY: number, maxDistance = 14): StarSystem | null {
    let found: StarSystem | null = null;
    let best = maxDistance * maxDistance;
    for (const system of this.data.systems) {
      const [x, y] = this.toScreen(system.x, system.y);
      const distance = (x - screenX) ** 2 + (y - screenY) ** 2;
      if (distance < best) {
        best = distance;
        found = system;
      }
    }
    return found;
  }

  requestDraw() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  destroy() {
    cancelAnimationFrame(this.frame);
  }

  private buildStarfield() {
    // Estrellas de fondo, fijas en la pantalla: dan profundidad sin confundirse con los sistemas.
    const canvas = createCanvas(Math.max(1, this.canvas.width), Math.max(1, this.canvas.height));
    const context = canvas.getContext('2d')!;
    const count = Math.round((this.width * this.height) / 2600);
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const alpha = 0.08 + random() * 0.3;
      context.fillStyle = `rgba(200, 215, 255, ${alpha})`;
      const size = (random() < 0.08 ? 1.6 : 0.9) * this.ratio;
      context.fillRect(random() * canvas.width, random() * canvas.height, size, size);
    }
    return canvas;
  }

  private buildTerritory() {
    const { cols, rows, nearest } = this.index;
    const ownerIndex = this.owners.map(owner => (owner ? this.factionIds.indexOf(owner) : -1));
    const cells = new Int16Array(cols * rows);
    for (let cell = 0; cell < cells.length; cell++) cells[cell] = nearest[cell] < 0 ? -1 : ownerIndex[nearest[cell]];

    // Distancia de cada celda al borde de su territorio: el interior va oscuro y el borde brilla.
    const depth = new Uint8Array(cells.length).fill(EDGE_DEPTH);
    let queue: number[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = row * cols + col;
        const owner = cells[cell];
        if (owner < 0) continue;
        const isEdge = col === 0 || row === 0 || col === cols - 1 || row === rows - 1
          || cells[cell - 1] !== owner || cells[cell + 1] !== owner || cells[cell - cols] !== owner || cells[cell + cols] !== owner;
        if (isEdge) {
          depth[cell] = 0;
          queue.push(cell);
        }
      }
    }
    for (let level = 1; level < EDGE_DEPTH && queue.length; level++) {
      const next: number[] = [];
      for (const cell of queue) {
        for (const neighbour of [cell - 1, cell + 1, cell - cols, cell + cols]) {
          if (neighbour >= 0 && neighbour < cells.length && cells[neighbour] >= 0 && depth[neighbour] > level) {
            depth[neighbour] = level;
            next.push(neighbour);
          }
        }
      }
      queue = next;
    }

    const colors = this.factionIds.map(id => hexToRgb(this.data.factions[id].color));
    const fill = new ImageData(cols, rows);
    const edge = new ImageData(cols, rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = row * cols + col;
        const owner = cells[cell];
        if (owner < 0) continue;
        // La textura va con el norte arriba: la fila de la rejilla se invierte.
        const pixel = ((rows - 1 - row) * cols + col) * 4;
        const [r, g, b] = colors[owner];
        const glow = Math.exp(-depth[cell] / 1.6);
        fill.data[pixel] = r;
        fill.data[pixel + 1] = g;
        fill.data[pixel + 2] = b;
        fill.data[pixel + 3] = Math.round(255 * (0.2 + 0.45 * glow));
        if (depth[cell] === 0) {
          edge.data[pixel] = Math.round(r + (255 - r) * 0.3);
          edge.data[pixel + 1] = Math.round(g + (255 - g) * 0.3);
          edge.data[pixel + 2] = Math.round(b + (255 - b) * 0.3);
          edge.data[pixel + 3] = 255;
        }
      }
    }

    const fillCanvas = createCanvas(cols, rows);
    fillCanvas.getContext('2d')!.putImageData(fill, 0, 0);
    const edgeCanvas = createCanvas(cols, rows);
    edgeCanvas.getContext('2d')!.putImageData(edge, 0, 0);

    // El relleno se suaviza un poco para que no se vean las celdas, y el borde va nítido encima.
    const texture = createCanvas(cols * TEXTURE_SCALE, rows * TEXTURE_SCALE);
    const context = texture.getContext('2d')!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.filter = 'blur(2px)';
    context.drawImage(fillCanvas, 0, 0, texture.width, texture.height);
    context.filter = 'blur(1px)';
    context.globalAlpha = 0.85;
    context.drawImage(edgeCanvas, 0, 0, texture.width, texture.height);

    // El halo del borde va en otra textura, más pequeña porque es difusa, para atenuarlo al acercarse:
    // si no, al ampliar se convierte en una banda blanca.
    const glow = createCanvas(Math.round(cols * GLOW_SCALE), Math.round(rows * GLOW_SCALE));
    const glowContext = glow.getContext('2d')!;
    glowContext.imageSmoothingEnabled = true;
    glowContext.filter = 'blur(4px)';
    glowContext.drawImage(edgeCanvas, 0, 0, glow.width, glow.height);
    return { texture, glow };
  }

  private draw() {
    const context = this.context;
    const { scale } = this.view;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#020309';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.starfield) context.drawImage(this.starfield, 0, 0);
    context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);

    if (this.territory) {
      const { originX, originY, cellSize, cols, rows } = this.index;
      const [left, top] = this.toScreen(originX - cellSize / 2, originY + (rows - 0.5) * cellSize);
      const width = cols * cellSize * scale;
      const height = rows * cellSize * scale;
      context.imageSmoothingEnabled = true;
      context.drawImage(this.territory.texture, left, top, width, height);
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = Math.min(0.9, GLOW_REFERENCE_SCALE / scale);
      context.drawImage(this.territory.glow, left, top, width, height);
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
    }

    this.drawClusters();
    this.drawSystems();
  }

  private drawClusters() {
    const context = this.context;
    context.lineJoin = 'round';
    for (const outline of this.clusterOutlines) {
      const color = outline.hub ? this.data.colors.hub : this.data.colors.cluster;
      context.beginPath();
      outline.points.forEach(([x, y], i) => {
        const [sx, sy] = this.toScreen(x, y);
        if (i === 0) context.moveTo(sx, sy);
        else context.lineTo(sx, sy);
      });
      context.closePath();
      context.fillStyle = withAlpha(color, outline.hub ? 0.16 : 0.1);
      context.fill();
      context.lineWidth = outline.hub ? 1.6 : 1.2;
      context.strokeStyle = withAlpha(color, 0.75);
      context.stroke();
    }
  }

  private drawSystems() {
    const context = this.context;
    const { scale } = this.view;
    const radius = Math.min(3, 1.1 + scale * 0.3);
    const visible = this.data.systems.filter(system => {
      const [x, y] = this.toScreen(system.x, system.y);
      return x > -40 && y > -40 && x < this.width + 40 && y < this.height + 40;
    });

    for (const [i, system] of this.data.systems.entries()) {
      const [x, y] = this.toScreen(system.x, system.y);
      if (x < -10 || y < -10 || x > this.width + 10 || y > this.height + 10) continue;
      context.fillStyle = this.owners[i] ? '#ffffff' : 'rgba(170, 180, 200, 0.55)';
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    for (const system of visible) {
      if (!this.hubCapitals.has(system.id)) continue;
      this.drawHubIcon(...this.toScreen(system.x, system.y));
    }

    if (scale >= LABEL_SCALE) this.drawLabels(visible);

    for (const id of [this.hoveredId, this.selectedId]) {
      const system = id === null ? undefined : this.data.systems.find(candidate => candidate.id === id);
      if (!system) continue;
      const [x, y] = this.toScreen(system.x, system.y);
      const selected = id === this.selectedId;
      context.lineWidth = 2;
      context.strokeStyle = selected ? '#ffd400' : 'rgba(255, 255, 255, 0.9)';
      context.shadowColor = selected ? '#ffd400' : '#ffffff';
      context.shadowBlur = 10;
      context.beginPath();
      if (selected) {
        context.moveTo(x, y - 11);
        context.lineTo(x + 11, y);
        context.lineTo(x, y + 11);
        context.lineTo(x - 11, y);
        context.closePath();
      } else {
        context.arc(x, y, 8, 0, Math.PI * 2);
      }
      context.stroke();
      context.shadowBlur = 0;
    }
  }

  private drawHubIcon(x: number, y: number) {
    // Rombo con un engranaje simplificado: los centros industriales destacan como en el juego.
    const context = this.context;
    const size = 7;
    context.save();
    context.translate(x, y - 14);
    context.fillStyle = '#0b1820';
    context.strokeStyle = this.data.colors.hub;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, -size);
    context.lineTo(size, 0);
    context.lineTo(0, size);
    context.lineTo(-size, 0);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 2.4, 0, Math.PI * 2);
    context.fillStyle = this.data.colors.hub;
    context.fill();
    context.restore();
  }

  private drawLabels(systems: StarSystem[]) {
    // Los nombres no se pisan: se descarta el que choca con uno ya escrito.
    const context = this.context;
    context.font = '600 12px "Barlow Condensed", "Arial Narrow", sans-serif';
    context.textBaseline = 'middle';
    const taken: [number, number, number, number][] = [];
    const ordered = [...systems].sort((a, b) => Number(this.hubCapitals.has(b.id)) - Number(this.hubCapitals.has(a.id)));
    for (const system of ordered) {
      const [x, y] = this.toScreen(system.x, system.y);
      const text = system.name.toUpperCase();
      const width = context.measureText(text).width;
      const box: [number, number, number, number] = [x + 6, y - 7, x + 6 + width, y + 7];
      if (taken.some(([l, t, r, b]) => box[0] < r && box[2] > l && box[1] < b && box[3] > t)) continue;
      taken.push(box);
      context.fillStyle = 'rgba(0, 0, 0, 0.75)';
      context.fillText(text, box[0] + 1, y + 1);
      context.fillStyle = 'rgba(235, 240, 250, 0.92)';
      context.fillText(text, box[0], y);
    }
  }
}
