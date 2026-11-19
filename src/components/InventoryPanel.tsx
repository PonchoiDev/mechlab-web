import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { Item, ItemSize } from '../types/item';
import type { EquippedItem, EquippedLoadout, Mech } from '../types/mech';
import { getWeaponStats } from '../utils/calculators';
import { getHardpointName, getHardpointViews } from '../utils/equipment';
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
  type InventoryTarget,
  type SortDirection
} from '../utils/inventory';
import { getItemWeaponType, getSizeName, getSlotsLabel, getWeaponTypeName } from '../utils/items';
import { ZONE_LABELS } from '../utils/zones';
import { TierSelector } from './TierSelector';

interface InventoryPanelProps {
  catalog: Item[];
  mech: Mech;
  loadout: EquippedLoadout;
  side: 'left' | 'right';
  // Componente o anclaje elegido en el tablero: pulsar una fila equipa ahí.
  target: InventoryTarget | null;
  onClearTarget: () => void;
  // Sin destino, objeto elegido para colocarlo pulsando el tablero, con el tier elegido.
  pickedItem: Item | null;
  onPick: (item: Item | null) => void;
  // Con destino, pulsar una fila lo equipa en él.
  onEquip: (item: Item) => void;
  // Clic derecho: en el destino, o donde mejor encaje si no lo hay.
  onQuickEquip: (item: Item) => void;
  onDragStart: (item: Item) => void;
  onDragEnd: () => void;
  onTierChange: (instanceId: string, tier: string) => void;
  onRemoveInstalled: (instanceId: string) => void;
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

// Las columnas del inventario del juego: nombre, tamaño, toneladas, daño, RPM y alcance, más el calor.
const COLUMNS: [InventorySortKey, string, string][] = [
  ['name', 'Name', 'Name'],
  ['size', 'Size', 'Size'],
  ['tonnage', 'Tons', 'Tonnage'],
  ['damage', 'Dmg', 'Damage'],
  ['heat', 'Heat', 'Heat'],
  ['rpm', 'RPM', 'Rounds per minute'],
  ['range', 'Range', 'Range (m)']
];

// Iconos de las pestañas del inventario del juego (tools/extraer_iconos_inventario.py). All y Ammo no tienen.
const CATEGORY_ICONS: Partial<Record<InventoryCategory, string>> = {
  energy: 'energy', ballistic: 'ballistic', missile: 'missile', artillery: 'artillery', ams: 'ams', melee: 'melee', equipment: 'equipment'
};
const ICON_BASE = `${import.meta.env.BASE_URL}mechlab/inventory/`;

const SIZE_LETTERS: Record<ItemSize, string> = { small: 'S', medium: 'M', large: 'L' };

const SIZES: ItemSize[] = ['small', 'medium', 'large'];

const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

const DEFAULT_FILTERS: InventoryFilters = { category: 'all', search: '', size: null, fitsOnly: true };

interface InventoryRowProps {
  item: Item;
  isPicked: boolean;
  hint: string;
  onActivate: () => void;
  onContextMenu: () => void;
  onTierChange: (tier: string) => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}

function InventoryRow({ item, isPicked, hint, onActivate, onContextMenu, onTierChange, onDragStart, onDragEnd }: InventoryRowProps) {
  const stats = item.type === 'weapon' ? getWeaponStats(item) : null;
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate();
  };
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    onContextMenu();
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
        title={`${item.fullName ?? item.name}: ${hint}`}
        onClick={onActivate}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <span className="inventory-item-name">{item.name}</span>
        <span title={getSizeName(item.size)}>{SIZE_LETTERS[item.size]}</span>
        <span>{formatNumber(item.tonnage)}</span>
        {stats ? (
          <>
            {/* Con los decimales fijos del juego (un decimal; el alcance, en metros enteros), para que las
                cifras de cada columna queden alineadas. */}
            <span>{stats.damage.toFixed(1)}</span>
            <span>{stats.heat.toFixed(1)}</span>
            <span>{stats.rpm.toFixed(1)}</span>
            <span>{stats.range !== null ? Math.round(stats.range) : EMPTY_VALUE}</span>
          </>
        ) : (
          // El equipo y la munición no tienen cifras de arma: sus ranuras ocupan esas columnas.
          <span className="inventory-item-note">{getSlotsLabel(item)}</span>
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

interface TargetSectionProps {
  mech: Mech;
  loadout: EquippedLoadout;
  target: InventoryTarget;
  onClear: () => void;
  onTierChange: (instanceId: string, tier: string) => void;
  onRemove: (instanceId: string) => void;
}

// Destino elegido en el tablero y lo que ya lleva su componente, con los tiers y el botón de quitar que tenía
// el antiguo panel de componente.
function TargetSection({ mech, loadout, target, onClear, onTierChange, onRemove }: TargetSectionProps) {
  const zoneItems = loadout[target.zone];
  const hardpoints = getHardpointViews(mech.components[target.zone].hardpoints, zoneItems);
  const hardpoint = target.hardpointIndex !== null ? hardpoints[target.hardpointIndex] : undefined;
  const builtIn = hardpoints.filter(view => view.builtInWeapon);

  return (
    <section className="inventory-target" aria-label="Target">
      <div className="inventory-target-heading">
        <div>
          <p className="eyebrow">EQUIP INTO</p>
          <h3>
            {ZONE_LABELS[target.zone]}
            {hardpoint && (
              <span data-weapon-type={hardpoint.weapon ? getItemWeaponType(hardpoint.weapon) ?? undefined : hardpoint.hardpoint.type}>
                {' · '}{hardpoint.weapon ? `replace ${hardpoint.weapon.name}` : getHardpointName(hardpoint.hardpoint)}
              </span>
            )}
          </h3>
        </div>
        <button type="button" className="editor-close" aria-label="Clear target" title="Clear target (Esc)" onClick={onClear}>✕</button>
      </div>
      {zoneItems.length === 0 && builtIn.length === 0 ? (
        <p className="editor-empty">Nothing installed yet.</p>
      ) : (
        <div className="installed-list inventory-installed">
          {builtIn.map(view => (
            <div key={`built-in-${view.index}`} className="installed-item is-built-in" data-weapon-type="melee">
              <span>{view.builtInWeapon}</span>
              <span className="built-in-tag">BUILT-IN</span>
            </div>
          ))}
          {zoneItems.map(item => (
            <div key={item.instanceId} className="installed-item" data-weapon-type={getItemWeaponType(item) ?? undefined}>
              <span className="installed-item-name">
                {item.name}
                {item.type !== 'weapon' && <small> {getSlotsLabel(item)}</small>}
              </span>
              {item.type === 'weapon' && item.tiers && (
                <TierSelector item={item} onChange={(tier) => onTierChange(item.instanceId, tier)} />
              )}
              <button type="button" className="remove-item" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.instanceId)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function InventoryPanel({
  catalog,
  mech,
  loadout,
  side,
  target,
  onClearTarget,
  pickedItem,
  onPick,
  onEquip,
  onQuickEquip,
  onDragStart,
  onDragEnd,
  onTierChange,
  onRemoveInstalled,
  onToggleSide,
  onClose
}: InventoryPanelProps) {
  const [filters, setFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<InventorySortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // Tier elegido para cada arma, que se mantiene al cambiar de fila.
  const [tiers, setTiers] = useState<Record<string, string>>({});

  // Al elegir un destino, la casilla se marca para ver solo lo que cabe en él, y la pestaña vuelve a All: la del
  // destino anterior (la munición de otro componente) podría dejar la lista vacía.
  const targetKey = target ? `${target.zone}:${target.hardpointIndex}` : null;
  const [lastTargetKey, setLastTargetKey] = useState(targetKey);
  if (targetKey !== lastTargetKey) {
    setLastTargetKey(targetKey);
    if (targetKey) setFilters(current => ({ ...current, category: 'all', fitsOnly: true }));
  }

  // Los números de las pestañas cuentan con el resto de filtros aplicados.
  const matching = useMemo(
    () => filterInventory(catalog, { ...filters, category: 'all', target }, mech, loadout),
    [catalog, filters, target, mech, loadout]
  );
  const counts = countByCategory(matching);
  const shown = sortInventory(
    filters.category === 'all' ? matching : matching.filter(item => getInventoryCategory(item) === filters.category),
    sortKey,
    sortDirection
  );
  const hasFilters = filters.search.trim() !== '' || filters.size !== null || filters.fitsOnly;
  const fitsLabel = target ? `Fits ${ZONE_LABELS[target.zone]}` : 'Fits this \'Mech';

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

  const hint = target
    ? `click to equip it in ${ZONE_LABELS[target.zone]}, or drag it onto the board`
    : 'drag it onto the board, click it and then click a hardpoint or component, or right-click to equip it where it fits best';

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

      {target && (
        <TargetSection
          mech={mech}
          loadout={loadout}
          target={target}
          onClear={onClearTarget}
          onTierChange={onTierChange}
          onRemove={onRemoveInstalled}
        />
      )}

      <div className="inventory-controls">
        <p className="inventory-hint" role="status">
          {target
            ? <>Click an item to equip it in <strong>{ZONE_LABELS[target.zone]}</strong>, or drag it anywhere on the board.</>
            : pickedItem
              ? <>Placing <strong>{pickedItem.name}</strong>: click a highlighted hardpoint or component. Esc to stop.</>
              : 'Click a component to equip into it, drag an item onto the board, or right-click an item to equip it where it fits best.'}
        </p>
        <input
          type="search"
          className="editor-search"
          placeholder="Search items"
          aria-label="Search items"
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
        />
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
            {fitsLabel}
          </label>
        </div>
      </div>

      <div className="inventory-tabs" role="group" aria-label="Item type">
        {INVENTORY_CATEGORIES.map(category => {
          const icon = CATEGORY_ICONS[category];
          return (
            <button
              key={category}
              type="button"
              className={filters.category === category ? 'inventory-tab is-active' : 'inventory-tab'}
              aria-pressed={filters.category === category}
              aria-label={`${CATEGORY_LABELS[category]} (${counts[category]})`}
              title={`${CATEGORY_LABELS[category]}: ${counts[category]}`}
              data-category={category}
              disabled={counts[category] === 0 && filters.category !== category}
              onClick={() => update({ category })}
            >
              {icon ? <img src={`${ICON_BASE}${icon}.png`} alt="" width={22} height={22} /> : CATEGORY_LABELS[category]}
              <small>{counts[category]}</small>
            </button>
          );
        })}
      </div>

      {/* La cabecera va dentro de la zona con scroll, fija arriba: así mide lo mismo que las filas. */}
      <div className="inventory-scroll">
        <div className="inventory-table-head" role="group" aria-label="Sort items">
          {COLUMNS.map(([key, label, description]) => (
            <button
              key={key}
              type="button"
              className={sortKey === key ? 'is-active' : undefined}
              aria-pressed={sortKey === key}
              title={sortKey === key ? `${description}: click again to reverse the order` : `Sort by ${description.toLowerCase()}`}
              onClick={() => sortBy(key)}
            >
              {label}{sortKey === key && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
            </button>
          ))}
        </div>

        {shown.length > 0 ? (
          <ul className="inventory-list">
            {shown.map(item => {
              const placed = withTier(item);
              const isPicked = !target && pickedItem?.id === item.id;
              return (
                <InventoryRow
                  key={item.id}
                  item={placed}
                  isPicked={isPicked}
                  hint={hint}
                  onActivate={() => target ? onEquip(placed) : onPick(isPicked ? null : placed)}
                  onContextMenu={() => onQuickEquip(placed)}
                  onTierChange={(tier) => {
                    setTiers(current => ({ ...current, [item.id]: tier }));
                    onPick({ ...item, tier });
                  }}
                  onDragStart={(event) => {
                    // Firefox no empieza a arrastrar sin datos; el objeto viaja en el estado de la página.
                    event.dataTransfer.setData('text/plain', item.name);
                    event.dataTransfer.effectAllowed = 'copyMove';
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
              {filters.fitsOnly
                ? target
                  ? `Nothing that fits ${ZONE_LABELS[target.zone]} matches these filters.${target.hardpointIndex === null ? ' To swap a weapon, click its hardpoint.' : ''}`
                  : 'Nothing that fits this \'Mech matches these filters.'
                : 'No items match these filters.'}
            </p>
            {hasFilters && (
              <button type="button" className="editor-link" onClick={() => setFilters({ ...DEFAULT_FILTERS, fitsOnly: false })}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
