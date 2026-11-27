import type { Zone } from '../../types/mech';
import type { YamlBuild, YamlItem, YamlMech } from '../../types/yaml-mechlab';
import { INTERNAL_SLOTS, ZONES } from './board';
import filtersData from '../../data/yaml/filters.json';
import { checkInternal, mountItem, mountWeapon, setInternal, type MountResult } from './build';
import { getYamlItem, yamlItemIds } from './data';
import { GENERAL_SLOT } from './stats';

// El inventario del MechLab de YAML, el mismo que el de MW5 y BATTLETECH (components/InventoryPanel.tsx,
// battletech/mechlab/BtInventoryPanel.tsx) con las reglas de YAML: además de las armas, la munición y el
// equipo, cambia las piezas internas de la ubicación elegida, como el panel «Equipping to» del juego.

export interface YamlInventoryEntry {
  id: string;
  item: YamlItem;
}

// Los filtros del inventario que pone el mod Yet Another Mechlab en el mechlab del juego (tabla
// YamlInventoryFilters, sacada por tools/generar_yaml.py), en tres filas: armas, equipo y varios
// (docs/specs/filtros-inventario-yaml.md).
export interface YamlInventoryFilter {
  id: string;
  row: 'weapon' | 'equipment' | 'misc';
  category: 'weapon' | 'equipment';
  subCategory: string;
  tooltip: string;
  tags: string[];
  color: string;
  // Los dos «ALL» llevan texto; los demás, el icono del juego.
  text?: string;
  icon?: string;
  ammo?: boolean;
}

export const YAML_INVENTORY_FILTERS = filtersData as YamlInventoryFilter[];
const FILTERS_BY_ID = new Map(YAML_INVENTORY_FILTERS.map(filter => [filter.id, filter]));

// HasAnyTags de Unreal: la etiqueta de la pieza entra si es la del filtro o una hija suya; con bExactMatch, solo
// si es la misma.
const matchesTag = (tag: string, filterTag: string, exact: boolean) => tag === filterTag || (!exact && tag.startsWith(`${filterTag}.`));
const EQUIPMENT_AMMO = 'Equipment.Ammo';

// EquipmentMatchesUiFilter del mod: las armas, por su etiqueta de tipo (GetInventoryWeaponsByTag); el equipo y la
// munición, por la categoría de las propiedades del mod si la tienen («equipment.» y la subcategoría del filtro al
// principio, sin distinguir mayúsculas: Misc deja también los núcleos y los tipos de motor) y, si no, por su
// etiqueta. En el filtro de munición la etiqueta tiene que ser exactamente una de las suyas, salvo que el filtro
// solo lleve Equipment.Ammo: así los consumibles (Ammo.Consumable) no salen entre la munición.
export function matchesYamlInventoryFilter(item: YamlItem, filter: YamlInventoryFilter): boolean {
  if (item.kind === 'weapon') {
    return filter.category === 'weapon' && !!item.weaponType && filter.tags.some(tag => matchesTag(item.weaponType!, tag, false));
  }
  if (filter.category !== 'equipment') return false;
  if (item.uiCategory) return item.uiCategory.toLowerCase().startsWith(`equipment.${filter.subCategory}`.toLowerCase());
  const exact = !!filter.ammo && !(filter.tags.length === 1 && filter.tags[0] === EQUIPMENT_AMMO);
  return !!item.category && filter.tags.some(tag => matchesTag(item.category!, tag, exact));
}

// Destino elegido en el tablero: una ubicación, uno de sus anclajes (para cambiar el arma) o una de sus
// ranuras internas (para cambiar el motor, el giroscopio, la armadura...).
export interface YamlInventoryTarget {
  zone: Zone;
  hardpoint: string | null;
  internal: string | null;
}

export interface YamlInventoryFilters {
  // El id del filtro marcado; sin ninguno, salen todas las piezas.
  filter: string | null;
  search: string;
  fitsOnly: boolean;
}

export type YamlSortKey = 'name' | 'slots' | 'tons';
export type YamlSortDirection = 'asc' | 'desc';

// Versiones que no se eligen en el inventario: los niveles de las armas (el nivel va en la build) y las
// armas de vehículos, torretas y armaduras de combate.
const HIDDEN_IDS = /_Lvl\d+$|_Turret|Vehicle|Elemental/i;
// Equipo que no se monta a mano: los rellenos (IsFillerEquipment) y la chatarra para reparar.
const HIDDEN_CATEGORIES = /^Equipment\.(Filler|Salvage)/;
const INTERNAL = new Set<string>(INTERNAL_SLOTS);

