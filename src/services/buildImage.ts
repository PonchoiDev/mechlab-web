import type { HardpointType } from '../types/item';
import type { ArmorState, EquippedLoadout, Mech, Zone } from '../types/mech';
import type { Upgrade } from '../types/upgrade';
import { truncateTo, type BuildSummary } from '../utils/calculators';
import {
  getAmmoWarnings,
  getComponentStatus,
  getEquipmentCategory,
  getHardpointName,
  getHardpointViews,
  getSlotTypeLabel,
  groupEquipment,
  type AmmoWarning,
  type HardpointView
} from '../utils/equipment';
import { getItemWeaponType, getTierName } from '../utils/items';
import { getMechDisplayName, getMechSpecs, type SpecKind } from '../utils/mechs';
import { getUsedUpgradeSlots } from '../utils/upgrades';
import { ZONE_LABELS } from '../utils/zones';

// Tarjeta de la build en PNG con la misma distribución que el tablero de la web, para publicarla
// como imagen en Reddit o Discord. Las medidas son píxeles lógicos; el PNG sale a doble resolución.
const SCALE = 2;
const WIDTH = 1400;
const PADDING = 32;
const GAP = 12;
const CARD_PADDING = 12;
const CHIP_GAP = 5;
const MIN_REFERENCE_HEIGHT = 380;

const COLORS = {
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

const WEAPON_COLORS: Record<HardpointType, string> = {
  energy: '#00d2ff',
  ballistic: '#ffb703',
  missile: '#4caf50',
  artillery: '#ff7a45',
  ams: '#e91e63',
  melee: '#9c27b0',
  omni: '#d8dfd4'
};

// Colores de las especificaciones, los mismos que la cabecera del mechlab del juego (MechSpecs).
const SPEC_COLORS: Record<SpecKind, string> = {
  engine: COLORS.text,
  xl: '#ffd23f',
  dhs: '#5fa8ff',
  endo: '#b48cff',
  ferro: '#ff5a4f',
  ap: COLORS.cyan
};

const EQUIPMENT_COLORS = { 'heat-sink': COLORS.cyan, 'jump-jet': COLORS.amber, module: COLORS.lime };

const SANS = "'Manrope', 'Segoe UI', sans-serif";
const MONO = "'IBM Plex Mono', Consolas, monospace";

const AMMO_WARNING_TEXT: Record<AmmoWarning['kind'], string> = {
  'missing-ammo': 'no ammo',
  'unused-ammo': 'no weapon uses it'
};

export interface BuildImageInput {
  mech: Mech;
  loadout: EquippedLoadout;
  armor: ArmorState;
  // Con las mejoras de la cantina ya aplicadas a summary.
  summary: BuildSummary;
  upgrades: Upgrade[];
  imageUrl: string | null;
}

type Context = CanvasRenderingContext2D;

const getWeightClassName = (tonnage: number) =>
  tonnage <= 35 ? 'LIGHT' : tonnage <= 55 ? 'MEDIUM' : tonnage <= 75 ? 'HEAVY' : 'ASSAULT';

const withAlpha = (hex: string, alpha: number) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

const loadImage = (src: string): Promise<HTMLImageElement | null> => new Promise(resolve => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});

// Las imágenes de Sarna pasan por el proxy del Worker para que el canvas se pueda exportar.
const getProxiedImageUrl = (imageUrl: string) =>
  `${import.meta.env.BASE_URL}api/sarna-image?url=${encodeURIComponent(imageUrl)}`;

const fit = (context: Context, text: string, maxWidth: number) => {
  if (context.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && context.measureText(`${text.slice(0, end)}…`).width > maxWidth) end -= 1;
  return `${text.slice(0, end)}…`;
};

