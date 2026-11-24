import type { Zone } from '../../types/mech';
import type { YamlBuild, YamlHardpointType, YamlItem, YamlMech } from '../../types/yaml-mechlab';
import { INTERNAL_SLOTS, ZONES } from './board';
import { checkInternal, mountItem, mountWeapon, setInternal, type MountResult } from './build';
import { getYamlItem, yamlItemIds } from './data';

// El inventario del MechLab de YAML, el mismo que el de MW5 y BATTLETECH (components/InventoryPanel.tsx,
// battletech/mechlab/BtInventoryPanel.tsx) con las reglas de YAML: además de las armas, la munición y el
// equipo, cambia las piezas internas de la ubicación elegida, como el panel «Equipping to» del juego.

export interface YamlInventoryEntry {
  id: string;
  item: YamlItem;
}

export type YamlInventoryCategory = 'all' | 'energy' | 'ballistic' | 'missile' | 'ams' | 'melee' | 'equipment' | 'ammo';
export const YAML_INVENTORY_CATEGORIES: YamlInventoryCategory[] = ['all', 'energy', 'ballistic', 'missile', 'ams', 'melee', 'equipment', 'ammo'];

// Destino elegido en el tablero: una ubicación, uno de sus anclajes (para cambiar el arma) o una de sus
// ranuras internas (para cambiar el motor, el giroscopio, la armadura...).
export interface YamlInventoryTarget {
  zone: Zone;
  hardpoint: string | null;
  internal: string | null;
}

export interface YamlInventoryFilters {
  category: YamlInventoryCategory;
  search: string;
  fitsOnly: boolean;
}

export type YamlSortKey = 'name' | 'slots' | 'tons';
export type YamlSortDirection = 'asc' | 'desc';

// Versiones que no se eligen en el inventario: los niveles de las armas (el nivel va en la build) y las
// armas de vehículos, torretas y armaduras de combate.
const HIDDEN_IDS = /_Lvl\d+$|_Turret|Vehicle|Elemental/i;
// Equipo que no se monta a mano: los rellenos y la chatarra para reparar.
const HIDDEN_CATEGORIES = /^Equipment\.(Filler|Salvage)/;
const INTERNAL = new Set<string>(INTERNAL_SLOTS);

const isInternal = (item: YamlItem) => (item.slotTypes ?? []).some(slotType => INTERNAL.has(slotType));

// Armas, munición y equipo que se montan en ranuras (no las piezas internas, que van aparte).
export function getYamlInventoryItems(): YamlInventoryEntry[] {
  return yamlItemIds()
    .map(id => ({ id, item: getYamlItem(id)! }))
    .filter(({ id, item }) => !HIDDEN_IDS.test(id) && !HIDDEN_CATEGORIES.test(item.category ?? '')
      && !item.actuator && !(item.kind === 'equipment' && isInternal(item)));
}

export function getYamlInventoryCategory(item: YamlItem): YamlInventoryCategory {
  if (item.kind === 'ammo') return 'ammo';
  if (item.kind === 'equipment') return 'equipment';
  const type: YamlHardpointType | undefined = item.hardpoint;
  if (type === 'energy' || type === 'ballistic' || type === 'ams' || type === 'melee') return type;
  return 'missile';
}

// Montar un objeto en una ubicación (o en el anclaje elegido), con el motivo si no cabe.
export function placeYamlItem(mech: YamlMech, build: YamlBuild, id: string, zone: Zone, hardpoint: string | null = null): MountResult {
  const item = getYamlItem(id);
  if (!item) return { error: 'Unknown item' };
  return item.kind === 'weapon' ? mountWeapon(mech, build, zone, id, hardpoint ?? undefined) : mountItem(mech, build, zone, id);
}

// Una caja de munición sirve si alguna arma montada usa su tipo, como en el inventario de MW5.
export function isAmmoForMountedWeapon(build: YamlBuild, id: string): boolean {
  const ammoType = getYamlItem(id)?.ammoType;
  return !!ammoType && build.weapons.some(weapon => getYamlItem(weapon.item)?.ammoTypes?.includes(ammoType));
}

