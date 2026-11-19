import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { Item, ItemSize } from '../types/item';
import type { EquippedItem, EquippedLoadout, Mech } from '../types/mech';
import { getWeaponStats } from '../utils/calculators';
import { EMPTY_VALUE } from '../utils/format';
import {
  countByCategory,
  filterInventory,
  getInventoryCategory,
  INVENTORY_CATEGORIES,
  sortInventory,
  type InventoryCategory,
  type InventoryFilters,
  type InventorySortKey,
  type SortDirection
} from '../utils/inventory';
import { getItemWeaponType, getSizeName, getSlotsLabel, getTechBaseName, getWeaponTypeName } from '../utils/items';
import { TierSelector } from './TierSelector';

interface InventoryPanelProps {
  catalog: Item[];
  mech: Mech;
  loadout: EquippedLoadout;
  side: 'left' | 'right';
  // Objeto elegido para colocarlo pulsando el tablero, con el tier elegido.
  pickedItem: Item | null;
  onPick: (item: Item | null) => void;
  onDragStart: (item: Item) => void;
  onDragEnd: () => void;
  onToggleSide: () => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  all: 'All',
  energy: getWeaponTypeName('energy'),
  ballistic: getWeaponTypeName('ballistic'),
  missile: getWeaponTypeName('missile'),
  artillery: getWeaponTypeName('artillery'),
  ams: getWeaponTypeName('ams'),
  melee: getWeaponTypeName('melee'),
  equipment: 'Equipment',
  ammo: 'Ammo'
};

const SORT_OPTIONS: [InventorySortKey, string][] = [
  ['name', 'Name'],
  ['size', 'Size'],
  ['tonnage', 'Tons'],
  ['damage', 'Damage'],
  ['range', 'Range']
];

const SIZES: ItemSize[] = ['small', 'medium', 'large'];

const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

const DEFAULT_FILTERS: InventoryFilters = { category: 'all', search: '', techBase: null, size: null, fitsOnly: true };

interface InventoryRowProps {
  item: Item;
  isPicked: boolean;
  onPick: () => void;
  onTierChange: (tier: string) => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}

function InventoryRow({ item, isPicked, onPick, onTierChange, onDragStart, onDragEnd }: InventoryRowProps) {
  const stats = item.type === 'weapon' ? getWeaponStats(item) : null;
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onPick();
  };

  return (
    <li className={isPicked ? 'inventory-row is-picked' : 'inventory-row'} data-weapon-type={getItemWeaponType(item) ?? undefined}>
      {/* Un div y no un botón: Firefox no deja arrastrar botones. */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isPicked}
        className="inventory-item"
        draggable
        title={`${item.fullName ?? item.name}: drag it onto the board, or click it and then click a hardpoint or component`}
        onClick={onPick}
        onKeyDown={handleKeyDown}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <span className="inventory-item-name">{item.name}</span>
        <span className="inventory-item-spec">
          {getSizeName(item.size)} <i /> {formatNumber(item.tonnage)} t
          {item.type !== 'weapon' && <><i /> {getSlotsLabel(item)}</>}
        </span>
        {stats && (
          <span className="inventory-item-stats">
            <span>{formatNumber(stats.damage)} dmg</span>
            <span>{formatNumber(stats.heat)} heat</span>
            <span>{stats.range !== null ? `${formatNumber(stats.range)} m` : EMPTY_VALUE}</span>
          </span>
        )}
      </div>
      {/* El tier se elige en la fila seleccionada: una fila por arma, no una por tier como en el juego. */}
      {isPicked && item.type === 'weapon' && item.tiers && (
        <div className="inventory-item-tier">
          <TierSelector item={item as EquippedItem} onChange={onTierChange} />
        </div>
      )}
    </li>
  );
}

