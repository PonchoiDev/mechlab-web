import type { Zone } from '../../types/mech';
import type { BtItem, BtLoadout, BtMech } from '../../types/battletech-mechlab';
import { ZONE_KEYS, ZONE_LABELS } from '../zones';
import { describeMountProblem, getAllItems, getHardpointViews, getMountProblem, mountItem, removeItem } from './fitting';
import { BT_ITEMS, getItem } from './mechlabData';

// Acciones del menú del clic derecho del MechLab de BATTLETECH, las mismas que el de MW5
// (utils/buildActions.ts) con las reglas de este juego. Devuelven el loadout nuevo, o el mismo si no
// se pudo hacer, y el mensaje para el aviso.
export interface ActionResult {
  loadout: BtLoadout;
  message: string;
}

export const LEGS: Zone[] = ['leftLeg', 'rightLeg'];

export const MIRROR_ZONES: Partial<Record<Zone, Zone>> = {
  leftArm: 'rightArm',
  rightArm: 'leftArm',
  leftTorso: 'rightTorso',
  rightTorso: 'leftTorso',
  leftLeg: 'rightLeg',
  rightLeg: 'leftLeg'
};

const plural = (count: number, word: string, pluralForm = `${word}s`) => `${count} ${count === 1 ? word : pluralForm}`;
const where = (zone: Zone) => `the ${ZONE_LABELS[zone].toLowerCase()}`;

export const canMountIn = (mech: BtMech, loadout: BtLoadout, item: BtItem, zone: Zone) => !getMountProblem(mech, loadout, zone, item);

// Huecos para otra copia del objeto: cuántas más caben en esas ubicaciones, una tras otra.
export const countFreeFor = (mech: BtMech, loadout: BtLoadout, item: BtItem, zones: Zone[]): number => {
  let current = loadout;
  let count = 0;
  for (const zone of zones) {
    for (;;) {
      const result = mountItem(mech, current, zone, item);
      if (!result.ok) break;
      current = result.loadout;
      count += 1;
    }
  }
  return count;
};

export const duplicateItemTo = (mech: BtMech, loadout: BtLoadout, zone: Zone, index: number, target: Zone): ActionResult => {
  const item = getItem(loadout[zone][index]);
  if (!item) return { loadout, message: 'That item is no longer mounted' };
  const result = mountItem(mech, loadout, target, item);
  return result.ok
    ? { loadout: result.loadout, message: `${item.name} added to ${where(target)}` }
    : { loadout, message: describeMountProblem(result.problem, mech, target, item) };
};

export const moveItemTo = (mech: BtMech, loadout: BtLoadout, zone: Zone, index: number, target: Zone): ActionResult => {
  const item = getItem(loadout[zone][index]);
  if (!item) return { loadout, message: 'That item is no longer mounted' };
  const result = mountItem(mech, removeItem(loadout, zone, index), target, item);
  return result.ok
    ? { loadout: result.loadout, message: `${item.name} moved to ${where(target)}` }
    : { loadout, message: describeMountProblem(result.problem, mech, target, item) };
};

// Mueve todas las copias de un objeto de una ubicación a otras, mientras quepan: las que no caben se quedan.
export const moveAllTo = (mech: BtMech, loadout: BtLoadout, zone: Zone, itemId: string, targets: Zone[]): ActionResult => {
  const item = getItem(itemId);
  if (!item) return { loadout, message: 'That item is no longer mounted' };
  let current = loadout;
  let moved = 0;
  while (current[zone].includes(itemId)) {
    const without = removeItem(current, zone, current[zone].lastIndexOf(itemId));
    const target = targets.find(candidate => canMountIn(mech, without, item, candidate));
    if (!target) break;
    const result = mountItem(mech, without, target, item);
    if (!result.ok) break;
    current = result.loadout;
    moved += 1;
  }
  return moved > 0
    ? { loadout: current, message: `Moved ${plural(moved, item.name)}` }
    : { loadout, message: `${item.name} does not fit there` };
};

// Cambia el arma de un anclaje por otra de su tipo, como al elegir un arma con un anclaje ocupado en MW5.
export const replaceItem = (mech: BtMech, loadout: BtLoadout, zone: Zone, index: number, item: BtItem): ActionResult => {
  const current = getItem(loadout[zone][index]);
  const result = mountItem(mech, removeItem(loadout, zone, index), zone, item);
  return result.ok
    ? { loadout: result.loadout, message: `${current?.name ?? 'Weapon'} replaced with ${item.name}` }
    : { loadout, message: describeMountProblem(result.problem, mech, zone, item) };
};