const isUseful = (build: YamlBuild, id: string) => getYamlItem(id)?.kind !== 'ammo' || isAmmoForMountedWeapon(build, id);

// Las ubicaciones donde cabe un objeto, para resaltarlas al arrastrarlo o al elegirlo para colocarlo. La
// munición sin arma que la use no se resalta en ninguna, como en MW5.
export function getYamlDropZones(mech: YamlMech, build: YamlBuild, id: string): Zone[] {
  if (!isUseful(build, id)) return [];
  return ZONES.filter(zone => placeYamlItem(mech, build, id, zone).build);
}

// El clic derecho de MW5: en la primera ubicación donde cabe.
export function autoPlaceYamlItem(mech: YamlMech, build: YamlBuild, id: string): MountResult & { zone?: Zone } {
  for (const zone of ZONES) {
    const result = placeYamlItem(mech, build, id, zone);
    if (result.build) return { ...result, zone };
  }
  return { error: `${getYamlItem(id)?.name ?? id} does not fit anywhere` };
}

export function filterYamlInventory(
  entries: YamlInventoryEntry[],
  filters: YamlInventoryFilters,
  mech: YamlMech,
  build: YamlBuild,
  target: YamlInventoryTarget | null
): YamlInventoryEntry[] {
  const text = filters.search.trim().toLowerCase();
  return entries.filter(({ id, item }) => {
    if (filters.category !== 'all' && getYamlInventoryCategory(item) !== filters.category) return false;
    if (text && !item.name.toLowerCase().includes(text)) return false;
    if (!filters.fitsOnly) return true;
    if (!isUseful(build, id)) return false;
    if (target) return !!placeYamlItem(mech, build, id, target.zone, target.hardpoint).build;
    return getYamlDropZones(mech, build, id).length > 0;
  });
}

export function countYamlByCategory(entries: YamlInventoryEntry[]): Record<YamlInventoryCategory, number> {
  const counts = Object.fromEntries(YAML_INVENTORY_CATEGORIES.map(category => [category, 0])) as Record<YamlInventoryCategory, number>;
  for (const { item } of entries) {
    counts.all += 1;
    counts[getYamlInventoryCategory(item)] += 1;
  }
  return counts;
}

export function sortYamlInventory(entries: YamlInventoryEntry[], key: YamlSortKey, direction: YamlSortDirection): YamlInventoryEntry[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    const difference = key === 'name' ? a.item.name.localeCompare(b.item.name) : key === 'slots' ? a.item.slots - b.item.slots : a.item.tons - b.item.tons;
    return sign * difference || a.item.name.localeCompare(b.item.name);
  });
}

export interface YamlInternalChoice {
  id: string;
  name: string;
  tons: number;
  error: string | null;
}

// Lo que admite una ranura interna, con el motivo de lo que no cabe (los rellenos del Endo o del motor XL).
// Las versiones «_FIXED» son las de serie de algunos 'Mechs y tienen el mismo nombre: sale una de cada.
export function getYamlInternalChoices(mech: YamlMech, build: YamlBuild, slotType: string): YamlInternalChoice[] {
  const byName = new Map<string, YamlInternalChoice>();
  for (const id of yamlItemIds()) {
    const item = getYamlItem(id)!;
    if (!item.slotTypes?.includes(slotType)) continue;
    const previous = byName.get(item.name);
    if (previous && !(previous.id.endsWith('_FIXED') && !id.endsWith('_FIXED'))) continue;
    byName.set(item.name, { id, name: item.name, tons: item.tons, error: checkInternal(mech, build, slotType, id) });
  }
  const choices = [...byName.values()];
  if (slotType === 'Engine') return choices.sort((a, b) => (getYamlItem(a.id)?.rating ?? 0) - (getYamlItem(b.id)?.rating ?? 0));
  return choices.sort((a, b) => Number(!!a.error) - Number(!!b.error) || a.name.localeCompare(b.name));
}

export function chooseYamlInternal(mech: YamlMech, build: YamlBuild, slotType: string, id: string | null): MountResult {
  const error = id ? checkInternal(mech, build, slotType, id) : null;
  return error ? { error } : { build: setInternal(build, slotType, id) };
}
