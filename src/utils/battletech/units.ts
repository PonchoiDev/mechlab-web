import type { BtItem } from '../../types/battletech-mechlab';
import type { BtUnit, BtUnitKind, BtUnitLocation } from '../../types/battletech-units';

// Unidades enemigas de BATTLETECH (docs/specs/battletech-unidades.md): armas, potencia de fuego,
// blindaje, filtros, orden y vista en la URL. Recibe el catálogo como parámetro y no importa
// mechlabData, para que la página no cargue los 'Mechs.

export type BtCatalog = Map<string, BtItem>;

export const toBtCatalog = (items: BtItem[]): BtCatalog => new Map(items.map(item => [item.id, item]));

export const BT_UNIT_KINDS: { id: BtUnitKind; label: string }[] = [
  { id: 'tracked', label: 'Tracked' },
  { id: 'wheeled', label: 'Wheeled' },
  { id: 'turret', label: 'Turret' }
];

export const BT_UNIT_KIND_LABELS = Object.fromEntries(BT_UNIT_KINDS.map(kind => [kind.id, kind.label])) as Record<BtUnitKind, string>;

export const BT_LOCATION_LABELS: Record<BtUnitLocation, string> = {
  front: 'Front',
  left: 'Left',
  right: 'Right',
  rear: 'Rear',
  turret: 'Turret',
  body: 'Body'
};

export interface BtUnitWeapon {
  item: BtItem;
  count: number;
  // Un ataque de un arma: el daño por disparo por los disparos (un LRM10 son 10 misiles de 4).
  damage: number;
  instability: number;
  heatDamage: number;
  minRange: number;
  maxRange: number;
}

export const getBtUnitWeapons = (catalog: BtCatalog, unit: BtUnit): BtUnitWeapon[] =>
  unit.weapons.flatMap(({ id, count }) => {
    const item = catalog.get(id);
    const weapon = item?.weapon;
    if (!item || !weapon) return [];
    return [{
      item,
      count,
      damage: weapon.damage * weapon.shots,
      instability: weapon.instability * weapon.shots,
      heatDamage: weapon.heatDamage * weapon.shots,
      minRange: weapon.minRange,
      maxRange: weapon.maxRange
    }];
  }).sort((a, b) => b.damage * b.count - a.damage * a.count || a.item.name.localeCompare(b.item.name));

export interface BtUnitFirepower {
  damage: number;
  instability: number;
  heatDamage: number;
  maxRange: number;
}

// Todas sus armas disparando en el mismo turno.
export const getBtUnitFirepower = (catalog: BtCatalog, unit: BtUnit): BtUnitFirepower =>
  getBtUnitWeapons(catalog, unit).reduce((total, weapon) => ({
    damage: total.damage + weapon.damage * weapon.count,
    instability: total.instability + weapon.instability * weapon.count,
    heatDamage: total.heatDamage + weapon.heatDamage * weapon.count,
    maxRange: Math.max(total.maxRange, weapon.maxRange)
  }), { damage: 0, instability: 0, heatDamage: 0, maxRange: 0 });

export const getBtUnitArmor = (unit: BtUnit) => unit.locations.reduce(
  (total, location) => ({ armor: total.armor + location.armor, structure: total.structure + location.structure }),
  { armor: 0, structure: 0 }
);

export const getBtUnitEquipment = (catalog: BtCatalog, unit: BtUnit) =>
  unit.equipment.flatMap(({ id, count }) => {
    const item = catalog.get(id);
    return item ? [{ item, count }] : [];
  });

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface BtUnitsFilter {
  kind: BtUnitKind | 'all';
  query: string;
}

export const filterBtUnits = (units: BtUnit[], { kind, query }: BtUnitsFilter): BtUnit[] => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return units.filter(unit => (kind === 'all' || unit.kind === kind) && words.every(word => normalize(unit.name).includes(word)));
};

export type BtUnitSort = 'name' | 'damage' | 'armor' | 'tonnage' | 'speed';

export const BT_UNIT_SORTS: { id: BtUnitSort; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'damage', label: 'Damage' },
  { id: 'armor', label: 'Armor' },
  { id: 'tonnage', label: 'Tonnage' },
  { id: 'speed', label: 'Speed' }
];

// De mayor a menor; las unidades sin el dato (las torretas no tienen tonelaje ni movimiento) van al
// final, y a igualdad, por nombre.
export const sortBtUnits = (catalog: BtCatalog, units: BtUnit[], sort: BtUnitSort): BtUnit[] => {
  const byName = (a: BtUnit, b: BtUnit) => a.name.localeCompare(b.name);
  if (sort === 'name') return [...units].sort(byName);
  const value = (unit: BtUnit): number | null => {
    if (sort === 'damage') return getBtUnitFirepower(catalog, unit).damage;
    if (sort === 'armor') return getBtUnitArmor(unit).armor + getBtUnitArmor(unit).structure;
    if (sort === 'tonnage') return unit.tonnage;
    return unit.sprint;
  };
  return [...units].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) return va === vb ? byName(a, b) : va === null ? 1 : -1;
    return vb - va || byName(a, b);
  });
};

export interface BtUnitsView extends BtUnitsFilter {
  sort: BtUnitSort;
}

export const DEFAULT_BT_UNITS_VIEW: BtUnitsView = { kind: 'all', query: '', sort: 'name' };

export const parseBtUnitsQuery = (search: string): BtUnitsView => {
  const params = new URLSearchParams(search);
  const kind = params.get('kind');
  const sort = params.get('sort');
  return {
    kind: BT_UNIT_KINDS.some(candidate => candidate.id === kind) ? kind as BtUnitKind : DEFAULT_BT_UNITS_VIEW.kind,
    query: params.get('q') ?? '',
    sort: BT_UNIT_SORTS.some(candidate => candidate.id === sort) ? sort as BtUnitSort : DEFAULT_BT_UNITS_VIEW.sort
  };
};

export const toBtUnitsQuery = (view: BtUnitsView): string => {
  const params = new URLSearchParams();
  if (view.kind !== DEFAULT_BT_UNITS_VIEW.kind) params.set('kind', view.kind);
  if (view.query) params.set('q', view.query);
  if (view.sort !== DEFAULT_BT_UNITS_VIEW.sort) params.set('sort', view.sort);
  const query = params.toString();
  return query ? `?${query}` : '';
};
