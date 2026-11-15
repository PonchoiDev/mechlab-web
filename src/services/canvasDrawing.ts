// Utilidades para dibujar las imágenes para compartir de los MechLabs (MW5 y BATTLETECH) en un canvas:
// colores, fuentes, textos que se recortan o se parten en líneas, cajas y barras de ranuras. Las medidas
// son píxeles lógicos; cada imagen decide su escala.
export const CHIP_GAP = 5;

export const COLORS = {
  background: '#101310',
  panel: '#191d19',
  raised: '#202620',
  chip: '#262d26',
  line: '#343d34',
  text: '#e8eee5',
  muted: '#929d90',
  lime: '#c3ed62',
  cyan: '#69d9ce',
  amber: '#f2b75e',
  red: '#ff796c',
  meter: '#2a312a'
};

export const SANS = "'Manrope', 'Segoe UI', sans-serif";

export const MONO = "'IBM Plex Mono', Consolas, monospace";

export type Context = CanvasRenderingContext2D;

export const withAlpha = (hex: string, alpha: number) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

export const loadImage = (src: string): Promise<HTMLImageElement | null> => new Promise(resolve => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});

export const fit = (context: Context, text: string, maxWidth: number) => {
  if (context.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && context.measureText(`${text.slice(0, end)}…`).width > maxWidth) end -= 1;
  return `${text.slice(0, end)}…`;
};

// Escribe un texto y devuelve su ancho, para encadenar varios en la misma línea.
export const drawText = (
  context: Context,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  options: { align?: CanvasTextAlign; maxWidth?: number } = {}
): number => {
  context.font = font;
  context.fillStyle = color;
  context.textAlign = options.align ?? 'left';
  const shown = options.maxWidth ? fit(context, text, options.maxWidth) : text;
  context.fillText(shown, x, y);
  return context.measureText(shown).width;
};

export const measure = (context: Context, text: string, font: string) => {
  context.font = font;
  return context.measureText(text).width;
};

// Parte el texto en líneas que quepan en el ancho; la última se recorta si no hay más líneas.
export const wrapText = (context: Context, text: string, font: string, maxWidth: number, maxLines: number): string[] => {
  context.font = font;
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || context.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines - 1), fit(context, lines.slice(maxLines - 1).join(' '), maxWidth)];
};

export const strokeBox = (context: Context, x: number, y: number, width: number, height: number, color: string, dashed = false) => {
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.setLineDash(dashed ? [4, 3] : []);
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  context.setLineDash([]);
};

// Columnas de una rejilla auto-fill con un ancho mínimo por celda, como en el CSS del tablero.
export const getColumns = (width: number, minWidth: number, gap = CHIP_GAP) => Math.max(1, Math.floor((width + gap) / (minWidth + gap)));

export const chunk = <T>(values: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, index * size + size));

// Barras de slots del pie de la tarjeta: generales y, si las hay, las especiales.
export const drawSlotBars = (context: Context, bars: { label: string; used: number; capacity: number; color: string }[], x: number, y: number) => {
  let barX = x;
  for (const bar of bars) {
    barX += drawText(context, bar.label, barX, y + 10, `500 10px ${MONO}`, COLORS.muted) + 6;
    const cells = Math.max(bar.capacity, bar.used);
    for (let cell = 0; cell < cells; cell += 1) {
      const cellX = barX + cell * 10;
      if (cell >= bar.capacity || cell < bar.used) {
        context.fillStyle = cell >= bar.capacity ? COLORS.red : bar.color;
        context.fillRect(cellX, y + 2, 8, 8);
      } else {
        strokeBox(context, cellX, y + 2, 8, 8, COLORS.muted);
      }
    }
    barX += cells * 10 + 4;
    barX += drawText(context, `${bar.used}/${bar.capacity}`, barX, y + 10, `500 10px ${MONO}`, COLORS.muted) + 16;
  }
};

// Fondo oscuro con la rejilla tenue de la web.
export const drawGridBackground = (context: Context, width: number, height: number) => {
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = 'rgba(255, 255, 255, 0.018)';
  for (let x = 0; x < width; x += 32) context.fillRect(x, 0, 1, height);
  for (let y = 0; y < height; y += 32) context.fillRect(0, y, width, 1);
};

export const toPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not render the image')), 'image/png');
});
