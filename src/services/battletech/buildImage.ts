import type { Zone } from '../../types/mech';
import type { BtBuild, BtHardpoint, BtItem } from '../../types/battletech-mechlab';
import { getHardpointViews, getLocationUsage, groupZoneEquipment, type EquipmentGroup, type HardpointView } from '../../utils/battletech/fitting';
import { getEquipmentCategory, getItemWeaponType, HARDPOINT_LABELS, WEIGHT_CLASS_LABELS } from '../../utils/battletech/mechlabData';
import { getBtReadouts } from '../../utils/battletech/readouts';
import { ZONE_LABELS } from '../../utils/zones';
import {
  CHIP_GAP, COLORS, MONO, SANS, chunk, drawGridBackground, drawSlotBars, drawText, getColumns, loadImage, measure, strokeBox, toPngBlob,
  withAlpha, wrapText, type Context
} from '../canvasDrawing';

// La build del MechLab de BATTLETECH en PNG, con la misma distribución que la del de MW5 (cabecera,
// lectura y las ocho ubicaciones alrededor de la ficha del 'Mech), para publicarla en Reddit o Discord.
// Lo propio de BATTLETECH: las armas también ocupan ranuras, cada pieza lleva su bonificación, el blindaje
// tiene máximo delante y detrás, y en el centro va el icono del chasis del juego, no la imagen de Sarna.
const SCALE = 2;
const WIDTH = 1400;
const PADDING = 32;
const GAP = 12;
const CARD_PADDING = 12;
const MIN_REFERENCE_HEIGHT = 380;
// El amarillo de la página del MechLab de BATTLETECH.
const ACCENT = '#ffd400';

// Los colores de anclaje del MechLab de MW5; el de apoyo es el que añade la página de BATTLETECH.
const WEAPON_COLORS: Record<BtHardpoint, string> = {
  ballistic: '#ffb703',
  energy: '#00d2ff',
  missile: '#4caf50',
  support: '#b9a4ff'
};
const EQUIPMENT_COLORS = { 'heat-sink': COLORS.cyan, 'jump-jet': COLORS.amber, module: COLORS.lime };
// En el orden de la pantalla de reequipar del juego.
const HARDPOINT_ORDER: BtHardpoint[] = ['ballistic', 'energy', 'missile', 'support'];

const HEADER_HEIGHT = 18;
const USAGE_HEIGHT = 16;
const WEAPON_CHIP_HEIGHT = 34;
const WEAPON_LINE_HEIGHT = 18;
const WEAPON_FONT = `700 14px ${SANS}`;
const DETAIL_FONT = `500 10px ${MONO}`;
const FREE_CHIP_HEIGHT = 40;
const ITEM_CHIP_HEIGHT = 28;
const ITEM_BONUS_HEIGHT = 14;
const SLOTS_HEIGHT = 14;
const ARMOR_HEIGHT = 26;
const SECTION_GAP = 8;

interface CardLayout {
  height: number;
  draw: (context: Context, x: number, y: number, height: number) => void;
}

const itemColor = (item: BtItem) => {
  const category = getEquipmentCategory(item);
  if (category === 'ammo') {
    const type = getItemWeaponType(item);
    return type ? WEAPON_COLORS[type] : '#888888';
  }
  return EQUIPMENT_COLORS[category];
};

// Lo que va a la derecha del arma: su bonificación o, si no tiene, las ranuras que ocupa.
const weaponDetail = (item: BtItem) => item.bonuses.length > 0 ? item.bonuses.join(' ') : `${item.slots} sl`;

const getWeaponLines = (context: Context, view: HardpointView, width: number) => {
  if (!view.item) return [];
  const detailWidth = measure(context, weaponDetail(view.item), DETAIL_FONT) + 10;
  // Si la bonificación es larga, el nombre se queda con la mitad de la ficha.
  return wrapText(context, view.item.name, WEAPON_FONT, Math.max(width / 2, width - 22 - detailWidth), 3);
};

const getChipHeight = (context: Context, view: HardpointView, width: number) =>
  view.item ? WEAPON_CHIP_HEIGHT + (getWeaponLines(context, view, width).length - 1) * WEAPON_LINE_HEIGHT : FREE_CHIP_HEIGHT;