// La ranura interna de una pieza que solo va en una (núcleo y tipo de motor, giroscopio, armadura...).
const getInternalSlot = (item: YamlItem): string | undefined =>
  item.kind === 'equipment' && !(item.slotTypes ?? []).includes(GENERAL_SLOT)
    ? item.slotTypes?.find(slotType => INTERNAL.has(slotType))
    : undefined;

// Armas, munición y equipo, con las piezas internas, como el inventario del mod. Sin las piezas «fixed» (las de
// serie de algunos 'Mechs, que no se compran: GetEquipmentInventoryNewItems las salta) ni los rellenos.
export function getYamlInventoryItems(): YamlInventoryEntry[] {
  return yamlItemIds()
    .map(id => ({ id, item: getYamlItem(id)! }))
    .filter(({ id, item }) => !HIDDEN_IDS.test(id) && !HIDDEN_CATEGORIES.test(item.category ?? '') && !item.actuator && !item.fixed);
}

// Montar un objeto en una ubicación (o en el anclaje elegido), con el motivo si no cabe. Las armas van con el
// nivel elegido en el inventario. Una pieza interna va en su ranura, si la ubicación la tiene, en lugar de la
// que haya, como al elegirla desde la ranura.
export function placeYamlItem(mech: YamlMech, build: YamlBuild, id: string, zone: Zone, hardpoint: string | null = null, tier?: number): MountResult {
  const item = getYamlItem(id);
  if (!item) return { error: 'Unknown item' };
  if (item.kind === 'weapon') return mountWeapon(mech, build, zone, id, hardpoint ?? undefined, tier);
  const internalSlot = getInternalSlot(item);
  if (internalSlot) {
    return mech.zones[zone].special[internalSlot] ? chooseYamlInternal(mech, build, internalSlot, id) : { error: `${item.name} does not go in this location` };
  }
  return mountItem(mech, build, zone, id);
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
export function autoPlaceYamlItem(mech: YamlMech, build: YamlBuild, id: string, tier?: number): MountResult & { zone?: Zone } {
  for (const zone of ZONES) {
    const result = placeYamlItem(mech, build, id, zone, null, tier);
    if (result.build) return { ...result, zone };
  }
  return { error: `${getYamlItem(id)?.name ?? id} does not fit anywhere` };
}

// El filtro al elegir un destino: el del tipo del anclaje; en uno omni, ALL W; en una ubicación, ninguno
// (docs/specs/filtro-del-anclaje.md).
export function getYamlTargetFilter(mech: YamlMech, target: YamlInventoryTarget): string | null {
  if (!target.hardpoint) return null;
  const type = mech.zones[target.zone].hardpoints.find(hardpoint => hardpoint.id === target.hardpoint)?.type;
  return type && FILTERS_BY_ID.has(type) ? type : 'weapons';
}

export function filterYamlInventory(
  entries: YamlInventoryEntry[],
  filters: YamlInventoryFilters,
  mech: YamlMech,
  build: YamlBuild,
  target: YamlInventoryTarget | null
): YamlInventoryEntry[] {
  const text = filters.search.trim().toLowerCase();
  const filter = filters.filter ? FILTERS_BY_ID.get(filters.filter) : undefined;
  return entries.filter(({ id, item }) => {
    if (filter && !matchesYamlInventoryFilter(item, filter)) return false;
    if (text && !item.name.toLowerCase().includes(text)) return false;
    if (!filters.fitsOnly) return true;
    if (!isUseful(build, id)) return false;
    // En un anclaje solo van armas: el equipo y la munición se montan apuntando a la ubicación, como en MW5.
    if (target?.hardpoint && item.kind !== 'weapon') return false;
    if (target) return !!placeYamlItem(mech, build, id, target.zone, target.hardpoint).build;
    return getYamlDropZones(mech, build, id).length > 0;
  });
}

// Las piezas que deja cada filtro, por su id.
export function countYamlByFilter(entries: YamlInventoryEntry[]): Record<string, number> {
  return Object.fromEntries(YAML_INVENTORY_FILTERS.map(filter => [filter.id, entries.filter(({ item }) => matchesYamlInventoryFilter(item, filter)).length]));
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
