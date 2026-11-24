import type { Zone } from '../../types/mech';
import type { YamlBuild, YamlHardpointType, YamlItem, YamlMech } from '../../types/yaml-mechlab';
import { mountItem, mountWeapon } from './build';
import { getYamlItem, yamlItemIds } from './data';
import {
  GENERAL_SLOT, getBuildTonnage, getDynamicFillers, getFixedFillers, getFreeGeneralSlots, getTotalFreeGeneralSlots
} from './stats';

// Lo que necesita la página del MechLab de YAML para pintar el tablero y el selector de objetos.

export const ZONES: Zone[] = ['head', 'centerTorso', 'leftTorso', 'rightTorso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

// Ranuras con una sola pieza que se cambia por otra (las «Standard» del mechlab del juego), en el orden
// en que las enseña el juego en la cabeza y el torso central.
export const INTERNAL_SLOTS = [
  'Defensive_SlotType', 'Sensors', 'Targeting', 'LifeSupport', 'cockpit',
  'Armorslot', 'Structureslot', 'enginecooling', 'Gyro', 'EngineTypeSlot', 'Engine'
] as const;

export const INTERNAL_SLOT_LABELS: Record<string, string> = {
  Defensive_SlotType: 'Defensive', Sensors: 'Sensors', Targeting: 'FCS', LifeSupport: 'Life support', cockpit: 'Cockpit',
  Armorslot: 'Armor', Structureslot: 'Structure', enginecooling: 'Engine heat sinks', Gyro: 'Gyro',
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
// Versiones que no se eligen en el selector: los niveles de las armas (el nivel va en la build) y las
// armas de vehículos, torretas y armaduras de combate.
const HIDDEN_IDS = /_Lvl\d+$|_Turret|Vehicle|Elemental/i;
// Equipo que no se monta a mano: los rellenos, la chatarra para reparar y las piezas internas.
const HIDDEN_CATEGORIES = /^Equipment\.(Filler|Salvage)/;

export interface InternalOption {
  id: string;
  name: string;
}

export function getInternalLabel(build: YamlBuild, slotType: string): string {
  const id = build.internal[slotType];
  return id ? getYamlItem(id)?.name ?? id : EMPTY_INTERNAL_LABELS[slotType] ?? slotType;
}

// Las piezas que admite una ranura interna. Las versiones «_FIXED» son las de serie de algunos 'Mechs,
// con el mismo nombre: solo sale una de cada nombre, la que no es fija.
export function getInternalOptions(slotType: string, current?: string): InternalOption[] {
  const byName = new Map<string, InternalOption>();
  for (const id of yamlItemIds()) {
    const item = getYamlItem(id)!;
    if (!item.slotTypes?.includes(slotType)) continue;
    const previous = byName.get(item.name);
    if (!previous || (previous.id.endsWith('_FIXED') && !id.endsWith('_FIXED'))) byName.set(item.name, { id, name: item.name });
  }
  if (current && ![...byName.values()].some(option => option.id === current) && getYamlItem(current)) {
    byName.set(`${getYamlItem(current)!.name} `, { id: current, name: getYamlItem(current)!.name });
  }
  const options = [...byName.values()];
  if (slotType === 'Engine') options.sort((a, b) => (getYamlItem(a.id)?.rating ?? 0) - (getYamlItem(b.id)?.rating ?? 0));
  else options.sort((a, b) => a.name.localeCompare(b.name));
  return options;
}

export function distributeDynamicFillers(mech: YamlMech, build: YamlBuild): Record<Zone, number> {
  let remaining = getDynamicFillers(build);
  const placed = Object.fromEntries(ZONES.map(zone => [zone, 0])) as Record<Zone, number>;
  for (const zone of FILLER_ORDER) {
    const amount = Math.min(remaining, Math.max(0, getFreeGeneralSlots(mech, build, zone)));
    placed[zone] = amount;
    remaining -= amount;
  }
  return placed;
}

export type ZoneRow =
  | { kind: 'weapon'; label: string; slots: number; hardpoint: string; item: string }
  | { kind: 'item'; label: string; slots: number; index: number; slotType: string }
  | { kind: 'fixedFiller' | 'dynamicFiller'; label: string; slots: number }
  | { kind: 'free'; slots: number };

// Lo que ocupa las ranuras generales y las propias de equipo (no las internas) de una ubicación.
export function getZoneRows(mech: YamlMech, build: YamlBuild, zone: Zone, dynamicFillers: Record<Zone, number>): ZoneRow[] {
  const rows: ZoneRow[] = [];
  for (const weapon of build.weapons.filter(mounted => mounted.zone === zone)) {
    const item = getYamlItem(weapon.item);
    rows.push({ kind: 'weapon', label: item?.name ?? weapon.item, slots: item?.slots ?? 1, hardpoint: weapon.hardpoint, item: weapon.item });
  }
  build.items.forEach((mounted, index) => {
    if (mounted.zone !== zone) return;
    const item = getYamlItem(mounted.item);
    const slots = mounted.slotType === GENERAL_SLOT ? item?.slots ?? 1 : 1;
    rows.push({ kind: 'item', label: item?.name ?? mounted.item, slots, index, slotType: mounted.slotType });
  });
  for (const id of Object.values(build.internal)) {
    const fixed = getYamlItem(id)?.fillerSlots?.[zone];
    if (fixed) rows.push({ kind: 'fixedFiller', label: getYamlItem(id)!.name, slots: fixed });
  }
  if (dynamicFillers[zone]) rows.push({ kind: 'dynamicFiller', label: 'Dynamic filler', slots: dynamicFillers[zone] });
  const free = getFreeGeneralSlots(mech, build, zone) - dynamicFillers[zone];
  if (free > 0) rows.push({ kind: 'free', slots: free });
  return rows;
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

export type MountCategory = 'weapons' | 'ammo' | 'equipment';

export interface MountOption {
  id: string;
  item: YamlItem;
  error?: string;
}

function inCategory(item: YamlItem, category: MountCategory): boolean {
  if (category === 'weapons') return item.kind === 'weapon' && item.hardpoint !== 'melee';
  if (category === 'ammo') return item.kind === 'ammo';
  if (item.kind !== 'equipment' || HIDDEN_CATEGORIES.test(item.category ?? '')) return false;
  return !(item.slotTypes ?? []).some(slotType => (INTERNAL_SLOTS as readonly string[]).includes(slotType));
}

// Los objetos de una categoría que se podrían montar en una ubicación, con el motivo de los que no caben.
// Las armas sin anclaje de su tipo en la ubicación no salen: no caben por mucho sitio que haya.
export function getMountOptions(mech: YamlMech, build: YamlBuild, zone: Zone, category: MountCategory, query = ''): MountOption[] {
  const text = query.trim().toLowerCase();
  const hardpointTypes = new Set(mech.zones[zone].hardpoints.map(hardpoint => hardpoint.type));
  const options: MountOption[] = [];
  for (const id of yamlItemIds()) {
    const item = getYamlItem(id)!;
    if (HIDDEN_IDS.test(id) || !inCategory(item, category) || (text && !item.name.toLowerCase().includes(text))) continue;
    if (category === 'weapons' && !hardpointTypes.has(item.hardpoint!) && !hardpointTypes.has('omni')) continue;
    const result = category === 'weapons' ? mountWeapon(mech, build, zone, id) : mountItem(mech, build, zone, id);
    options.push({ id, item, error: result.error });
  }
  return options.sort((a, b) => Number(!!a.error) - Number(!!b.error) || a.item.name.localeCompare(b.item.name));
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
      issues.push({ severity: 'error', message: `${zone}: not enough slots (${getFixedFillers(build, zone)} fixed by the engine)` });
    }
  }
  if (!build.internal.Engine) issues.push({ severity: 'warning', message: 'No engine core installed' });
  return issues;
}