const drawHardpointChip = (context: Context, view: HardpointView, x: number, y: number, width: number, height: number) => {
  const color = WEAPON_COLORS[view.type];
  if (!view.item) {
    strokeBox(context, x, y, width, height, color, true);
    drawText(context, HARDPOINT_LABELS[view.type].toUpperCase(), x + 9, y + 15, `600 10px ${MONO}`, color, { maxWidth: width - 18 });
    drawText(context, 'Free', x + 9, y + 32, `italic 500 12px ${SANS}`, COLORS.muted, { maxWidth: width - 18 });
    return;
  }
  const gradient = context.createLinearGradient(x, 0, x + width * 0.7, 0);
  gradient.addColorStop(0, withAlpha(color, 0.22));
  gradient.addColorStop(1, COLORS.chip);
  context.fillStyle = gradient;
  context.fillRect(x, y, width, height);
  strokeBox(context, x, y, width, height, view.isOver ? COLORS.red : color);
  context.fillStyle = color;
  context.fillRect(x, y, 4, height);
  const lines = getWeaponLines(context, view, width);
  const firstBaseline = y + height / 2 + 5 - (lines.length - 1) * WEAPON_LINE_HEIGHT / 2;
  lines.forEach((line, index) => drawText(context, line, x + 12, firstBaseline + index * WEAPON_LINE_HEIGHT, WEAPON_FONT, COLORS.text));
  drawText(context, weaponDetail(view.item), x + width - 10, y + height / 2 + 4, DETAIL_FONT, COLORS.muted, {
    align: 'right',
    maxWidth: width / 2 - 14
  });
};

// Equipo con su número, su bonificación debajo y «built-in» si viene fijo con el chasis.
const getEquipmentHeight = (group: EquipmentGroup) => ITEM_CHIP_HEIGHT + (group.item.bonuses.length > 0 ? ITEM_BONUS_HEIGHT : 0);

const drawEquipmentChip = (context: Context, group: EquipmentGroup, x: number, y: number, width: number, height: number) => {
  const { item, count, fixed } = group;
  const color = itemColor(item);
  context.fillStyle = COLORS.raised;
  context.fillRect(x, y, width, height);
  strokeBox(context, x, y, width, height, COLORS.line, fixed);
  context.fillStyle = color;
  context.fillRect(x, y, 3, height);
  const tag = fixed ? 'built-in' : count > 1 ? `×${count}` : '';
  const tagWidth = tag ? measure(context, tag, `600 11px ${MONO}`) + 6 : 0;
  const nameWidth = drawText(context, item.name, x + 12, y + 19, `600 13px ${SANS}`, COLORS.text, { maxWidth: width - 20 - tagWidth });
  if (tag) drawText(context, tag, x + 12 + nameWidth + 6, y + 19, `600 11px ${MONO}`, COLORS.muted);
  if (item.bonuses.length > 0) {
    drawText(context, item.bonuses.join(' ').toUpperCase(), x + 12, y + 33, `600 9px ${MONO}`, COLORS.amber, { maxWidth: width - 20 });
  }
};

// Los anclajes de la ubicación, como los iconos de la pantalla de reequipar: «2/2 BALLISTIC».
const drawLocationUsage = (context: Context, usage: ReturnType<typeof getLocationUsage>, x: number, y: number) => {
  let cursor = x;
  for (const type of HARDPOINT_ORDER) {
    const { used, capacity } = usage.hardpoints[type];
    const text = `${capacity > 0 ? `${used}/${capacity}` : '0'} ${HARDPOINT_LABELS[type].toUpperCase()}`;
    cursor += drawText(context, text, cursor, y + 11, `600 10px ${MONO}`, capacity > 0 ? WEAPON_COLORS[type] : withAlpha(COLORS.muted, 0.6)) + 12;
  }
};

