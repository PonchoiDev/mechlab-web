import type { Item, ItemSize, WeaponType } from '../types/item';
import type { EquippedItem, EquippedLoadout, Mech, Zone } from '../types/mech';
import { replaceWeapon, type ActionResult } from './buildActions';
import { getWeaponStats } from './calculators';
import {
  createEquippedItem,
  findHardpointForWeapon,
  getAvailableSlotType,
  getHardpointOccupancy,
  weaponFitsHardpoint
} from './equipment';
import { filterItems, getItemWeaponType, isAmmoCompatibleWithWeapon, SIZE_RANK } from './items';
import { mapZones, ZONE_LABELS } from './zones';

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

export const getDropTargets = (mech: Mech, loadout: EquippedLoadout, item: Item): DropTargets => mapZones(zone => {
  const component = mech.components[zone];
  if (item.type === 'weapon') {
    return {
      component: findHardpointForWeapon(component.hardpoints, loadout[zone], item) !== null,
      hardpoints: component.hardpoints.flatMap((hardpoint, index) => weaponFitsHardpoint(hardpoint, item) ? [index] : [])
    };
  }
  return { component: getAvailableSlotType(item, component, loadout[zone]) !== null, hardpoints: [] };
});

// Un arma cabe si algún anclaje la admite, aunque esté ocupado: se puede reemplazar. La munición, además,
// solo si alguna arma montada la usa, como en el panel de componente.
export const fitsMech = (mech: Mech, loadout: EquippedLoadout, item: Item): boolean => {
  const targets = Object.values(getDropTargets(mech, loadout, item));
  if (item.type === 'weapon') return targets.some(target => target.hardpoints.length > 0);
  if (!targets.some(target => target.component)) return false;
  if (item.type !== 'ammo') return true;
  return Object.values(loadout).flat().some(equipped => isAmmoCompatibleWithWeapon(item, equipped));
};

// ─── Filtros y orden ─────────────────────────────────────────────────────────

export interface InventoryFilters {
  category: InventoryCategory;
  search: string;
  techBase: string | null;
  size: ItemSize | null;
  // Solo lo que se puede colocar en el 'Mech actual (la casilla «Fits this 'Mech»).
  fitsOnly: boolean;
}

export const filterInventory = (catalog: Item[], filters: InventoryFilters, mech: Mech, loadout: EquippedLoadout): Item[] =>
  filterItems(catalog, { search: filters.search, techBase: filters.techBase })
    .filter(item => filters.category === 'all' || getInventoryCategory(item) === filters.category)
    .filter(item => !filters.size || item.size === filters.size)
    .filter(item => !filters.fitsOnly || fitsMech(mech, loadout, item));

export type InventorySortKey = 'name' | 'size' | 'tonnage' | 'damage' | 'range';
export type SortDirection = 'asc' | 'desc';

const getSortValue = (item: Item, key: Exclude<InventorySortKey, 'name'>): number | null => {
  if (key === 'size') return SIZE_RANK[item.size];
  if (key === 'tonnage') return item.tonnage;
  if (item.type !== 'weapon') return null;
  const stats = getWeaponStats(item);
  return key === 'damage' ? stats.damage : stats.range;
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