// Escribe un texto y devuelve su ancho, para encadenar varios en la misma línea.
const drawText = (
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

const measure = (context: Context, text: string, font: string) => {
  context.font = font;
  return context.measureText(text).width;
};

// Parte el texto en líneas que quepan en el ancho; la última se recorta si no hay más líneas.
const wrapText = (context: Context, text: string, font: string, maxWidth: number, maxLines: number): string[] => {
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

const strokeBox = (context: Context, x: number, y: number, width: number, height: number, color: string, dashed = false) => {
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.setLineDash(dashed ? [4, 3] : []);
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  context.setLineDash([]);
};

// Columnas de una rejilla auto-fill con un ancho mínimo por celda, como en el CSS del tablero.
const getColumns = (width: number, minWidth: number) => Math.max(1, Math.floor((width + CHIP_GAP) / (minWidth + CHIP_GAP)));

const chunk = <T>(values: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, index * size + size));

// --- Tarjetas de componente ---------------------------------------------------------------------

const HEADER_HEIGHT = 18;
const WEAPON_CHIP_HEIGHT = 34;
const WEAPON_LINE_HEIGHT = 18;
const WEAPON_FONT = `700 14px ${SANS}`;
const TIER_FONT = `500 11px ${MONO}`;
const FREE_CHIP_HEIGHT = 40;
const ITEM_CHIP_HEIGHT = 28;
const WARNING_HEIGHT = 22;
const SLOTS_HEIGHT = 14;
const ARMOR_HEIGHT = 26;
const SECTION_GAP = 8;

interface CardLayout {
  height: number;
  draw: (context: Context, x: number, y: number, height: number) => void;
}

// Nombre del arma partido en líneas, dejando sitio al tier a la derecha, como en la web.
const getWeaponLines = (context: Context, view: HardpointView, width: number) => {
  if (!view.weapon) return [];
  const tier = getTierName(view.weapon);
  const tierWidth = tier ? measure(context, tier, TIER_FONT) + 10 : 0;
  return wrapText(context, view.weapon.name, WEAPON_FONT, width - 22 - tierWidth, 3);
};

const getChipHeight = (context: Context, view: HardpointView, width: number) =>
  view.weapon ? WEAPON_CHIP_HEIGHT + (getWeaponLines(context, view, width).length - 1) * WEAPON_LINE_HEIGHT : FREE_CHIP_HEIGHT;

const drawHardpointChip = (context: Context, view: HardpointView, x: number, y: number, width: number, height: number) => {
  const { weapon } = view;
  const color = WEAPON_COLORS[(weapon && getItemWeaponType(weapon)) || view.hardpoint.type];

  if (weapon) {
    const gradient = context.createLinearGradient(x, 0, x + width * 0.7, 0);
    gradient.addColorStop(0, withAlpha(color, 0.22));
    gradient.addColorStop(1, COLORS.chip);
    context.fillStyle = gradient;
    context.fillRect(x, y, width, height);
    strokeBox(context, x, y, width, height, color);
    context.fillStyle = color;
    context.fillRect(x, y, 4, height);

    const lines = getWeaponLines(context, view, width);
    const firstBaseline = y + height / 2 + 5 - (lines.length - 1) * WEAPON_LINE_HEIGHT / 2;
    lines.forEach((line, index) => drawText(context, line, x + 12, firstBaseline + index * WEAPON_LINE_HEIGHT, WEAPON_FONT, COLORS.text));
    const tier = getTierName(weapon);
    if (tier) drawText(context, tier, x + width - 10, y + height / 2 + 4, TIER_FONT, COLORS.muted, { align: 'right' });
    return;
  }

  strokeBox(context, x, y, width, height, color, true);
  drawText(context, getHardpointName(view.hardpoint).toUpperCase(), x + 9, y + 15, `600 10px ${MONO}`, color, { maxWidth: width - 18 });
  drawText(context, view.builtInWeapon ?? 'Free', x + 9, y + 32, `italic 500 12px ${SANS}`, COLORS.muted, { maxWidth: width - 18 });
};

const drawEquipmentChip = (context: Context, name: string, count: number, color: string, x: number, y: number, width: number) => {
  context.fillStyle = COLORS.raised;
  context.fillRect(x, y, width, ITEM_CHIP_HEIGHT);
  strokeBox(context, x, y, width, ITEM_CHIP_HEIGHT, COLORS.line);
  context.fillStyle = color;
  context.fillRect(x, y, 3, ITEM_CHIP_HEIGHT);

  const countText = count > 1 ? `×${count}` : '';
  const countWidth = countText ? measure(context, countText, `600 11px ${MONO}`) + 6 : 0;
  const nameWidth = drawText(context, name, x + 12, y + 19, `600 13px ${SANS}`, COLORS.text, { maxWidth: width - 20 - countWidth });
  if (countText) drawText(context, countText, x + 12 + nameWidth + 6, y + 19, `600 11px ${MONO}`, COLORS.muted);
};

// Barras de slots del pie de la tarjeta: generales y, si las hay, las especiales.
const drawSlotBars = (context: Context, bars: { label: string; used: number; capacity: number; color: string }[], x: number, y: number) => {
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

const layoutCard = (measuring: Context, input: BuildImageInput, zone: Zone, width: number, warnings: AmmoWarning[]): CardLayout => {
  const component = input.mech.components[zone];
  const items = input.loadout[zone];
  const status = getComponentStatus(component, items);
  const innerWidth = width - CARD_PADDING * 2;

  const hardpointColumns = getColumns(innerWidth, 190);
  const hardpointRows = chunk(getHardpointViews(component.hardpoints, items), hardpointColumns);
  const hardpointWidth = (innerWidth - CHIP_GAP * (hardpointColumns - 1)) / hardpointColumns;
  const getRowHeight = (row: HardpointView[]) => Math.max(...row.map(view => getChipHeight(measuring, view, hardpointWidth)));
  const equipmentColumns = getColumns(innerWidth, 160);
  const equipmentRows = chunk(groupEquipment(items), equipmentColumns);
  const slotBars = [
    { label: 'SLOTS', used: status.usedSlots, capacity: status.maxSlots, color: COLORS.cyan },
    ...status.specialSlots.map(slot => ({
      label: getSlotTypeLabel(slot.slotType).toUpperCase(),
      used: slot.used,
      capacity: slot.capacity,
      color: COLORS.amber
    }))
  ].filter(bar => bar.capacity > 0 || bar.used > 0);

  const stackHeight = (heights: number[], gap: number) =>
    heights.reduce((sum, height) => sum + height, 0) + gap * Math.max(0, heights.length - 1);
  const sections = [
    HEADER_HEIGHT,
    hardpointRows.length > 0 ? stackHeight(hardpointRows.map(getRowHeight), CHIP_GAP) : 0,
    equipmentRows.length > 0 ? stackHeight(equipmentRows.map(() => ITEM_CHIP_HEIGHT), CHIP_GAP) : 0,
    warnings.length > 0 ? stackHeight(warnings.map(() => WARNING_HEIGHT), 3) : 0,
    slotBars.length > 0 ? SLOTS_HEIGHT : 0,
    ARMOR_HEIGHT
  ].filter(section => section > 0);
  const height = CARD_PADDING * 2 + 2 + stackHeight(sections, SECTION_GAP);

  const draw = (context: Context, x: number, y: number, cardHeight: number) => {
    const accent = status.isOverSlots ? COLORS.red : status.hasFreeSpace ? COLORS.amber : COLORS.lime;
    context.fillStyle = COLORS.panel;
    context.fillRect(x, y, width, cardHeight);
    strokeBox(context, x, y, width, cardHeight, COLORS.line);
    context.fillStyle = accent;
    context.fillRect(x, y, width, 2);

    const left = x + CARD_PADDING;
    let top = y + 2 + CARD_PADDING;

    drawText(context, ZONE_LABELS[zone].toUpperCase(), left, top + 14, `700 14px ${SANS}`, COLORS.text);
    if (status.freeHardpoints > 0) {
      const badge = `${status.freeHardpoints} FREE`;
      const badgeWidth = measure(context, badge, `500 10px ${MONO}`) + 12;
      strokeBox(context, x + width - CARD_PADDING - badgeWidth, top, badgeWidth, HEADER_HEIGHT, withAlpha(COLORS.amber, 0.45));
      drawText(context, badge, x + width - CARD_PADDING - 6, top + 13, `500 10px ${MONO}`, COLORS.amber, { align: 'right' });
    }
    top += HEADER_HEIGHT + SECTION_GAP;

    hardpointRows.forEach((row, rowIndex) => {
      const rowHeight = getRowHeight(row);
      row.forEach((view, column) => drawHardpointChip(context, view, left + column * (hardpointWidth + CHIP_GAP), top, hardpointWidth, rowHeight));
      top += rowHeight + (rowIndex < hardpointRows.length - 1 ? CHIP_GAP : SECTION_GAP);
    });

    const equipmentWidth = (innerWidth - CHIP_GAP * (equipmentColumns - 1)) / equipmentColumns;
    equipmentRows.forEach((row, rowIndex) => {
      row.forEach(({ item, count }, column) => {
        const category = getEquipmentCategory(item);
        const color = category === 'ammo' ? item.weaponType ? WEAPON_COLORS[item.weaponType] : '#888888' : EQUIPMENT_COLORS[category];
        drawEquipmentChip(context, item.name, count, color, left + column * (equipmentWidth + CHIP_GAP), top, equipmentWidth);
      });
      top += ITEM_CHIP_HEIGHT + (rowIndex < equipmentRows.length - 1 ? CHIP_GAP : SECTION_GAP);
    });

    warnings.forEach(warning => {
      context.fillStyle = withAlpha(COLORS.amber, 0.08);
      context.fillRect(left, top, innerWidth, WARNING_HEIGHT);
      context.fillStyle = COLORS.amber;
      context.fillRect(left, top, 2, WARNING_HEIGHT);
      drawText(context, `${warning.itemName}: ${AMMO_WARNING_TEXT[warning.kind]}`, left + 9, top + 15, `500 11px ${SANS}`, COLORS.amber, {
        maxWidth: innerWidth - 16
      });
      top += WARNING_HEIGHT + 3;
    });

    // Los slots y la armadura quedan al pie de la tarjeta aunque la fila sea más alta, como en la web.
    const armorTop = y + cardHeight - CARD_PADDING - ARMOR_HEIGHT;
    if (slotBars.length > 0) drawSlotBars(context, slotBars, left, armorTop - SECTION_GAP - SLOTS_HEIGHT);

    context.fillStyle = COLORS.line;
    context.fillRect(left, armorTop, innerWidth, 1);
    const { front, rear } = input.armor[zone];
    const total = front + rear;
    const isLow = total < component.maxArmor;
    const armorColor = isLow ? COLORS.amber : COLORS.muted;
    context.fillStyle = COLORS.meter;
    context.fillRect(left, armorTop + 13, 46, 5);
    context.fillStyle = isLow ? COLORS.amber : COLORS.lime;
    context.fillRect(left, armorTop + 13, component.maxArmor > 0 ? 46 * Math.min(1, total / component.maxArmor) : 0, 5);
    drawText(context, `ARMOR ${total} / ${component.maxArmor}`, left + 54, armorTop + 20, `500 10px ${MONO}`, armorColor);
    if (component.hasRearArmor) {
      drawText(context, `FRONT ${front} · REAR ${rear}`, x + width - CARD_PADDING, armorTop + 20, `500 10px ${MONO}`, armorColor, { align: 'right' });
    }
  };

  return { height, draw };
};

// --- Composición ---------------------------------------------------------------------------------

const getReadouts = ({ mech, summary }: BuildImageInput) => [
  { label: 'TONNAGE', value: truncateTo(summary.totalWeight, 2).toFixed(2), unit: `/ ${mech.tonnageMax} t`, warn: summary.totalWeight > mech.tonnageMax },
  { label: 'ARMOR POINTS', value: summary.armorPoints.toFixed(0), unit: `/ ${summary.maxArmorPoints.toFixed(0)}` },
  { label: 'ARMOR MASS', value: truncateTo(summary.armorWeight, 2).toFixed(2), unit: 't' },
  {
    label: 'TOP SPEED',
    value: summary.topSpeed.toFixed(1),
    unit: summary.boostedSpeed !== null ? `km/h · ${summary.boostedSpeed.toFixed(1)} boost` : 'km/h'
  },
  { label: 'JUMP JETS', value: String(summary.jumpJetCount) },
  { label: 'VOLLEY DAMAGE', value: String(summary.firepower) },
  { label: 'MELEE DAMAGE', value: String(summary.meleeDamage) },
  { label: 'HEAT SPIKE', value: String(summary.heatSpike) },
  {
    label: 'TOTAL COOLING RATE',
    value: summary.coolingRate === null ? 'N/A' : summary.coolingRate.toFixed(1),
    unit: summary.coolingRate === null ? undefined : 'heat/s'
  },
  { label: 'MAX WEAPON RANGE', value: summary.maxWeaponRange > 0 ? `${Math.floor(summary.maxWeaponRange)} m` : '—' }
];

const drawHeader = (context: Context, mech: Mech) => {
  context.fillStyle = COLORS.lime;
  context.fillRect(PADDING, PADDING, 42, 42);
  drawText(context, 'M', PADDING + 21, PADDING + 30, `600 22px ${MONO}`, '#18200f', { align: 'center' });
  drawText(context, 'FIELD CONFIGURATION SYSTEM', PADDING + 55, PADDING + 12, `500 10px ${MONO}`, COLORS.muted);
  const brandWidth = drawText(context, 'MechLab', PADDING + 55, PADDING + 38, `700 24px ${SANS}`, COLORS.text);
  drawText(context, 'MW5: MERCENARIES', PADDING + 55 + brandWidth + 8, PADDING + 38, `600 17px ${MONO}`, COLORS.lime);

  drawText(context, `${mech.tonnageMax} t · ${getWeightClassName(mech.tonnageMax)}`, WIDTH - PADDING, PADDING + 12, `500 10px ${MONO}`, COLORS.muted, {
    align: 'right'
  });
  const variantWidth = drawText(context, mech.variant, WIDTH - PADDING, PADDING + 38, `600 17px ${MONO}`, COLORS.lime, { align: 'right' });
  drawText(context, getMechDisplayName(mech), WIDTH - PADDING - variantWidth - 10, PADDING + 38, `700 24px ${SANS}`, COLORS.text, {
    align: 'right',
    maxWidth: WIDTH / 2 - PADDING - variantWidth
  });
  context.fillStyle = COLORS.line;
  context.fillRect(PADDING, PADDING + 52, WIDTH - PADDING * 2, 1);
};

const READOUT_HEIGHT = 64;
const READOUT_COLUMNS = 5;

// Franja de estadísticas en 5 × 2, como la de la web.
const drawReadouts = (context: Context, input: BuildImageInput, y: number) => {
  const width = WIDTH - PADDING * 2;
  const cellWidth = width / READOUT_COLUMNS;
  context.fillStyle = COLORS.panel;
  context.fillRect(PADDING, y, width, READOUT_HEIGHT * 2);
  strokeBox(context, PADDING, y, width, READOUT_HEIGHT * 2, COLORS.line);
  context.fillStyle = COLORS.line;
  context.fillRect(PADDING, y + READOUT_HEIGHT, width, 1);
  for (let column = 1; column < READOUT_COLUMNS; column += 1) context.fillRect(PADDING + column * cellWidth, y, 1, READOUT_HEIGHT * 2);

  getReadouts(input).forEach((readout, index) => {
    const x = PADDING + (index % READOUT_COLUMNS) * cellWidth + 14;
    const cellY = y + Math.floor(index / READOUT_COLUMNS) * READOUT_HEIGHT;
    drawText(context, readout.label, x, cellY + 22, `500 10px ${MONO}`, COLORS.muted);
    const valueWidth = drawText(context, readout.value, x, cellY + 48, `600 18px ${MONO}`, readout.warn ? COLORS.red : COLORS.lime);
    if (readout.unit) drawText(context, readout.unit, x + valueWidth + 7, cellY + 48, `400 11px ${MONO}`, COLORS.muted);
  });
};

const UPGRADE_CHIP_HEIGHT = 24;
const UPGRADE_FONT = `500 11px ${MONO}`;

// Franja con las mejoras de la cantina instaladas, en fichas que pasan a la línea siguiente si no caben.
const layoutUpgrades = (context: Context, input: BuildImageInput) => {
  const { mech, upgrades } = input;
  if (upgrades.length === 0) return { height: 0, draw: () => undefined };

  const width = WIDTH - PADDING * 2;
  const title = `CANTINA UPGRADES ${getUsedUpgradeSlots(upgrades)}/${mech.upgradeSlots ?? 0}`;
  const startX = PADDING + 14 + measure(context, title, `500 10px ${MONO}`) + 14;
  const chips: { text: string; x: number; row: number; width: number }[] = [];
  let x = startX;
  let row = 0;
  for (const upgrade of upgrades) {
    const text = `${upgrade.name} · ${upgrade.description}`;
    const chipWidth = measure(context, text, UPGRADE_FONT) + 16;
    if (x + chipWidth > PADDING + width - 14 && x > startX) {
      x = startX;
      row += 1;
    }
    chips.push({ text, x, row, width: chipWidth });
    x += chipWidth + 6;
  }
  const height = (row + 1) * (UPGRADE_CHIP_HEIGHT + 6) + 14;

  const draw = (target: Context, y: number) => {
    target.fillStyle = COLORS.panel;
    target.fillRect(PADDING, y, width, height);
    strokeBox(target, PADDING, y, width, height, COLORS.line);
    drawText(target, title, PADDING + 14, y + 26, `500 10px ${MONO}`, COLORS.muted);
    for (const chip of chips) {
      const chipY = y + 10 + chip.row * (UPGRADE_CHIP_HEIGHT + 6);
      target.fillStyle = withAlpha(COLORS.cyan, 0.1);
      target.fillRect(chip.x, chipY, chip.width, UPGRADE_CHIP_HEIGHT);
      strokeBox(target, chip.x, chipY, chip.width, UPGRADE_CHIP_HEIGHT, withAlpha(COLORS.cyan, 0.45));
      drawText(target, chip.text, chip.x + 8, chipY + 16, UPGRADE_FONT, COLORS.cyan);
    }
  };

  return { height, draw };
};

// Panel central con el nombre y el dibujo del mech, entre los torsos y los brazos.
const drawReference = (context: Context, mech: Mech, image: HTMLImageElement | null, x: number, y: number, width: number, height: number) => {
  const glow = context.createRadialGradient(x + width / 2, y + height / 2, 0, x + width / 2, y + height / 2, width * 0.6);
  glow.addColorStop(0, 'rgba(105, 217, 206, 0.08)');
  glow.addColorStop(1, 'rgba(16, 19, 16, 0.8)');
  context.fillStyle = COLORS.background;
  context.fillRect(x, y, width, height);
  context.fillStyle = glow;
  context.fillRect(x, y, width, height);
  strokeBox(context, x, y, width, height, COLORS.line);

  const tagWidth = measure(context, mech.variant, `500 11px ${MONO}`) + 16;
  const tagX = x + width - 12 - tagWidth;
  drawText(context, mech.name, x + 12, y + 30, `600 18px ${SANS}`, COLORS.text, { maxWidth: width - tagWidth - 36 });
  context.fillStyle = withAlpha(COLORS.cyan, 0.1);
  context.fillRect(tagX, y + 12, tagWidth, 24);
  strokeBox(context, tagX, y + 12, tagWidth, 24, withAlpha(COLORS.cyan, 0.45));
  drawText(context, mech.variant, tagX + tagWidth / 2, y + 28, `500 11px ${MONO}`, COLORS.cyan, { align: 'center' });

  // Motor, disipadores, estructura y armadura bajo el nombre, como en el tablero de la web.
  let specX = x + 12;
  for (const spec of getMechSpecs(mech)) {
    specX += drawText(context, spec.label, specX, y + 56, `600 13px ${MONO}`, SPEC_COLORS[spec.kind]) + 8;
  }

  const imageTop = y + 70;
  const imageHeight = height - 70 - 12;
  if (!image) {
    drawText(context, 'No reference image available.', x + width / 2, imageTop + imageHeight / 2, `500 13px ${SANS}`, COLORS.muted, { align: 'center' });
    return;
  }
  const scale = Math.min((width - 24) / image.width, imageHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, imageTop + (imageHeight - drawHeight) / 2, drawWidth, drawHeight);
};

export const renderBuildImage = async (input: BuildImageInput): Promise<Blob> => {
  const { mech, loadout } = input;
  await Promise.all([
    document.fonts.load(`700 14px ${SANS}`),
    document.fonts.load(`600 13px ${SANS}`),
    document.fonts.load(`italic 500 12px ${SANS}`),
    document.fonts.load(`500 10px ${MONO}`),
    document.fonts.load(`600 18px ${MONO}`)
  ]).catch(() => undefined);
  const image = input.imageUrl ? await loadImage(getProxiedImageUrl(input.imageUrl)) : null;

  // El alto de las tarjetas depende del texto, así que se mide en un canvas auxiliar antes de crear el definitivo.
  const measuring = document.createElement('canvas').getContext('2d');
  if (!measuring) throw new Error('Canvas not available');

  const unit = (WIDTH - PADDING * 2 - GAP * 2) / 3.15;
  const columnWidths = [unit, unit * 1.15, unit];
  const columnX = [PADDING, PADDING + unit + GAP, PADDING + unit * 2.15 + GAP * 2];
  const warnings = getAmmoWarnings(loadout);
  const card = (zone: Zone, column: number) =>
    ({ column, layout: layoutCard(measuring, input, zone, columnWidths[column], warnings[zone]) });

  // Rejilla del tablero: '. head .' / 'LT ref RT' / 'LA ref RA' / 'LL CT RL'.
  const rows = [
    [card('head', 1)],
    [card('leftTorso', 0), card('rightTorso', 2)],
    [card('leftArm', 0), card('rightArm', 2)],
    [card('leftLeg', 0), card('centerTorso', 1), card('rightLeg', 2)]
  ];
  const rowHeights = rows.map(row => Math.max(...row.map(({ layout }) => layout.height)));
  const referenceShortfall = MIN_REFERENCE_HEIGHT - (rowHeights[1] + GAP + rowHeights[2]);
  if (referenceShortfall > 0) {
    rowHeights[1] += Math.ceil(referenceShortfall / 2);
    rowHeights[2] += Math.floor(referenceShortfall / 2);
  }

  const readoutY = PADDING + 64;
  const upgradesLayout = layoutUpgrades(measuring, input);
  const upgradesY = readoutY + READOUT_HEIGHT * 2 + 16;
  const boardY = upgradesY + (upgradesLayout.height > 0 ? upgradesLayout.height + 16 : 0);
  const boardHeight = rowHeights.reduce((sum, height) => sum + height, 0) + GAP * (rows.length - 1);
  const footerY = boardY + boardHeight + 20;
  const height = footerY + 44;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas not available');
  context.scale(SCALE, SCALE);

  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, WIDTH, height);
  context.fillStyle = 'rgba(255, 255, 255, 0.018)';
  for (let x = 0; x < WIDTH; x += 32) context.fillRect(x, 0, 1, height);
  for (let y = 0; y < height; y += 32) context.fillRect(0, y, WIDTH, 1);

  drawHeader(context, mech);
  drawReadouts(context, input, readoutY);
  upgradesLayout.draw(context, upgradesY);

  let rowY = boardY;
  rows.forEach((row, rowIndex) => {
    row.forEach(({ column, layout }) => layout.draw(context, columnX[column], rowY, rowHeights[rowIndex]));
    rowY += rowHeights[rowIndex] + GAP;
  });
  drawReference(context, mech, image, columnX[1], boardY + rowHeights[0] + GAP, columnWidths[1], rowHeights[1] + GAP + rowHeights[2]);

  // Pie con la web y los créditos.
  context.fillStyle = COLORS.line;
  context.fillRect(PADDING, footerY, WIDTH - PADDING * 2, 1);
  drawText(context, 'mw-builder.com/mercs', PADDING, footerY + 27, `600 15px ${MONO}`, COLORS.lime);
  const credits = image
    ? 'Mech image: Sarna.net · Fan-made tool, not affiliated with Piranha Games'
    : 'Fan-made tool, not affiliated with Piranha Games';
  drawText(context, credits, WIDTH - PADDING, footerY + 27, `500 11px ${MONO}`, COLORS.muted, { align: 'right' });

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not render the image')), 'image/png');
  });
};