export function InventoryPanel({
  catalog,
  mech,
  loadout,
  side,
  pickedItem,
  onPick,
  onDragStart,
  onDragEnd,
  onToggleSide,
  onClose
}: InventoryPanelProps) {
  const [filters, setFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<InventorySortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // Tier elegido para cada arma, que se mantiene al cambiar de fila.
  const [tiers, setTiers] = useState<Record<string, string>>({});

  const techBaseOptions = useMemo(
    () => [...new Set(catalog.map(item => item.techBase).filter((value): value is string => !!value))].sort(),
    [catalog]
  );
  // Los números de las pestañas cuentan con el resto de filtros aplicados.
  const matching = useMemo(
    () => filterInventory(catalog, { ...filters, category: 'all' }, mech, loadout),
    [catalog, filters, mech, loadout]
  );
  const counts = countByCategory(matching);
  const shown = sortInventory(
    filters.category === 'all' ? matching : matching.filter(item => getInventoryCategory(item) === filters.category),
    sortKey,
    sortDirection
  );
  const hasFilters = filters.search.trim() !== '' || filters.techBase !== null || filters.size !== null || filters.fitsOnly;

  const withTier = (item: Item): Item => tiers[item.id] ? { ...item, tier: tiers[item.id] } : item;
  const update = (changes: Partial<InventoryFilters>) => setFilters(current => ({ ...current, ...changes }));
  const sortBy = (key: InventorySortKey) => {
    if (key === sortKey) {
      setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    // El nombre va de la A a la Z; las cifras, de mayor a menor.
    setSortDirection(key === 'name' ? 'asc' : 'desc');
  };

  useEffect(() => {
    if (!pickedItem) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onPick(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pickedItem, onPick]);

  return (
    <aside className={side === 'left' ? 'inventory-panel is-left' : 'inventory-panel'} aria-label="Inventory">
      <header className="editor-header inventory-header">
        <div>
          <p className="eyebrow">ARSENAL</p>
          <h2>Inventory</h2>
        </div>
        <span className="editor-header-actions">
          <button
            type="button"
            className="editor-side"
            aria-label={side === 'right' ? 'Move inventory to the left' : 'Move inventory to the right'}
            title={side === 'right' ? 'Move inventory to the left' : 'Move inventory to the right'}
            onClick={onToggleSide}
          >
            ⇄
          </button>
          <button type="button" className="editor-close" aria-label="Close inventory" onClick={onClose}>✕</button>
        </span>
      </header>

      <div className="inventory-controls">
        <p className="inventory-hint" role="status">
          {pickedItem
            ? <>Placing <strong>{pickedItem.name}</strong>: click a highlighted hardpoint or component. Esc to stop.</>
            : 'Drag an item onto the board, or click it and then click a hardpoint or component.'}
        </p>
        <div className="inventory-tabs" role="group" aria-label="Item type">
          {INVENTORY_CATEGORIES.map(category => (
            <button
              key={category}
              type="button"
              className={filters.category === category ? 'filter-chip is-active' : 'filter-chip'}
              aria-pressed={filters.category === category}
              data-weapon-type={['all', 'equipment', 'ammo'].includes(category) ? undefined : category}
              disabled={counts[category] === 0 && filters.category !== category}
              onClick={() => update({ category })}
            >
              {CATEGORY_LABELS[category]} <small>{counts[category]}</small>
            </button>
          ))}
        </div>
        <input
          type="search"
          className="editor-search"
          placeholder="Search items"
          aria-label="Search items"
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
        />
        <div className="filter-chips" role="group" aria-label="Filter by tech base">
          {[null, ...techBaseOptions].map(option => (
            <button
              key={option ?? 'all'}
              type="button"
              className={filters.techBase === option ? 'filter-chip is-active' : 'filter-chip'}
              aria-pressed={filters.techBase === option}
              onClick={() => update({ techBase: option })}
            >
              {option ? getTechBaseName(option) : 'All tech'}
            </button>
          ))}
        </div>
        <div className="inventory-row-controls">
          <div className="filter-chips" role="group" aria-label="Filter by size">
            {[null, ...SIZES].map(option => (
              <button
                key={option ?? 'all'}
                type="button"
                className={filters.size === option ? 'filter-chip is-active' : 'filter-chip'}
                aria-pressed={filters.size === option}
                onClick={() => update({ size: option })}
              >
                {option ? getSizeName(option) : 'All sizes'}
              </button>
            ))}
          </div>
          <label className="inventory-fits">
            <input type="checkbox" checked={filters.fitsOnly} onChange={(event) => update({ fitsOnly: event.target.checked })} />
            Fits this 'Mech
          </label>
        </div>
        <div className="sort-controls inventory-sort" role="group" aria-label="Sort items">
          {SORT_OPTIONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={sortKey === key ? 'sort-button is-active' : 'sort-button'}
              aria-pressed={sortKey === key}
              title={sortKey === key ? 'Click again to reverse the order' : `Sort by ${label.toLowerCase()}`}
              onClick={() => sortBy(key)}
            >
              {label}{sortKey === key && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
            </button>
          ))}
        </div>
      </div>

      {shown.length > 0 ? (
        <ul className="inventory-list">
          {shown.map(item => {
            const placed = withTier(item);
            const isPicked = pickedItem?.id === item.id;
            return (
              <InventoryRow
                key={item.id}
                item={placed}
                isPicked={isPicked}
                onPick={() => onPick(isPicked ? null : placed)}
                onTierChange={(tier) => {
                  setTiers(current => ({ ...current, [item.id]: tier }));
                  onPick({ ...item, tier });
                }}
                onDragStart={(event) => {
                  // Firefox no empieza a arrastrar sin datos; el objeto viaja en el estado de la página.
                  event.dataTransfer.setData('text/plain', item.name);
                  event.dataTransfer.effectAllowed = 'copy';
                  onDragStart(placed);
                }}
                onDragEnd={onDragEnd}
              />
            );
          })}
        </ul>
      ) : (
        <div className="inventory-empty">
          <p className="editor-empty">
            {filters.fitsOnly ? 'Nothing that fits this \'Mech matches these filters.' : 'No items match these filters.'}
          </p>
          {hasFilters && (
            <button type="button" className="editor-link" onClick={() => setFilters({ ...DEFAULT_FILTERS, fitsOnly: false })}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
