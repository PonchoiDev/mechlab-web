import type { Zone } from '../../types/mech';
import type { YamlBuild, YamlHardpointType, YamlMech } from '../../types/yaml-mechlab';
import { getDefaultTier } from './combat';
import { getYamlItem } from './data';
import {
  GENERAL_SLOT, getBuildTonnage, getCritSplitFillers, getFixedFillers, getFreeGeneralSlots, getUnplacedCritSplits,
  getWeaponSlotsInZone
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

// GetMechpartsInFillerPositioningOrder: el orden en que InstallRequiredFillers pone los rellenos dinámicos.
const FILLER_ORDER: Zone[] = ['centerTorso', 'leftTorso', 'rightTorso', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'head'];
export function getInternalLabel(build: YamlBuild, slotType: string): string {
  const id = build.internal[slotType];
  return id ? getYamlItem(id)?.name ?? id : EMPTY_INTERNAL_LABELS[slotType] ?? slotType;
}

export interface FillerGroup {
  // La ranura de la pieza que los pide (Structureslot del Endo, Armorslot del Ferro): da su color.
  slotType: string;
  slots: number;
}

// La build de serie sin cambios en lo montado: conserva los rellenos que trae su loadout.
function isStockLoadout(mech: YamlMech, build: YamlBuild): boolean {
  const key = (value: YamlBuild) => JSON.stringify([
    Object.entries(value.internal).sort(),
    value.items.map(item => `${item.zone}|${item.slotType}|${item.item}`).sort(),
    value.weapons.map(weapon => `${weapon.zone}|${weapon.hardpoint}|${weapon.item}|${weapon.tier ?? ''}`).sort()
  ]);
  return key(build) === key(mech.stock);
}

// Los rellenos dinámicos de cada pieza en cada ubicación. Con cualquier cambio, YAML los quita y los vuelve a poner
// (UpdateFillersOnLoadout): InstallRequiredFillers pone uno de una ranura en cada ubicación con sitio por vuelta, en
// el orden de FILLER_ORDER, y BuildFillerEquipmentMapping los reparte entre las piezas recorriendo las ubicaciones
// en el orden del loadout (las nuevas, al final, en el orden en que reciben rellenos) y las piezas en el suyo.
export function distributeDynamicFillerGroups(mech: YamlMech, build: YamlBuild): Record<Zone, FillerGroup[]> {
  const placed = Object.fromEntries(ZONES.map(zone => [zone, []])) as unknown as Record<Zone, FillerGroup[]>;
  if (mech.stockFillers && isStockLoadout(mech, build)) {
    for (const { zone, slotType, slots } of mech.stockFillers) placed[zone].push({ slotType, slots });
    return placed;
  }
  const dynamic = (slotType: string) => getYamlItem(build.internal[slotType])?.fillerSlots?.dynamic ?? 0;
  const owners = [...(mech.fillerOwners ?? []), ...Object.keys(build.internal)]
    .filter((slotType, index, list) => list.indexOf(slotType) === index && dynamic(slotType) > 0);
  let remaining = owners.reduce((sum, slotType) => sum + dynamic(slotType), 0);
  const free = Object.fromEntries(FILLER_ORDER.map(zone => [zone, Math.max(0, getFreeGeneralSlots(mech, build, zone))])) as Record<Zone, number>;
  const counts = Object.fromEntries(ZONES.map(zone => [zone, 0])) as Record<Zone, number>;
  const firstPlaced: Zone[] = [];
  for (let progress = true; remaining > 0 && progress;) {
    progress = false;
    for (const zone of FILLER_ORDER) {
      if (remaining === 0 || free[zone] < 1) continue;
      if (counts[zone] === 0) firstPlaced.push(zone);
      counts[zone]++;
      free[zone]--;
      remaining--;
      progress = true;
    }
  }
  const zoneOrder = [...(mech.fillerZoneOrder ?? []), ...firstPlaced].filter((zone, index, list) => list.indexOf(zone) === index);
  let owner = 0;
  let left = owners.length > 0 ? dynamic(owners[0]) : 0;
  for (const zone of zoneOrder) {
    for (let slots = counts[zone]; slots > 0 && owner < owners.length;) {
      const take = Math.min(slots, left);
      const last = placed[zone][placed[zone].length - 1];
      if (last?.slotType === owners[owner]) last.slots += take;
      else placed[zone].push({ slotType: owners[owner], slots: take });
      slots -= take;
      left -= take;
      if (left === 0 && ++owner < owners.length) left = dynamic(owners[owner]);
    }
  }
  return placed;
}

export function distributeDynamicFillers(mech: YamlMech, build: YamlBuild): Record<Zone, number> {
  const groups = distributeDynamicFillerGroups(mech, build);
  return Object.fromEntries(ZONES.map(zone => [zone, groups[zone].reduce((sum, group) => sum + group.slots, 0)])) as Record<Zone, number>;
}

export type ZoneRow =
  // slots: las que ocupa en su ubicación; totalSlots, las del arma, si reparte el resto con una contigua.
  | { kind: 'weapon'; label: string; slots: number; totalSlots: number; hardpoint: string; item: string; tier: number }
  // El resto de un arma repartida, en la ubicación contigua.
  | { kind: 'splitFiller'; label: string; slots: number; item: string; from: Zone }
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
  for (const filler of getCritSplitFillers(mech, build).filter(split => split.zone === zone)) {
    rows.push({ kind: 'splitFiller', label: getYamlItem(filler.item)?.name ?? filler.item, slots: filler.slots, item: filler.item, from: filler.from });
  }
  const pieces: ZoneRow[] = [];
  for (const weapon of build.weapons.filter(mounted => mounted.zone === zone && !getYamlItem(mounted.item)?.actuator)) {
    const item = getYamlItem(weapon.item);
    pieces.push({
      kind: 'weapon', label: item?.name ?? weapon.item, slots: getWeaponSlotsInZone(mech, build, weapon.hardpoint),
      totalSlots: item?.slots ?? 1, hardpoint: weapon.hardpoint, item: weapon.item,
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
  // Los rellenos dinámicos que no caben no son un problema: al cargar un loadout, YAML ignora el fallo de
  // UpdateFillersOnLoadout y se queda con los que caben (CN9-CALM, 24 de 28). Lo que no deja es montar una pieza
  // si después no caben todos (InstallWeaponOrEquipmentIntoSpecificSlot), y eso lo comprueba build.ts.
  for (const zone of ZONES) {
    if (getFreeGeneralSlots(mech, build, zone) < 0) {
      issues.push({ severity: 'error', message: `${zone}: not enough slots (${getFixedFillers(build, zone)} fixed by the engine)`, zone });
    }
  }
  for (const split of getUnplacedCritSplits(mech, build)) {
    const name = getYamlItem(split.item)?.name ?? split.item;
    issues.push({ severity: 'error', message: `${split.zone}: ${name} needs ${split.slots} more slots in an adjacent location`, zone: split.zone });
  }
  if (!build.internal.Engine) issues.push({ severity: 'warning', message: 'No engine core installed' });
  return issues;
}

// Las armas de cuerpo a cuerpo de los actuadores (la «Mano de asalto»), que el juego enseña bajo la mano.
export function getActuatorWeapons(build: YamlBuild, zone: Zone) {
  return build.weapons.filter(weapon => weapon.zone === zone && getYamlItem(weapon.item)?.actuator);
}