const layoutCard = (measuring: Context, build: BtBuild, zone: Zone, width: number): CardLayout => {
  const { mech, loadout, armor } = build;
  const location = mech.locations[zone];
  const usage = getLocationUsage(mech, loadout, zone);
  const innerWidth = width - CARD_PADDING * 2;
  const views = getHardpointViews(mech, loadout, zone);
  const freeHardpoints = views.filter(view => !view.item).length;

  const hardpointColumns = getColumns(innerWidth, 190);
  const hardpointRows = chunk(views, hardpointColumns);
  const hardpointWidth = (innerWidth - CHIP_GAP * (hardpointColumns - 1)) / hardpointColumns;
  const getRowHeight = (row: HardpointView[]) => Math.max(...row.map(view => getChipHeight(measuring, view, hardpointWidth)));
  // El equipo con bonificación ocupa todo el ancho, como en el tablero de la página.
  const groups = groupZoneEquipment(mech, loadout, zone);
  const equipmentColumns = getColumns(innerWidth, 160);
  const equipmentRows: EquipmentGroup[][] = [];
  for (const group of groups) {
    const last = equipmentRows.at(-1);
    if (group.item.bonuses.length > 0) equipmentRows.push([group]);
    else if (last && last.length < equipmentColumns && last.every(entry => entry.item.bonuses.length === 0)) last.push(group);
    else equipmentRows.push([group]);
  }
  const getEquipmentRowHeight = (row: EquipmentGroup[]) => Math.max(...row.map(getEquipmentHeight));

  const stackHeight = (heights: number[], gap: number) =>
    heights.reduce((sum, height) => sum + height, 0) + gap * Math.max(0, heights.length - 1);
  const sections = [
    HEADER_HEIGHT,
    USAGE_HEIGHT,
    hardpointRows.length > 0 ? stackHeight(hardpointRows.map(getRowHeight), CHIP_GAP) : 0,
    equipmentRows.length > 0 ? stackHeight(equipmentRows.map(getEquipmentRowHeight), CHIP_GAP) : 0,
    SLOTS_HEIGHT,
    ARMOR_HEIGHT
  ].filter(section => section > 0);
  const height = CARD_PADDING * 2 + 2 + stackHeight(sections, SECTION_GAP);

  const draw = (context: Context, x: number, y: number, cardHeight: number) => {
    const isOver = usage.slots.used > usage.slots.capacity || HARDPOINT_ORDER.some(type => usage.hardpoints[type].used > usage.hardpoints[type].capacity);
    const accent = isOver ? COLORS.red : freeHardpoints > 0 ? COLORS.amber : ACCENT;
    context.fillStyle = COLORS.panel;
    context.fillRect(x, y, width, cardHeight);
    strokeBox(context, x, y, width, cardHeight, COLORS.line);
    context.fillStyle = accent;
    context.fillRect(x, y, width, 2);

    const left = x + CARD_PADDING;
    const right = x + width - CARD_PADDING;
    let top = y + 2 + CARD_PADDING;

    drawText(context, ZONE_LABELS[zone].toUpperCase(), left, top + 14, `700 14px ${SANS}`, COLORS.text);
    // La estructura de la ubicación, como «S 70/70» en la pantalla de reequipar del juego.
    const structure = `S ${location.structure}/${location.structure}`;
    const structureWidth = drawText(context, structure, right, top + 13, `500 10px ${MONO}`, COLORS.muted, { align: 'right' });
    if (freeHardpoints > 0) {
      const badge = `${freeHardpoints} FREE`;
      const badgeWidth = measure(context, badge, `500 10px ${MONO}`) + 12;
      const badgeRight = right - structureWidth - 10;
      strokeBox(context, badgeRight - badgeWidth, top, badgeWidth, HEADER_HEIGHT, withAlpha(COLORS.amber, 0.45));
      drawText(context, badge, badgeRight - 6, top + 13, `500 10px ${MONO}`, COLORS.amber, { align: 'right' });
    }
    top += HEADER_HEIGHT + SECTION_GAP;
    drawLocationUsage(context, usage, left, top);
    top += USAGE_HEIGHT + SECTION_GAP;

    hardpointRows.forEach((row, rowIndex) => {
      const rowHeight = getRowHeight(row);
      row.forEach((view, column) => drawHardpointChip(context, view, left + column * (hardpointWidth + CHIP_GAP), top, hardpointWidth, rowHeight));
      top += rowHeight + (rowIndex < hardpointRows.length - 1 ? CHIP_GAP : SECTION_GAP);
    });

    equipmentRows.forEach((row, rowIndex) => {
      const rowHeight = getEquipmentRowHeight(row);
      const columns = row.length === 1 && row[0].item.bonuses.length > 0 ? 1 : equipmentColumns;
      const chipWidth = (innerWidth - CHIP_GAP * (columns - 1)) / columns;
      row.forEach((group, column) => drawEquipmentChip(context, group, left + column * (chipWidth + CHIP_GAP), top, chipWidth, rowHeight));
      top += rowHeight + (rowIndex < equipmentRows.length - 1 ? CHIP_GAP : SECTION_GAP);
    });

    // Las ranuras y el blindaje quedan al pie de la tarjeta aunque la fila sea más alta, como en la web.
    const armorTop = y + cardHeight - CARD_PADDING - ARMOR_HEIGHT;
    drawSlotBars(context, [{ label: 'SLOTS', used: usage.slots.used, capacity: usage.slots.capacity, color: COLORS.cyan }], left, armorTop - SECTION_GAP - SLOTS_HEIGHT);

    context.fillStyle = COLORS.line;
    context.fillRect(left, armorTop, innerWidth, 1);
    const { front, rear } = armor[zone];
    const total = front + rear;
    const maximum = location.maxArmor + (location.maxRearArmor ?? 0);
    const isLow = total < maximum;
    const armorColor = isLow ? COLORS.amber : COLORS.muted;
    context.fillStyle = COLORS.meter;
    context.fillRect(left, armorTop + 13, 46, 5);
    context.fillStyle = isLow ? COLORS.amber : ACCENT;
    context.fillRect(left, armorTop + 13, maximum > 0 ? 46 * Math.min(1, total / maximum) : 0, 5);
    drawText(context, `ARMOR ${total} / ${maximum}`, left + 54, armorTop + 20, `500 10px ${MONO}`, armorColor);
    // Cada lado con su máximo, como en la pantalla de reequipar del juego.
    const sides = location.maxRearArmor !== null
      ? `FRONT ${front}/${location.maxArmor} · REAR ${rear}/${location.maxRearArmor}`
      : `${front}/${location.maxArmor}`;
    drawText(context, sides, right, armorTop + 20, `500 10px ${MONO}`, armorColor, { align: 'right' });
  };

  return { height, draw };
};

