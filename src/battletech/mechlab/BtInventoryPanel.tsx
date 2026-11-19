import { useEffect, useMemo, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { BtBuild, BtItem } from '../../types/battletech-mechlab';
import { EMPTY_VALUE } from '../../utils/format';
import { ZONE_LABELS } from '../../utils/zones';
import { getFixedItems, getHardpointViews } from '../../utils/battletech/fitting';
import {
  BT_INVENTORY_CATEGORIES,
  countBtByCategory,
  filterBtInventory,
  getBtInventoryCategory,
  getBtInventoryItems,
  getVolleyDamage,
  sortBtInventory,
  type BtInventoryCategory,
  type BtInventoryFilters,
  type BtInventorySortKey,
  type BtInventoryTarget,
  type BtSortDirection
} from '../../utils/battletech/inventory';
import { getItem, getItemWeaponType, HARDPOINT_LABELS, SOURCE_LABELS } from '../../utils/battletech/mechlabData';

// Inventario del MechLab de BATTLETECH, el mismo que el de MW5 (components/InventoryPanel.tsx) con las
// columnas y las reglas de este juego. Sustituye al antiguo panel de ubicación.

interface BtInventoryPanelProps {
  build: BtBuild;
  side: 'left' | 'right';
  // Ubicación o anclaje elegido en el tablero: pulsar una fila equipa ahí.
  target: BtInventoryTarget | null;
  onClearTarget: () => void;
  // Sin destino, objeto elegido para colocarlo pulsando el tablero.
  pickedItem: BtItem | null;
  onPick: (item: BtItem | null) => void;
  onEquip: (item: BtItem) => void;
  // Clic derecho: en el destino, o en la primera ubicación donde cabe.
  onQuickEquip: (item: BtItem) => void;
  onDragStart: (item: BtItem) => void;
  onDragEnd: () => void;
  onRemoveInstalled: (index: number) => void;
  onToggleSide: () => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<BtInventoryCategory, string> = {
  all: 'All',
  energy: HARDPOINT_LABELS.energy,
  ballistic: HARDPOINT_LABELS.ballistic,
  missile: HARDPOINT_LABELS.missile,
  support: HARDPOINT_LABELS.support,
  equipment: 'Equipment',
  ammo: 'Ammo'
};

// Las cifras de las armas de BATTLETECH: no hay RPM, pero sí inestabilidad, y el tamaño son las ranuras.
const COLUMNS: [BtInventorySortKey, string, string][] = [
  ['name', 'Name', 'Name'],
  ['slots', 'Slots', 'Slots'],
  ['tonnage', 'Tons', 'Tonnage'],
  ['damage', 'Dmg', 'Damage per volley'],
  ['instability', 'Stab', 'Stability damage'],
  ['heat', 'Heat', 'Heat'],
  ['range', 'Range', 'Maximum range (m)']
];

// Los iconos de anclaje del juego, los de las tarjetas (LocationHardpoints en BtBoard).
const HARDPOINT_ICON_PATH = `${import.meta.env.BASE_URL}mechlab/icons/hardpoints/`;
const HAS_ICON: BtInventoryCategory[] = ['energy', 'ballistic', 'missile', 'support'];

const formatNumber = (value: number) => String(Number(value.toFixed(2)));
const slotsLabel = (item: BtItem) => `${item.slots} ${item.slots === 1 ? 'slot' : 'slots'}`;

// Lo propio del equipo y la munición, en el hueco de las cifras de arma.
const describeEquipment = (item: BtItem): string => {
  if (item.ammo) return `${item.ammo.capacity} shots`;
  if (item.heatSink && item.heatSink.dissipation > 0) return `${item.heatSink.dissipation} heat sinking`;
  if (item.jumpJet) return `${item.jumpJet.minTonnage} to ${item.jumpJet.maxTonnage} t 'Mechs`;
  return item.bonuses.join(' ') || EMPTY_VALUE;
};

// Fabricante, bonificaciones, alcance mínimo y fuente, para el tooltip de cada fila.
const describeItem = (item: BtItem) => [
  item.manufacturer,
  ...item.bonuses,
  item.weapon && item.weapon.minRange > 0 ? `Min range ${item.weapon.minRange} m` : '',
  item.weapon && item.weapon.shots > 1 ? `${item.weapon.shots} shots of ${formatNumber(item.weapon.damage)}` : '',
  item.source !== 'base' ? SOURCE_LABELS[item.source] : ''
].filter(Boolean).join(' · ');

const DEFAULT_FILTERS: BtInventoryFilters = { category: 'all', search: '', fitsOnly: true };

interface RowProps {
  item: BtItem;
  isPicked: boolean;
  hint: string;
  onActivate: () => void;
  onContextMenu: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}

function InventoryRow({ item, isPicked, hint, onActivate, onContextMenu, onDragStart, onDragEnd }: RowProps) {
  const weapon = item.weapon;
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate();
  };
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    onContextMenu();
  };
  const details = describeItem(item);

  return (
    <li className={isPicked ? 'inventory-row is-picked' : 'inventory-row'} data-weapon-type={getItemWeaponType(item)} data-category={item.kind}>
      {/* Un div y no un botón: Firefox no deja arrastrar botones. */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isPicked}
        className="inventory-item"
        draggable
        title={`${item.name}${details ? ` (${details})` : ''}: ${hint}`}
        onClick={onActivate}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <span className="inventory-item-name">
          {item.name}
          {item.bonuses.length > 0 && weapon && <small className="bt-item-bonus">{item.bonuses.join(' ')}</small>}
        </span>
        <span>{item.slots}</span>
        <span>{formatNumber(item.tonnage)}</span>
        {weapon ? (
          <>
            <span>{formatNumber(getVolleyDamage(item) ?? 0)}{weapon.shots > 1 && <small> ×{weapon.shots}</small>}</span>
            <span>{formatNumber(weapon.instability)}</span>
            <span>{formatNumber(weapon.heat)}</span>
            <span>{weapon.maxRange > 0 ? weapon.maxRange : EMPTY_VALUE}</span>
          </>
        ) : (
          <span className="inventory-item-note">{describeEquipment(item)}</span>
        )}
      </div>
    </li>
  );
}

