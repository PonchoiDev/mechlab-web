import type { Zone } from '../../types/mech';
import type { YamlBuild, YamlHardpointType, YamlMech } from '../../types/yaml-mechlab';
import { getDefaultTier } from './combat';
import { getYamlItem } from './data';
import {
  GENERAL_SLOT, getBuildTonnage, getDynamicFillers, getFixedFillers, getFreeGeneralSlots, getTotalFreeGeneralSlots
} from './stats';

// Lo que necesita la página del MechLab de YAML para pintar el tablero.

export const ZONES: Zone[] = ['head', 'centerTorso', 'leftTorso', 'rightTorso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

// Ranuras con una sola pieza que se cambia por otra (las «Standard» del mechlab del juego), en el orden
// en que las enseña el juego en la cabeza y el torso central.
export const INTERNAL_SLOTS = [
  'Defensive_SlotType', 'Sensors', 'Targeting', 'LifeSupport', 'cockpit',
  'Armorslot', 'Structureslot', 'enginecooling', 'Gyro', 'EngineTypeSlot', 'Engine'
] as const;

export const INTERNAL_SLOT_LABELS: Record<string, string> = {
  Defensive_SlotType: 'Defensive', Sensors: 'Sensors', Targeting: 'FCS', LifeSupport: 'Life support', cockpit: 'Cockpit',
  Armorslot: 'Armor', Structureslot: 'Structure', enginecooling: 'Heat sinks', Gyro: 'Gyro',
  EngineTypeSlot: 'Engine type', Engine: 'Engine core'
};

// Sin pieza, cada ranura interna lleva la estándar (o ninguna, en el sistema defensivo y el núcleo).
const EMPTY_INTERNAL_LABELS: Record<string, string> = {
  Defensive_SlotType: 'Defensive none', Sensors: 'Sensors standard', Targeting: 'FCS standard',
  LifeSupport: 'Life support standard', cockpit: 'Cockpit standard', Armorslot: 'Armor standard',
  Structureslot: 'Structure standard', enginecooling: 'Engine single heat sinks', Gyro: 'Gyro standard',
  EngineTypeSlot: 'Standard engine', Engine: 'No core installed'
};

// Los rellenos dinámicos van en las ranuras libres; el juego los reparte por todo el 'Mech y aquí se
// colocan de las ubicaciones con más ranuras a las de menos.
const FILLER_ORDER: Zone[] = ['rightTorso', 'leftTorso', 'rightArm', 'leftArm', 'centerTorso', 'rightLeg', 'leftLeg', 'head'];
export function getInternalLabel(build: YamlBuild, slotType: string): string {
  const id = build.internal[slotType];
  return id ? getYamlItem(id)?.name ?? id : EMPTY_INTERNAL_LABELS[slotType] ?? slotType;
}

export interface FillerGroup {
  // La ranura de la pieza que los pide (Structureslot del Endo, Armorslot del Ferro): da su color.
  slotType: string;
  slots: number;
}

// Los rellenos dinámicos de cada pieza, uno tras otro, en las ranuras libres de cada ubicación.
export function distributeDynamicFillerGroups(mech: YamlMech, build: YamlBuild): Record<Zone, FillerGroup[]> {
  const placed = Object.fromEntries(ZONES.map(zone => [zone, []])) as unknown as Record<Zone, FillerGroup[]>;
  const free = Object.fromEntries(FILLER_ORDER.map(zone => [zone, Math.max(0, getFreeGeneralSlots(mech, build, zone))])) as Record<Zone, number>;
  for (const [slotType, id] of Object.entries(build.internal)) {
    let remaining = getYamlItem(id)?.fillerSlots?.dynamic ?? 0;
    for (const zone of FILLER_ORDER) {
      const amount = Math.min(remaining, free[zone]);
      if (amount === 0) continue;
      placed[zone].push({ slotType, slots: amount });
      free[zone] -= amount;
      remaining -= amount;
    }
  }
  return placed;
}

export function distributeDynamicFillers(mech: YamlMech, build: YamlBuild): Record<Zone, number> {
  const groups = distributeDynamicFillerGroups(mech, build);
  return Object.fromEntries(ZONES.map(zone => [zone, groups[zone].reduce((sum, group) => sum + group.slots, 0)])) as Record<Zone, number>;
}

export type ZoneRow =
  | { kind: 'weapon'; label: string; slots: number; hardpoint: string; item: string; tier: number }
  | { kind: 'item'; label: string; slots: number; index: number; slotType: string }
  | { kind: 'fixedFiller' | 'dynamicFiller'; label: string; slots: number; slotType: string }
  | { kind: 'free'; slots: number };

// Lo que ocupa las ranuras generales y las propias de equipo (no las internas) de una ubicación.
// Las ranuras generales de una ubicación en el orden del mechlab del juego: el relleno fijo del motor, las
// piezas de mayor a menor (a igual tamaño, el arma delante: ER PPC y luego el disipador doble), los rellenos
// dinámicos y las ranuras libres. Detrás, lo montado en ranuras propias (los disipadores del motor), que el
// juego enseña con su tamaño aunque no ocupe ranuras generales.
export function getZoneRows(mech: YamlMech, build: YamlBuild, zone: Zone, fillers: Record<Zone, FillerGroup[]>): ZoneRow[] {
  const rows: ZoneRow[] = [];
  for (const [slotType, id] of Object.entries(build.internal)) {
    const fixed = getYamlItem(id)?.fillerSlots?.[zone];
    if (fixed) rows.push({ kind: 'fixedFiller', label: getYamlItem(id)!.name, slots: fixed, slotType });
  }
  const pieces: ZoneRow[] = [];
  for (const weapon of build.weapons.filter(mounted => mounted.zone === zone && !getYamlItem(mounted.item)?.actuator)) {
    const item = getYamlItem(weapon.item);
    pieces.push({
      kind: 'weapon', label: item?.name ?? weapon.item, slots: item?.slots ?? 1, hardpoint: weapon.hardpoint, item: weapon.item,
      tier: weapon.tier ?? getDefaultTier(weapon.item)
    });
  }
  const special: ZoneRow[] = [];
  build.items.forEach((mounted, index) => {
    if (mounted.zone !== zone) return;
    const item = getYamlItem(mounted.item);
    const row: ZoneRow = { kind: 'item', label: item?.name ?? mounted.item, slots: item?.slots ?? 1, index, slotType: mounted.slotType };
    (mounted.slotType === GENERAL_SLOT ? pieces : special).push(row);
  });
  rows.push(...pieces.sort((a, b) => b.slots - a.slots || Number(b.kind === 'weapon') - Number(a.kind === 'weapon')));
  for (const group of fillers[zone]) {
    rows.push({ kind: 'dynamicFiller', label: getInternalLabel(build, group.slotType), slots: group.slots, slotType: group.slotType });
  }
  const free = getFreeGeneralSlots(mech, build, zone) - fillers[zone].reduce((sum, group) => sum + group.slots, 0);
  if (free > 0) rows.push({ kind: 'free', slots: free });
  return [...rows, ...special];
}

export interface HardpointUsage {
  type: YamlHardpointType;
  used: number;
  total: number;
}

export function getHardpointUsage(mech: YamlMech, build: YamlBuild, zone: Zone): HardpointUsage[] {
  const used = new Set(build.weapons.filter(weapon => weapon.zone === zone).map(weapon => weapon.hardpoint));
  const usage = new Map<YamlHardpointType, HardpointUsage>();
  for (const hardpoint of mech.zones[zone].hardpoints) {
    if (hardpoint.type === 'melee') continue;
    const entry = usage.get(hardpoint.type) ?? { type: hardpoint.type, used: 0, total: 0 };
    entry.total += 1;
    if (used.has(hardpoint.id)) entry.used += 1;
    usage.set(hardpoint.type, entry);
  }
  return [...usage.values()];
}

export function removeItemAt(build: YamlBuild, index: number): YamlBuild {
  return { ...build, items: build.items.filter((_, position) => position !== index) };
}

// La armadura de una ubicación: delante y detrás comparten el máximo, como en el mechlab del juego
// (torso central del NSR-9J: 100 + 20 de 120).
export function setArmor(mech: YamlMech, build: YamlBuild, zone: Zone, side: 'front' | 'rear', value: number): YamlBuild {
  const current = build.armor[zone];
  const other = side === 'front' ? current.rear : current.front;
  const limit = Math.max(0, mech.zones[zone].maxArmor - other);
  const clamped = Math.min(limit, Math.max(0, Math.round(value)));
  return { ...build, armor: { ...build.armor, [zone]: { ...current, [side]: clamped } } };
}

export function setMaxArmor(mech: YamlMech, build: YamlBuild): YamlBuild {
  const armor = { ...build.armor };
  for (const zone of ZONES) {
    const data = mech.zones[zone];
    const rear = data.rear ? Math.min(armor[zone].rear, data.maxArmor) : 0;
    armor[zone] = { front: data.maxArmor - rear, rear };
  }
  return { ...build, armor };
}

export interface BuildIssue {
  severity: 'error' | 'warning';
  message: string;
  zone?: Zone;
}

export function getBuildIssues(mech: YamlMech, build: YamlBuild): BuildIssue[] {
  const issues: BuildIssue[] = [];
  const tonnage = getBuildTonnage(mech, build);
  if (tonnage > mech.tonnage) issues.push({ severity: 'error', message: `Overweight by ${Math.round((tonnage - mech.tonnage) * 100) / 100} t` });
  const needed = getDynamicFillers(build);
  const free = getTotalFreeGeneralSlots(mech, build);
  if (needed > free) issues.push({ severity: 'error', message: `Dynamic fillers need ${needed} free slots; only ${free} left` });
  for (const zone of ZONES) {
    if (getFreeGeneralSlots(mech, build, zone) < 0) {
      issues.push({ severity: 'error', message: `${zone}: not enough slots (${getFixedFillers(build, zone)} fixed by the engine)`, zone });
    }
  }
  if (!build.internal.Engine) issues.push({ severity: 'warning', message: 'No engine core installed' });
  return issues;
}

// Las armas de cuerpo a cuerpo de los actuadores (la «Mano de asalto»), que el juego enseña bajo la mano.
export function getActuatorWeapons(build: YamlBuild, zone: Zone) {
  return build.weapons.filter(weapon => weapon.zone === zone && getYamlItem(weapon.item)?.actuator);
}
