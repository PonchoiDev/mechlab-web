import type { GameDate, StarSystem, StarmapData } from '../types/starmap';
import { buildTerritoryIndex, getClusterOutline, getHubs, getOwnerAt, getTerritoryContours, type TerritoryIndex } from '../utils/starmap';

export interface View {
  // Centro de la pantalla en años luz y píxeles por año luz.
  x: number;
  y: number;
  scale: number;
}

type Point = [number, number];

// Una celda de la rejilla son 2 años luz: los contornos salen de ella y se suavizan.
const CELL_SIZE = 2;
const TERRITORY_RADIUS = 34;
const LABEL_SCALE = 2.4;
const CLUSTER_PADDING = 7;
// Grosores en píxeles de pantalla: el borde se ve igual de marcado con cualquier zoom.
const BORDER_WIDTH = 2;
const BORDER_HALO = 7;
const INNER_GLOW = 18;

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16)
];

const withAlpha = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const lighten = (hex: string, amount: number) => {
  const [r, g, b] = hexToRgb(hex).map(channel => Math.round(channel + (255 - channel) * amount));
  return `rgb(${r}, ${g}, ${b})`;
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
  private readonly clusterOutlines: Point[][];
  private readonly hubLinks: [Point, Point][];
  private readonly hubCapitals: Set<number>;
  private territories: { color: string; path: Path2D }[] = [];
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

    const byCluster = new Map<string, Point[]>();
    for (const system of data.systems) {
      if (system.cluster) byCluster.set(system.cluster, [...(byCluster.get(system.cluster) ?? []), [system.x, system.y]]);
    }
    const hubs = getHubs(data);
    this.hubCapitals = new Set(hubs.map(hub => hub.capital.id));
    this.clusterOutlines = [...byCluster.values()].map(points => getClusterOutline(points, CLUSTER_PADDING));
    // Los centros industriales se dibujan como en el juego: líneas discontinuas entre sus estrellas.
    const byId = new Map(data.systems.map(system => [system.id, system]));
    this.hubLinks = Object.values(data.hubs).flatMap(hub => hub.links.flatMap(([a, b]): [Point, Point][] => {
      const from = byId.get(a);
      const to = byId.get(b);
      return from && to ? [[[from.x, from.y], [to.x, to.y]]] : [];
    }));
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
    // Un trazado por facción, en años luz: al mover o ampliar el mapa solo cambia la transformación.
    this.territories = [...getTerritoryContours(this.index, this.data.systems, date)].map(([faction, loops]) => {
      const path = new Path2D();
      for (const loop of loops) {
        loop.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
        path.closePath();
      }
      return { color: this.data.factions[faction].color, path };
    });
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

  // De quién es el territorio bajo el puntero, aunque no haya una estrella cerca.
  ownerAt(screenX: number, screenY: number): string | null {
    const [x, y] = this.toWorld(screenX, screenY);
    const { originX, originY, cellSize, cols, rows, nearest } = this.index;
    const col = Math.round((x - originX) / cellSize);
    const row = Math.round((y - originY) / cellSize);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    const system = nearest[row * cols + col];
    return system < 0 ? null : this.owners[system];
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

  private draw() {
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#020309';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.starfield) context.drawImage(this.starfield, 0, 0);
    context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);

    this.drawTerritories();
    this.drawClusters();
    this.drawSystems();
  }

  private drawTerritories() {
    const context = this.context;
    const { scale } = this.view;
    // Transformación de años luz a píxeles, con el norte arriba.
    context.save();
    context.setTransform(
      this.ratio * scale, 0, 0, -this.ratio * scale,
      this.ratio * (this.width / 2 - this.view.x * scale), this.ratio * (this.height / 2 + this.view.y * scale)
    );
    context.lineJoin = 'round';
    for (const { color, path } of this.territories) {
      context.fillStyle = withAlpha(color, 0.2);
      context.fill(path, 'evenodd');
      // Brillo hacia dentro del borde, recortado al propio territorio para que no invada al vecino.
      context.save();
      context.clip(path, 'evenodd');
      context.strokeStyle = withAlpha(color, 0.28);
      context.lineWidth = (INNER_GLOW * 2) / scale;
      context.stroke(path);
      context.strokeStyle = withAlpha(color, 0.45);
      context.lineWidth = (INNER_GLOW * 0.8) / scale;
      context.stroke(path);
      context.restore();
    }
    // Los bordes van después de todos los rellenos: así ninguno queda tapado por el vecino.
    for (const { color, path } of this.territories) {
      context.strokeStyle = withAlpha(color, 0.35);
      context.lineWidth = BORDER_HALO / scale;
      context.stroke(path);
      context.strokeStyle = lighten(color, 0.35);
      context.lineWidth = BORDER_WIDTH / scale;
      context.stroke(path);
    }
    context.restore();
  }

  private drawClusters() {
    const context = this.context;
    context.lineJoin = 'round';
    for (const outline of this.clusterOutlines) {
      context.beginPath();
      outline.forEach(([x, y], i) => {
        const [sx, sy] = this.toScreen(x, y);
        if (i === 0) context.moveTo(sx, sy);
        else context.lineTo(sx, sy);
      });
      context.closePath();
      context.fillStyle = withAlpha(this.data.colors.cluster, 0.1);
      context.fill();
      context.lineWidth = 1.2;
      context.strokeStyle = withAlpha(this.data.colors.cluster, 0.75);
      context.stroke();
    }

    context.setLineDash([5, 4]);
    context.lineWidth = 1.6;
    context.strokeStyle = withAlpha(this.data.colors.hub, 0.9);
    context.beginPath();
    for (const [[ax, ay], [bx, by]] of this.hubLinks) {
      const [sx, sy] = this.toScreen(ax, ay);
      const [ex, ey] = this.toScreen(bx, by);
      context.moveTo(sx, sy);
      context.lineTo(ex, ey);
    }
    context.stroke();
    context.setLineDash([]);
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
