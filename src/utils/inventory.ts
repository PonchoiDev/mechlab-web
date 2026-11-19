import type { HardpointType, Item, ItemSize, WeaponType } from '../types/item';
import type { ComponentData, EquippedItem, EquippedLoadout, Mech, Zone } from '../types/mech';
import { replaceWeapon, type ActionResult } from './buildActions';
import { getWeaponStats } from './calculators';
import {
  createEquippedItem,
  findHardpointForWeapon,
  getAvailableSlotType,
  getHardpointOccupancy,
  getHardpointViews,
  weaponFitsHardpoint
} from './equipment';
import { filterItems, getItemWeaponType, isAmmoCompatibleWithWeapon, SIZE_RANK } from './items';
import { mapZones, ZONE_KEYS, ZONE_LABELS } from './zones';

// Inventario del MechLab: todo el arsenal a la vez, como el inventario del mechlab del juego, para
// colocar cada objeto en cualquier parte del 'Mech. Las reglas de dónde cabe cada cosa son las de
// equipment.ts; aquí solo se deciden los destinos y los avisos.

export type InventoryCategory = 'all' | WeaponType | 'equipment' | 'ammo';

// En el orden de las pestañas del juego: armas por tipo, después equipo y munición.
export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  'all', 'energy', 'ballistic', 'missile', 'artillery', 'ams', 'melee', 'equipment', 'ammo'
];

export const getInventoryCategory = (item: Item): Exclude<InventoryCategory, 'all'> => {
  if (item.type === 'ammo') return 'ammo';
  if (item.type === 'equipment') return 'equipment';
  return getItemWeaponType(item) ?? 'equipment';
};

export const countByCategory = (items: Item[]): Record<InventoryCategory, number> => {
  const counts = Object.fromEntries(INVENTORY_CATEGORIES.map(category => [category, 0])) as Record<InventoryCategory, number>;
  for (const item of items) {
    counts.all += 1;
    counts[getInventoryCategory(item)] += 1;
  }
  return counts;
};

// ─── Destinos ────────────────────────────────────────────────────────────────

export interface DropTarget {
  // Se puede soltar en la tarjeta del componente: un anclaje libre que encaja o una ranura libre.
  component: boolean;
  // Anclajes que admiten el arma, libres u ocupados (soltar en uno ocupado reemplaza su arma).
  hardpoints: number[];
}

export type DropTargets = Record<Zone, DropTarget>;

// Un objeto ya equipado que se arrastra: su sitio cuenta como libre mientras se mueve.
export interface EquippedOrigin {
  zone: Zone;
  instanceId: string;
}

const withoutOrigin = (loadout: EquippedLoadout, origin?: EquippedOrigin): EquippedLoadout => origin
  ? { ...loadout, [origin.zone]: loadout[origin.zone].filter(item => item.instanceId !== origin.instanceId) }
  : loadout;

export const getDropTargets = (mech: Mech, current: EquippedLoadout, item: Item, origin?: EquippedOrigin): DropTargets => mapZones(zone => {
  const loadout = withoutOrigin(current, origin);
  const component = mech.components[zone];
  if (item.type === 'weapon') {
    return {
      component: findHardpointForWeapon(component.hardpoints, loadout[zone], item) !== null,
      hardpoints: component.hardpoints.flatMap((hardpoint, index) => weaponFitsHardpoint(hardpoint, item) ? [index] : [])
    };
  }
  return { component: getAvailableSlotType(item, component, loadout[zone]) !== null, hardpoints: [] };
});

// Componente o anclaje elegido en el tablero: el inventario equipa ahí.
export interface InventoryTarget {
  zone: Zone;
  hardpointIndex: number | null;
}

const usesEquippedWeapon = (loadout: EquippedLoadout, ammo: Item) =>
  Object.values(loadout).flat().some(equipped => isAmmoCompatibleWithWeapon(ammo, equipped));

// En un componente, un arma necesita un anclaje libre; en un anclaje, basta con que lo admita (lo reemplaza).
// En un anclaje solo van armas: el equipo y la munición se equipan apuntando al componente.
export const fitsTarget = (mech: Mech, loadout: EquippedLoadout, item: Item, target: InventoryTarget): boolean => {
  const drop = getDropTargets(mech, loadout, item)[target.zone];
  if (target.hardpointIndex !== null) return item.type === 'weapon' && drop.hardpoints.includes(target.hardpointIndex);
  if (item.type === 'weapon') return drop.component;
  return drop.component && (item.type !== 'ammo' || usesEquippedWeapon(loadout, item));
};

