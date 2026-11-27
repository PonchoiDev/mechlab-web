import type { Zone } from '../../types/mech';
import type { BtHardpoint, BtItem, BtLoadout, BtMech } from '../../types/battletech-mechlab';
import { mapZones, ZONE_KEYS, ZONE_LABELS } from '../zones';
import { replaceItem } from './actions';
import { byName, matchesQuery } from './filters';
import { describeMountProblem, getAllItems, getHardpointViews, getMountProblem, mountItem, removeItem } from './fitting';
import { BT_ITEMS, getItem } from './mechlabData';

// Inventario del MechLab de BATTLETECH, como el de MW5 (utils/inventory.ts) con las reglas de este juego:
// todo ocupa ranuras y las armas, además, un anclaje libre de su tipo. Las reglas son las de fitting.ts.

export type BtInventoryCategory = 'all' | BtHardpoint | 'equipment' | 'ammo';

export const BT_INVENTORY_CATEGORIES: BtInventoryCategory[] = ['all', 'energy', 'ballistic', 'missile', 'support', 'equipment', 'ammo'];

// Los objetos de serie de algunos chasis no se pueden montar: no salen en el inventario.
export const getBtInventoryItems = (): BtItem[] => BT_ITEMS.filter(item => !item.builtIn);

export const getBtInventoryCategory = (item: BtItem): Exclude<BtInventoryCategory, 'all'> => {
  if (item.kind === 'ammo') return 'ammo';
  if (item.kind === 'weapon' && item.hardpoint) return item.hardpoint;
  return 'equipment';
};

// La pestaña al elegir un destino: la del tipo del anclaje; en una ubicación, All (docs/specs/filtro-del-anclaje.md).
export const getBtTargetCategory = (mech: BtMech, loadout: BtLoadout, target: { zone: Zone; hardpointIndex: number | null }): BtInventoryCategory =>
  target.hardpointIndex === null ? 'all' : getHardpointViews(mech, loadout, target.zone)[target.hardpointIndex]?.type ?? 'all';

export const countBtByCategory = (items: BtItem[]): Record<BtInventoryCategory, number> => {
  const counts = Object.fromEntries(BT_INVENTORY_CATEGORIES.map(category => [category, 0])) as Record<BtInventoryCategory, number>;
  for (const item of items) {
    counts.all += 1;
    counts[getBtInventoryCategory(item)] += 1;
  }
  return counts;
};

// ─── Destinos ────────────────────────────────────────────────────────────────

// Un objeto montado que se arrastra, por su posición en el loadout de su ubicación: su sitio cuenta como libre.
export interface BtEquippedOrigin {
  zone: Zone;
  index: number;
}

export interface BtDropTarget {
  // Se puede soltar en la tarjeta: cabe ahora en la ubicación.
  component: boolean;
  // Anclajes de su tipo donde cabe, libres u ocupados (soltar en uno ocupado reemplaza su arma).
  hardpoints: number[];
}

export type BtDropTargets = Record<Zone, BtDropTarget>;

const withoutOrigin = (loadout: BtLoadout, origin?: BtEquippedOrigin) => origin ? removeItem(loadout, origin.zone, origin.index) : loadout;

export const getBtDropTargets = (mech: BtMech, current: BtLoadout, item: BtItem, origin?: BtEquippedOrigin): BtDropTargets => {
  const loadout = withoutOrigin(current, origin);
  return mapZones(zone => ({
    component: !getMountProblem(mech, loadout, zone, item),
    hardpoints: item.kind !== 'weapon' ? [] : getHardpointViews(mech, loadout, zone).flatMap((view, index) => {
      if (view.type !== item.hardpoint) return [];
      const base = view.item && view.index !== null ? removeItem(loadout, zone, view.index) : loadout;
      return getMountProblem(mech, base, zone, item) ? [] : [index];
    })
  }));
};

const usesMountedWeapon = (mech: BtMech, loadout: BtLoadout, ammo: BtItem) =>
  getAllItems(mech, loadout).some(entry => entry.weapon?.ammoCategory && entry.weapon.ammoCategory === ammo.ammo?.category);

// Un arma cabe si algún anclaje de su tipo la admite, aunque haya que reemplazar el arma que tiene. La
// munición, además, solo si alguna arma montada la usa, como en MW5.
export const fitsBtMech = (mech: BtMech, loadout: BtLoadout, item: BtItem): boolean => {
  const targets = Object.values(getBtDropTargets(mech, loadout, item));
  if (item.kind === 'weapon') return targets.some(target => target.hardpoints.length > 0);
  if (!targets.some(target => target.component)) return false;
  return item.kind !== 'ammo' || usesMountedWeapon(mech, loadout, item);
};

// Ubicación o anclaje elegido en el tablero: el inventario equipa ahí.
export interface BtInventoryTarget {
  zone: Zone;
  hardpointIndex: number | null;
}

// En un anclaje solo van armas de su tipo; en la ubicación, lo que se puede montar ahora.
export const fitsBtTarget = (mech: BtMech, loadout: BtLoadout, item: BtItem, target: BtInventoryTarget): boolean => {
  const drop = getBtDropTargets(mech, loadout, item)[target.zone];
  if (target.hardpointIndex !== null) return item.kind === 'weapon' && drop.hardpoints.includes(target.hardpointIndex);
  return drop.component && (item.kind !== 'ammo' || usesMountedWeapon(mech, loadout, item));
};

// Tras montar en un anclaje, el siguiente libre de la ubicación, para rellenarlos seguidos.
export const getNextFreeBtHardpoint = (mech: BtMech, loadout: BtLoadout, zone: Zone, after: number): number | null => {
  const free = getHardpointViews(mech, loadout, zone).flatMap((view, index) => !view.item && index !== after ? [index] : []);
  return free.find(index => index > after) ?? free[0] ?? null;
};