const drawHeader = (context: Context, build: BtBuild) => {
  const { mech } = build;
  context.fillStyle = ACCENT;
  context.fillRect(PADDING, PADDING, 42, 42);
  drawText(context, 'M', PADDING + 21, PADDING + 30, `600 22px ${MONO}`, '#1a1600', { align: 'center' });
  drawText(context, 'FIELD CONFIGURATION SYSTEM', PADDING + 55, PADDING + 12, `500 10px ${MONO}`, COLORS.muted);
  const brandWidth = drawText(context, 'MechLab', PADDING + 55, PADDING + 38, `700 24px ${SANS}`, COLORS.text);
  drawText(context, 'BATTLETECH', PADDING + 55 + brandWidth + 8, PADDING + 38, `600 17px ${MONO}`, ACCENT);

  drawText(context, `${mech.tonnage} t · ${WEIGHT_CLASS_LABELS[mech.weightClass].toUpperCase()}`, WIDTH - PADDING, PADDING + 12, `500 10px ${MONO}`, COLORS.muted, {
    align: 'right'
  });
  const variantWidth = drawText(context, mech.variant, WIDTH - PADDING, PADDING + 38, `600 17px ${MONO}`, ACCENT, { align: 'right' });
  drawText(context, mech.name, WIDTH - PADDING - variantWidth - 10, PADDING + 38, `700 24px ${SANS}`, COLORS.text, {
    align: 'right',
    maxWidth: WIDTH / 2 - PADDING - variantWidth
  });
  context.fillStyle = COLORS.line;
  context.fillRect(PADDING, PADDING + 52, WIDTH - PADDING * 2, 1);
};

const READOUT_HEIGHT = 64;
const READOUT_COLUMNS = 5;

// Las diez cifras de la lectura de la página (getBtReadouts), en 5 × 2.
const drawReadouts = (context: Context, build: BtBuild, y: number) => {
  const width = WIDTH - PADDING * 2;
  const cellWidth = width / READOUT_COLUMNS;
  context.fillStyle = COLORS.panel;
  context.fillRect(PADDING, y, width, READOUT_HEIGHT * 2);
  strokeBox(context, PADDING, y, width, READOUT_HEIGHT * 2, COLORS.line);
  context.fillStyle = COLORS.line;
  context.fillRect(PADDING, y + READOUT_HEIGHT, width, 1);
  for (let column = 1; column < READOUT_COLUMNS; column += 1) context.fillRect(PADDING + column * cellWidth, y, 1, READOUT_HEIGHT * 2);

  getBtReadouts(build).forEach((readout, index) => {
    const x = PADDING + (index % READOUT_COLUMNS) * cellWidth + 14;
    const cellY = y + Math.floor(index / READOUT_COLUMNS) * READOUT_HEIGHT;
    drawText(context, readout.label, x, cellY + 22, `500 10px ${MONO}`, COLORS.muted);
    const valueWidth = drawText(context, readout.value, x, cellY + 48, `600 18px ${MONO}`, readout.warn ? COLORS.red : ACCENT);
    if (readout.unit) drawText(context, readout.unit, x + valueWidth + 7, cellY + 48, `400 11px ${MONO}`, COLORS.muted);
  });
};