// Tras equipar en un anclaje, el siguiente anclaje libre del componente, para rellenarlos seguidos.
export const getNextFreeHardpoint = (mech: Mech, loadout: EquippedLoadout, zone: Zone, after: number): number | null => {
  const hardpoints = mech.components[zone].hardpoints;
  const { occupiedIndices } = getHardpointOccupancy(hardpoints, loadout[zone]);
  const free = hardpoints.map((_, index) => index).filter(index => !occupiedIndices.has(index) && index !== after);
  return free.find(index => index > after) ?? free[0] ?? null;
};

// Un arma cabe si algún anclaje la admite, aunque esté ocupado: se puede reemplazar. La munición, además,
// solo si alguna arma montada la usa.
export const fitsMech = (mech: Mech, loadout: EquippedLoadout, item: Item): boolean => {
  const targets = Object.values(getDropTargets(mech, loadout, item));
  if (item.type === 'weapon') return targets.some(target => target.hardpoints.length > 0);
  if (!targets.some(target => target.component)) return false;
  return item.type !== 'ammo' || usesEquippedWeapon(loadout, item);
};

// ─── Filtros y orden ─────────────────────────────────────────────────────────

export interface InventoryFilters {
  category: InventoryCategory;
  search: string;
  size: ItemSize | null;
  // Solo lo que se puede colocar en el 'Mech actual (la casilla «Fits this 'Mech»), o en el destino si lo hay.
  fitsOnly: boolean;
  target?: InventoryTarget | null;
}

export const filterInventory = (catalog: Item[], filters: InventoryFilters, mech: Mech, loadout: EquippedLoadout): Item[] =>
  filterItems(catalog, { search: filters.search })
    .filter(item => filters.category === 'all' || getInventoryCategory(item) === filters.category)
    .filter(item => !filters.size || item.size === filters.size)
    .filter(item => !filters.fitsOnly || (filters.target
      ? fitsTarget(mech, loadout, item, filters.target)
      : fitsMech(mech, loadout, item)));

export type InventorySortKey = 'name' | 'size' | 'tonnage' | 'damage' | 'heat' | 'rpm' | 'range';
export type SortDirection = 'asc' | 'desc';

const getSortValue = (item: Item, key: Exclude<InventorySortKey, 'name'>): number | null => {
  if (key === 'size') return SIZE_RANK[item.size];
  if (key === 'tonnage') return item.tonnage;
  if (item.type !== 'weapon') return null;
  const stats = getWeaponStats(item);
  return key === 'range' ? stats.range : stats[key];
};

// Lo que no tiene el dato (el daño del equipo) va al final en los dos sentidos; a igualdad, por nombre.
export const sortInventory = (items: Item[], key: InventorySortKey, direction: SortDirection): Item[] => {
  const sign = direction === 'asc' ? 1 : -1;
  const byName = (first: Item, second: Item) => first.name.localeCompare(second.name);
  if (key === 'name') return [...items].sort((first, second) => sign * byName(first, second));

  return [...items].sort((first, second) => {
    const [a, b] = [getSortValue(first, key), getSortValue(second, key)];
    if (a === null || b === null) return a === b ? byName(first, second) : a === null ? 1 : -1;
    return sign * (a - b) || byName(first, second);
  });
};

// ─── Colocar ─────────────────────────────────────────────────────────────────

export interface PlaceResult extends ActionResult {
  // Ha reemplazado un arma: el aviso ofrece deshacerlo.
  replaced: boolean;
}

const unchanged = (loadout: EquippedLoadout, message: string): PlaceResult => ({ loadout, message, replaced: false });