// Destino elegido y lo que ya lleva su ubicación: el equipo fijo del chasis (que no se quita) y lo montado.
function TargetSection({ build, target, onClear, onRemove }: {
  build: BtBuild;
  target: BtInventoryTarget;
  onClear: () => void;
  onRemove: (index: number) => void;
}) {
  const { mech, loadout } = build;
  const hardpoint = target.hardpointIndex !== null ? getHardpointViews(mech, loadout, target.zone)[target.hardpointIndex] : undefined;
  const fixed = getFixedItems(mech, target.zone);
  const installed = loadout[target.zone].map((id, index) => ({ item: getItem(id), index }))
    .filter((entry): entry is { item: BtItem; index: number } => entry.item !== undefined);

  return (
    <section className="inventory-target" aria-label="Target">
      <div className="inventory-target-heading">
        <div>
          <p className="eyebrow">EQUIP INTO</p>
          <h3>
            {ZONE_LABELS[target.zone]}
            {hardpoint && (
              <span data-weapon-type={hardpoint.type}>
                {' · '}{hardpoint.item ? `replace ${hardpoint.item.name}` : HARDPOINT_LABELS[hardpoint.type]}
              </span>
            )}
          </h3>
        </div>
        <button type="button" className="editor-close" aria-label="Clear target" title="Clear target (Esc)" onClick={onClear}>✕</button>
      </div>
      {fixed.length + installed.length === 0 ? (
        <p className="editor-empty">Nothing installed yet.</p>
      ) : (
        <div className="installed-list inventory-installed">
          {fixed.map((item, index) => (
            <div key={`fixed-${index}`} className="installed-item is-built-in" data-weapon-type={getItemWeaponType(item)} title={item.bonuses.join(' · ')}>
              <span className="installed-item-name">{item.name} <small>{slotsLabel(item)}</small></span>
              <span className="built-in-tag">BUILT-IN</span>
            </div>
          ))}
          {installed.map(({ item, index }) => (
            <div key={`${item.id}-${index}`} className="installed-item" data-weapon-type={getItemWeaponType(item)} title={describeItem(item)}>
              <span className="installed-item-name">
                {item.name} <small>{slotsLabel(item)}</small>
                {item.bonuses.length > 0 && <small className="bt-item-bonus"> {item.bonuses.join(' ')}</small>}
              </span>
              <button type="button" className="remove-item" aria-label={`Remove ${item.name}`} onClick={() => onRemove(index)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function BtInventoryPanel({
  build,
  side,
  target,
  onClearTarget,
  pickedItem,
  onPick,
  onEquip,
  onQuickEquip,
  onDragStart,
  onDragEnd,
  onRemoveInstalled,
  onToggleSide,
  onClose
}: BtInventoryPanelProps) {
  const { mech, loadout } = build;
  const [filters, setFilters] = useState<BtInventoryFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<BtInventorySortKey>('name');
  const [sortDirection, setSortDirection] = useState<BtSortDirection>('asc');
  const catalog = useMemo(() => getBtInventoryItems(), []);

  // Al elegir un destino, la casilla se marca y la pestaña vuelve a All, como en MW5.
  const targetKey = target ? `${target.zone}:${target.hardpointIndex}` : null;
  const [lastTargetKey, setLastTargetKey] = useState(targetKey);
  if (targetKey !== lastTargetKey) {
    setLastTargetKey(targetKey);
    if (targetKey) setFilters(current => ({ ...current, category: 'all', fitsOnly: true }));
  }

  // Los números de las pestañas cuentan con el resto de filtros aplicados.
  const matching = useMemo(
    () => filterBtInventory(catalog, { ...filters, category: 'all', target }, mech, loadout),
    [catalog, filters, target, mech, loadout]
  );
  const counts = countBtByCategory(matching);
  const shown = sortBtInventory(
    filters.category === 'all' ? matching : matching.filter(item => getBtInventoryCategory(item) === filters.category),
    sortKey,
    sortDirection
  );
  const hasFilters = filters.search.trim() !== '' || filters.fitsOnly;
  const fitsLabel = target ? `Fits ${ZONE_LABELS[target.zone]}` : 'Fits this \'Mech';
  const update = (changes: Partial<BtInventoryFilters>) => setFilters(current => ({ ...current, ...changes }));
  const sortBy = (key: BtInventorySortKey) => {
    if (key === sortKey) {
      setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
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
    : 'drag it onto the board, click it and then click a hardpoint or location, or right-click to equip it where it fits';

  return (
    <aside className={side === 'left' ? 'inventory-panel bt-inventory is-left' : 'inventory-panel bt-inventory'} aria-label="Inventory">
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

      {target && <TargetSection build={build} target={target} onClear={onClearTarget} onRemove={onRemoveInstalled} />}

      <div className="inventory-controls">
        <p className="inventory-hint" role="status">
          {target
            ? <>Click an item to equip it in <strong>{ZONE_LABELS[target.zone]}</strong>, or drag it anywhere on the board.</>
            : pickedItem
              ? <>Placing <strong>{pickedItem.name}</strong>: click a highlighted hardpoint or location. Esc to stop.</>
              : 'Click a location to equip into it, drag an item onto the board, or right-click an item to equip it where it fits.'}
        </p>
        <input
          type="search"
          className="editor-search"
          placeholder="Search items or manufacturers"
          aria-label="Search items"
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
        />
        <div className="inventory-row-controls">
          <label className="inventory-fits">
            <input type="checkbox" checked={filters.fitsOnly} onChange={(event) => update({ fitsOnly: event.target.checked })} />
            {fitsLabel}
          </label>
        </div>
      </div>

      <div className="inventory-tabs" role="group" aria-label="Item type">
        {BT_INVENTORY_CATEGORIES.map(category => (
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
            {HAS_ICON.includes(category)
              ? <i className="inventory-tab-icon" style={{ '--icon': `url(${HARDPOINT_ICON_PATH}${category}.svg)` } as CSSProperties} aria-hidden="true" />
              : category === 'equipment' ? 'Equip' : CATEGORY_LABELS[category]}
            <small>{counts[category]}</small>
          </button>
        ))}
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
              const isPicked = !target && pickedItem?.id === item.id;
              return (
                <InventoryRow
                  key={item.id}
                  item={item}
                  isPicked={isPicked}
                  hint={hint}
                  onActivate={() => target ? onEquip(item) : onPick(isPicked ? null : item)}
                  onContextMenu={() => onQuickEquip(item)}
                  onDragStart={(event) => {
                    // Firefox no empieza a arrastrar sin datos; el objeto viaja en el estado de la página.
                    event.dataTransfer.setData('text/plain', item.name);
                    event.dataTransfer.effectAllowed = 'copyMove';
                    onDragStart(item);
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