// Ficha central: nombre, variante, peso, clase, rol de serie y el icono del chasis del juego.
const drawReference = (context: Context, build: BtBuild, icon: HTMLImageElement | null, x: number, y: number, width: number, height: number) => {
  const { mech } = build;
  const glow = context.createRadialGradient(x + width / 2, y + height / 2, 0, x + width / 2, y + height / 2, width * 0.6);
  glow.addColorStop(0, withAlpha(ACCENT, 0.035));
  glow.addColorStop(1, 'rgba(16, 19, 16, 0.8)');
  context.fillStyle = COLORS.background;
  context.fillRect(x, y, width, height);
  context.fillStyle = glow;
  context.fillRect(x, y, width, height);
  strokeBox(context, x, y, width, height, COLORS.line);

  const tagWidth = measure(context, mech.variant, `500 11px ${MONO}`) + 16;
  const tagX = x + width - 12 - tagWidth;
  drawText(context, mech.name, x + 12, y + 30, `600 18px ${SANS}`, COLORS.text, { maxWidth: width - tagWidth - 36 });
  context.fillStyle = withAlpha(ACCENT, 0.1);
  context.fillRect(tagX, y + 12, tagWidth, 24);
  strokeBox(context, tagX, y + 12, tagWidth, 24, withAlpha(ACCENT, 0.45));
  drawText(context, mech.variant, tagX + tagWidth / 2, y + 28, `500 11px ${MONO}`, ACCENT, { align: 'center' });

  const spec = [`${mech.tonnage} t`, WEIGHT_CLASS_LABELS[mech.weightClass], mech.role].filter(Boolean).join(' · ');
  drawText(context, spec.toUpperCase(), x + 12, y + 56, `600 11px ${MONO}`, COLORS.muted, { maxWidth: width - 24 });

  const imageTop = y + 70;
  const imageHeight = height - 70 - 12;
  if (!icon) return;
  // El icono del juego es pequeño (128 px): no se agranda más del doble para que no se vea borroso.
  const scale = Math.min((width - 24) / icon.width, imageHeight / icon.height, 2);
  const drawWidth = icon.width * scale;
  const drawHeight = icon.height * scale;
  context.drawImage(icon, x + (width - drawWidth) / 2, imageTop + (imageHeight - drawHeight) / 2, drawWidth, drawHeight);
};

export const renderBtBuildImage = async (build: BtBuild): Promise<Blob> => {
  await Promise.all([
    document.fonts.load(`700 14px ${SANS}`),
    document.fonts.load(`600 13px ${SANS}`),
    document.fonts.load(`italic 500 12px ${SANS}`),
    document.fonts.load(`500 10px ${MONO}`),
    document.fonts.load(`600 18px ${MONO}`)
  ]).catch(() => undefined);
  const icon = build.mech.icon ? await loadImage(`${import.meta.env.BASE_URL}mechlab/icons/${build.mech.icon}.png`) : null;

  // El alto de las tarjetas depende del texto, así que se mide en un canvas auxiliar antes de crear el definitivo.
  const measuring = document.createElement('canvas').getContext('2d');
  if (!measuring) throw new Error('Canvas not available');

  const unit = (WIDTH - PADDING * 2 - GAP * 2) / 3.15;
  const columnWidths = [unit, unit * 1.15, unit];
  const columnX = [PADDING, PADDING + unit + GAP, PADDING + unit * 2.15 + GAP * 2];
  const card = (zone: Zone, column: number) => ({ column, layout: layoutCard(measuring, build, zone, columnWidths[column]) });

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
  const boardY = readoutY + READOUT_HEIGHT * 2 + 16;
  const boardHeight = rowHeights.reduce((sum, height) => sum + height, 0) + GAP * (rows.length - 1);
  const footerY = boardY + boardHeight + 20;
  const height = footerY + 44;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas not available');
  context.scale(SCALE, SCALE);

  drawGridBackground(context, WIDTH, height);
  drawHeader(context, build);
  drawReadouts(context, build, readoutY);

  let rowY = boardY;
  rows.forEach((row, rowIndex) => {
    row.forEach(({ column, layout }) => layout.draw(context, columnX[column], rowY, rowHeights[rowIndex]));
    rowY += rowHeights[rowIndex] + GAP;
  });
  drawReference(context, build, icon, columnX[1], boardY + rowHeights[0] + GAP, columnWidths[1], rowHeights[1] + GAP + rowHeights[2]);

  context.fillStyle = COLORS.line;
  context.fillRect(PADDING, footerY, WIDTH - PADDING * 2, 1);
  drawText(context, 'mw-builder.com/battletech', PADDING, footerY + 27, `600 15px ${MONO}`, ACCENT);
  drawText(context, 'Fan-made tool, not affiliated with Harebrained Schemes or Paradox Interactive', WIDTH - PADDING, footerY + 27, `500 11px ${MONO}`, COLORS.muted, {
    align: 'right'
  });

  return toPngBlob(canvas);
};