// Coloca un objeto del inventario en un componente. Con un anclaje, el arma va a ese anclaje y reemplaza la
// que hubiera; sin anclaje, al primer anclaje libre que encaje. El equipo y la munición van a una ranura libre
// del componente, se suelten donde se suelten dentro de él.
export const placeItem = (
  mech: Mech,
  loadout: EquippedLoadout,
  zone: Zone,
  item: Item,
  hardpointIndex: number | null
): PlaceResult => {
  const component = mech.components[zone];
  const label = ZONE_LABELS[zone];

  if (item.type === 'weapon') {
    const index = hardpointIndex ?? findHardpointForWeapon(component.hardpoints, loadout[zone], item);
    if (index === null) return unchanged(loadout, `No free hardpoint in ${label} fits ${item.name}`);
    const hardpoint = component.hardpoints[index];
    if (!hardpoint || !weaponFitsHardpoint(hardpoint, item)) return unchanged(loadout, `${item.name} does not fit this hardpoint`);

    const occupant = getHardpointOccupancy(component.hardpoints, loadout[zone]).weaponAssignments.get(index) as EquippedItem | undefined;
    const result = replaceWeapon(mech, loadout, zone, index, item);
    return occupant
      ? { loadout: result.loadout, message: `Replaced ${occupant.name} with ${item.name} in ${label}`, replaced: true }
      : { loadout: result.loadout, message: `Added ${item.name} to ${label}`, replaced: false };
  }

  const slotType = getAvailableSlotType(item, component, loadout[zone]);
  if (!slotType) return unchanged(loadout, `No room for ${item.name} in ${label}`);
  return {
    loadout: { ...loadout, [zone]: [...loadout[zone], createEquippedItem(item, slotType)] },
    message: `Added ${item.name} to ${label}`,
    replaced: false
  };
};

export const unequipItem = (loadout: EquippedLoadout, zone: Zone, instanceId: string): PlaceResult => {
  const item = loadout[zone].find(equipped => equipped.instanceId === instanceId);
  if (!item) return unchanged(loadout, 'Item not found');
  return {
    loadout: withoutOrigin(loadout, { zone, instanceId }),
    message: `Removed ${item.name} from ${ZONE_LABELS[zone]}`,
    replaced: false
  };
};

// Mueve un objeto equipado: se quita de su sitio y se coloca como si viniera del inventario, con su tier.
export const moveEquippedItem = (
  mech: Mech,
  loadout: EquippedLoadout,
  origin: EquippedOrigin,
  zone: Zone,
  hardpointIndex: number | null
): PlaceResult => {
  const item = loadout[origin.zone].find(equipped => equipped.instanceId === origin.instanceId);
  if (!item) return unchanged(loadout, 'Item not found');
  const stripped = withoutOrigin(loadout, origin);
  const result = placeItem(mech, stripped, zone, item, hardpointIndex);
  return result.loadout === stripped ? unchanged(loadout, result.message) : result;
};

const isSpecialSlot = (slotType: string | null) => slotType !== null && slotType !== 'General_SlotType';

// Equipar sin elegir destino (clic derecho en el inventario). Un arma va al anclaje libre más pequeño que la
// admite de todo el 'Mech, para no gastar los grandes; el equipo, primero a una ranura especial que lo admite
// (los disipadores, a las del motor) y si no a la primera ranura general libre. A igualdad, en el orden del tablero.
export const autoPlaceItem = (mech: Mech, loadout: EquippedLoadout, item: Item): PlaceResult => {
  const zones = ZONE_KEYS.filter(zone => getDropTargets(mech, loadout, item)[zone].component);
  const best = item.type === 'weapon'
    ? zones
      .map(zone => {
        const index = findHardpointForWeapon(mech.components[zone].hardpoints, loadout[zone], item) as number;
        return { zone, size: SIZE_RANK[mech.components[zone].hardpoints[index].size] };
      })
      .sort((first, second) => first.size - second.size)[0]?.zone
    : zones.find(zone => isSpecialSlot(getAvailableSlotType(item, mech.components[zone], loadout[zone]))) ?? zones[0];

  return best ? placeItem(mech, loadout, best, item, null) : unchanged(loadout, `No room for ${item.name} in this 'Mech`);
};

export interface HardpointUsage {
  type: HardpointType;
  used: number;
  capacity: number;
}

// En el orden de las pestañas del inventario; los omni, que admiten varios tipos, al final.
const HARDPOINT_ORDER: HardpointType[] = ['energy', 'ballistic', 'missile', 'artillery', 'ams', 'melee', 'omni'];

// Anclajes de un componente por tipo, con los ocupados, para el resumen de cada tarjeta del tablero. Un anclaje
// con un arma de serie (el puño) cuenta como libre: se puede montar otra.
export const getHardpointUsage = (component: ComponentData, equippedItems: Item[]): HardpointUsage[] => {
  const views = getHardpointViews(component.hardpoints, equippedItems);
  return HARDPOINT_ORDER
    .map(type => {
      const ofType = views.filter(view => view.hardpoint.type === type);
      return { type, used: ofType.filter(view => view.weapon).length, capacity: ofType.length };
    })
    .filter(usage => usage.capacity > 0);
};
