import type { Zone } from '../../types/mech';
import type { YamlBuild, YamlHardpointType, YamlMech } from '../../types/yaml-mechlab';
import { getYamlItem } from './data';
import { GENERAL_SLOT, getDynamicFillers, getFixedFillers, getFreeGeneralSlots, getTotalFreeGeneralSlots } from './stats';

export type MountResult = { build: YamlBuild; error?: undefined } | { build?: undefined; error: string };

// Los anclajes omni de los omnimechs admiten armas balísticas, de energía y de misiles.
const OMNI_TYPES: YamlHardpointType[] = ['ballistic', 'energy', 'missile'];

export function createStockBuild(mech: YamlMech): YamlBuild {
  return structuredClone(mech.stock);
}

// «Strip 'Mech»: quita las armas, la munición y el equipo; las piezas internas y la armadura se quedan.
export function stripBuild(build: YamlBuild): YamlBuild {
  return { ...build, internal: { ...build.internal }, items: [], weapons: [] };
}

export function setInternal(build: YamlBuild, slotType: string, itemId: string | null): YamlBuild {
  const internal = { ...build.internal };
  if (itemId) internal[slotType] = itemId;
  else delete internal[slotType];
  return { ...build, internal };
}

export function removeWeapon(build: YamlBuild, hardpoint: string): YamlBuild {
  return { ...build, weapons: build.weapons.filter(weapon => weapon.hardpoint !== hardpoint) };
}

function dynamicFillersProblem(mech: YamlMech, build: YamlBuild): string | null {
  const needed = getDynamicFillers(build);
  const free = getTotalFreeGeneralSlots(mech, build);
  return needed > free ? `Needs ${needed} free slots for dynamic fillers; only ${free} left` : null;
}

// Por qué no cabe una pieza interna (motor, estructura, armadura...), o null si cabe: sus rellenos fijos
// tienen que caber en su ubicación y los dinámicos en las ranuras libres del 'Mech.
export function checkInternal(mech: YamlMech, build: YamlBuild, slotType: string, itemId: string): string | null {
  const candidate = setInternal(build, slotType, itemId);
  for (const zone of Object.keys(mech.zones) as Zone[]) {
    const free = getFreeGeneralSlots(mech, candidate, zone);
    if (free < 0) return `Needs ${getFixedFillers(candidate, zone)} free slots in ${zone}`;
  }
  return dynamicFillersProblem(mech, candidate);
}

function acceptsWeapon(hardpointType: YamlHardpointType, weaponType: YamlHardpointType | undefined): boolean {
  return hardpointType === weaponType || (hardpointType === 'omni' && !!weaponType && OMNI_TYPES.includes(weaponType));
}

// Con un anclaje elegido, el arma va en él (sustituyendo la que tenga); si no, en el primero libre de su tipo.
export function mountWeapon(mech: YamlMech, build: YamlBuild, zone: Zone, itemId: string, hardpointId?: string): MountResult {
  const item = getYamlItem(itemId);
  if (!item || item.kind !== 'weapon') return { error: 'Not a weapon' };
  if (hardpointId) build = removeWeapon(build, hardpointId);
  const used = new Set(build.weapons.map(weapon => weapon.hardpoint));
  const hardpoint = mech.zones[zone].hardpoints.find(point => !used.has(point.id) && acceptsWeapon(point.type, item.hardpoint)
    && (!hardpointId || point.id === hardpointId));
  if (!hardpoint) return { error: `No free ${item.hardpoint} hardpoint` };
  const free = getFreeGeneralSlots(mech, build, zone);
  if (free < item.slots) return { error: `Needs ${item.slots} slots; only ${free} free` };
  const next = { ...build, weapons: [...build.weapons, { zone, hardpoint: hardpoint.id, item: itemId }] };
  const fillers = dynamicFillersProblem(mech, next);
  return fillers ? { error: fillers } : { build: next };
}

// Munición y equipo: en una ranura general si la admite y, si no, en una ranura propia libre.
export function mountItem(mech: YamlMech, build: YamlBuild, zone: Zone, itemId: string): MountResult {
  const item = getYamlItem(itemId);
  if (!item || item.kind === 'weapon') return { error: 'Not equipment' };
  const slotTypes = item.slotTypes ?? [GENERAL_SLOT];
  if (slotTypes.includes(GENERAL_SLOT)) {
    const free = getFreeGeneralSlots(mech, build, zone);
    if (free >= item.slots) {
      const next = { ...build, items: [...build.items, { zone, slotType: GENERAL_SLOT, item: itemId }] };
      const fillers = dynamicFillersProblem(mech, next);
      return fillers ? { error: fillers } : { build: next };
    }
  }
  for (const slotType of slotTypes.filter(type => type !== GENERAL_SLOT)) {
    const capacity = mech.zones[zone].special[slotType] ?? 0;
    const used = build.items.filter(mounted => mounted.zone === zone && mounted.slotType === slotType).length;
    if (used < capacity) return { build: { ...build, items: [...build.items, { zone, slotType, item: itemId }] } };
  }
  return { error: `No free slot for ${item.name}` };
}

export type RemovableKind = 'weapon' | 'ammo' | 'equipment';

// Los botones Remove weapons, Remove ammo y Remove equipment de la barra de herramientas.
export function removeKind(build: YamlBuild, kind: RemovableKind): YamlBuild {
  if (kind === 'weapon') return { ...build, weapons: [] };
  return { ...build, items: build.items.filter(mounted => (getYamlItem(mounted.item)?.kind === 'ammo') !== (kind === 'ammo')) };
}

export function clearArmor(build: YamlBuild): YamlBuild {
  const armor = { ...build.armor };
  for (const zone of Object.keys(armor) as Zone[]) armor[zone] = { front: 0, rear: 0 };
  return { ...build, armor };
}