export const removeAllOf = (loadout: BtLoadout, zone: Zone, itemId: string): ActionResult => {
  const count = loadout[zone].filter(id => id === itemId).length;
  return {
    loadout: { ...loadout, [zone]: loadout[zone].filter(id => id !== itemId) },
    message: `Removed ${plural(count, getItem(itemId)?.name ?? 'item')}`
  };
};

// Copias del arma en todos los anclajes libres de esas ubicaciones donde quepa.
export const fillWeapon = (mech: BtMech, loadout: BtLoadout, item: BtItem, zones: Zone[]): ActionResult => {
  let current = loadout;
  let added = 0;
  for (const zone of zones) {
    for (;;) {
      const result = mountItem(mech, current, zone, item);
      if (!result.ok) break;
      current = result.loadout;
      added += 1;
    }
  }
  return added > 0
    ? { loadout: current, message: `Added ${plural(added, item.name)}` }
    : { loadout, message: `No free hardpoint fits ${item.name}` };
};

// Cajas de munición de la categoría de un arma: primero la de una tonelada, que es la que vende el juego.
export const getAmmoBoxesFor = (weapon: BtItem): BtItem[] => {
  const category = weapon.weapon?.ammoCategory;
  if (!category) return [];
  return BT_ITEMS.filter(item => item.ammo?.category === category && !item.builtIn)
    .sort((a, b) => b.tonnage - a.tonnage || a.name.localeCompare(b.name));
};

// Una caja de munición para el arma en la primera de esas ubicaciones donde quepa.
export const addAmmoFor = (mech: BtMech, loadout: BtLoadout, weapon: BtItem, box: BtItem, zones: Zone[]): ActionResult => {
  const zone = zones.find(candidate => canMountIn(mech, loadout, box, candidate));
  if (!zone) return { loadout, message: `No room for ${box.name} there` };
  const result = mountItem(mech, loadout, zone, box);
  return result.ok
    ? { loadout: result.loadout, message: `${box.name} for the ${weapon.name} added to ${where(zone)}` }
    : { loadout, message: describeMountProblem(result.problem, mech, zone, box) };
};

// Munición que solo usa esa arma: la de su categoría, si ninguna otra arma del 'Mech la comparte.
export const getAmmoOnlyUsedBy = (mech: BtMech, loadout: BtLoadout, zone: Zone, index: number): { zone: Zone; item: BtItem }[] => {
  const weapon = getItem(loadout[zone][index]);
  const category = weapon?.weapon?.ammoCategory;
  if (!category) return [];
  const others = getAllItems(mech, removeItem(loadout, zone, index)).some(item => item.weapon?.ammoCategory === category);
  if (others) return [];
  return ZONE_KEYS.flatMap(target => loadout[target]
    .map(id => getItem(id))
    .filter((item): item is BtItem => item?.ammo?.category === category)
    .map(item => ({ zone: target, item })));
};

export const removeWeaponAndAmmo = (mech: BtMech, loadout: BtLoadout, zone: Zone, index: number): ActionResult => {
  const weapon = getItem(loadout[zone][index]);
  const category = weapon?.weapon?.ammoCategory;
  const ammo = getAmmoOnlyUsedBy(mech, loadout, zone, index);
  const without = removeItem(loadout, zone, index);
  const next = ammo.length === 0 ? without : Object.fromEntries(ZONE_KEYS.map(target =>
    [target, without[target].filter(id => getItem(id)?.ammo?.category !== category)])) as BtLoadout;
  return { loadout: next, message: `Removed ${weapon?.name ?? 'the weapon'}${ammo.length > 0 ? ` and ${plural(ammo.length, 'ammo box', 'ammo boxes')}` : ''}` };
};

// Índice en el loadout del arma de un anclaje de la tarjeta (getHardpointViews), o null si está libre.
export const getHardpointWeaponIndex = (mech: BtMech, loadout: BtLoadout, zone: Zone, hardpointIndex: number): number | null =>
  getHardpointViews(mech, loadout, zone)[hardpointIndex]?.index ?? null;