// ─── Filtros y orden ─────────────────────────────────────────────────────────

export interface BtInventoryFilters {
  category: BtInventoryCategory;
  search: string;
  fitsOnly: boolean;
  target?: BtInventoryTarget | null;
}

export const filterBtInventory = (items: BtItem[], filters: BtInventoryFilters, mech: BtMech, loadout: BtLoadout): BtItem[] =>
  items.filter(item =>
    (filters.category === 'all' || getBtInventoryCategory(item) === filters.category)
    && matchesQuery(`${item.name} ${item.manufacturer}`, filters.search)
    && (!filters.fitsOnly || (filters.target ? fitsBtTarget(mech, loadout, item, filters.target) : fitsBtMech(mech, loadout, item))));

export type BtInventorySortKey = 'name' | 'slots' | 'tonnage' | 'damage' | 'instability' | 'heat' | 'range';
export type BtSortDirection = 'asc' | 'desc';

// Daño de la ráfaga: un UAC/2 son dos disparos.
export const getVolleyDamage = (item: BtItem): number | null => item.weapon ? item.weapon.damage * item.weapon.shots : null;

const getSortValue = (item: BtItem, key: Exclude<BtInventorySortKey, 'name'>): number | null => {
  if (key === 'slots') return item.slots;
  if (key === 'tonnage') return item.tonnage;
  if (!item.weapon) return null;
  if (key === 'damage') return getVolleyDamage(item);
  if (key === 'instability') return item.weapon.instability;
  if (key === 'heat') return item.weapon.heat;
  return item.weapon.maxRange;
};

// Lo que no tiene el dato (el daño del equipo) va al final en los dos sentidos; a igualdad, por nombre.
export const sortBtInventory = (items: BtItem[], key: BtInventorySortKey, direction: BtSortDirection): BtItem[] => {
  const sign = direction === 'asc' ? 1 : -1;
  if (key === 'name') return [...items].sort((a, b) => sign * byName(a, b));
  return [...items].sort((first, second) => {
    const [a, b] = [getSortValue(first, key), getSortValue(second, key)];
    if (a === null || b === null) return a === b ? byName(first, second) : a === null ? 1 : -1;
    return sign * (a - b) || byName(first, second);
  });
};

// ─── Colocar ─────────────────────────────────────────────────────────────────

export interface BtPlaceResult {
  loadout: BtLoadout;
  message: string;
  // Ha reemplazado un arma: el aviso ofrece deshacerlo.
  replaced: boolean;
}

const unchanged = (loadout: BtLoadout, message: string): BtPlaceResult => ({ loadout, message, replaced: false });

// Coloca un objeto en una ubicación. Con un anclaje, el arma tiene que ser de su tipo, y si el anclaje está
// ocupado reemplaza su arma. El resto se monta en la ubicación, se suelte donde se suelte dentro de ella.
export const placeBtItem = (mech: BtMech, loadout: BtLoadout, zone: Zone, item: BtItem, hardpointIndex: number | null): BtPlaceResult => {
  const label = ZONE_LABELS[zone];
  if (item.kind === 'weapon' && hardpointIndex !== null) {
    const view = getHardpointViews(mech, loadout, zone)[hardpointIndex];
    if (!view || view.type !== item.hardpoint) return unchanged(loadout, `${item.name} does not fit this hardpoint`);
    if (view.item && view.index !== null) {
      const result = replaceItem(mech, loadout, zone, view.index, item);
      return result.loadout === loadout
        ? unchanged(loadout, result.message)
        : { loadout: result.loadout, message: `Replaced ${view.item.name} with ${item.name} in ${label}`, replaced: true };
    }
  }
  const result = mountItem(mech, loadout, zone, item);
  return result.ok
    ? { loadout: result.loadout, message: `Added ${item.name} to ${label}`, replaced: false }
    : unchanged(loadout, describeMountProblem(result.problem, mech, zone, item));
};

// Mueve un objeto montado: se quita de su sitio y se coloca como si viniera del inventario.
export const moveBtItem = (mech: BtMech, loadout: BtLoadout, origin: BtEquippedOrigin, zone: Zone, hardpointIndex: number | null): BtPlaceResult => {
  const item = getItem(loadout[origin.zone][origin.index]);
  if (!item) return unchanged(loadout, 'That item is no longer mounted');
  const stripped = withoutOrigin(loadout, origin);
  const result = placeBtItem(mech, stripped, zone, item, hardpointIndex);
  return result.loadout === stripped ? unchanged(loadout, result.message) : result;
};

export const unequipBtItem = (loadout: BtLoadout, zone: Zone, index: number): BtPlaceResult => {
  const item = getItem(loadout[zone][index]);
  if (!item) return unchanged(loadout, 'That item is no longer mounted');
  return { loadout: removeItem(loadout, zone, index), message: `Removed ${item.name} from ${ZONE_LABELS[zone]}`, replaced: false };
};

// Clic derecho sin destino: en la primera ubicación donde cabe, en el orden del tablero. A diferencia de MW5,
// los anclajes no tienen tamaño, así que no hay uno más pequeño que preferir.
export const autoPlaceBtItem = (mech: BtMech, loadout: BtLoadout, item: BtItem): BtPlaceResult => {
  const zone = ZONE_KEYS.find(candidate => !getMountProblem(mech, loadout, candidate, item));
  return zone ? placeBtItem(mech, loadout, zone, item, null) : unchanged(loadout, `No room for ${item.name} in this 'Mech`);
};
