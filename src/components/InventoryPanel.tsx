import type { Item } from '../types/item';
import type { Zone } from '../types/mech';
import { getSizeLabel, getSlotsLabel, SIZE_RANK } from '../utils/items';

export type WeaponSortOrder = 'large-first' | 'small-first';

const SORT_OPTIONS: [WeaponSortOrder, string][] = [
  ['large-first', 'Largest'],
  ['small-first', 'Smallest']
];

interface InventoryPanelProps {
  activeZone: Zone | null;
  items: Item[];
  sortOrder: WeaponSortOrder;
  onSortOrderChange: (order: WeaponSortOrder) => void;
  onEquip: (item: Item) => void;
}

export function InventoryPanel({ activeZone, items, sortOrder, onSortOrderChange, onEquip }: InventoryPanelProps) {
  const direction = sortOrder === 'large-first' ? -1 : 1;
  const weaponItems = items
    .filter(item => item.type === 'weapon')
    .sort((first, second) =>
      direction * (SIZE_RANK[first.size] - SIZE_RANK[second.size]) ||
      direction * (first.tonnage - second.tonnage) ||
      first.name.localeCompare(second.name)
    );
  const otherItems = items.filter(item => item.type !== 'weapon');

  const renderItems = (groupItems: Item[]) => groupItems.map(item => (
    <button key={item.id} type="button" onClick={() => onEquip(item)} className="inventory-item">
      <span className="inventory-item-name">{item.name}</span>
      <span className="inventory-item-spec">
        {item.type === 'weapon'
          ? <>{getSizeLabel(item)} <i /> {item.tonnage} t</>
          : <>{item.tonnage} t <i /> {getSlotsLabel(item)}</>}
      </span>
    </button>
  ));

  return (
    <aside className="inventory-panel work-panel">
      <header className="section-heading">
        <div>
          <p className="eyebrow">01 / STORES</p>
          <h2>Equipment</h2>
        </div>
        <span className="zone-indicator">{activeZone ?? 'NO ZONE'}</span>
      </header>

      <div className="inventory-content">
        {!activeZone && (
          <p className="inventory-empty">Select a component to see compatible equipment.</p>
        )}
        {activeZone && items.length === 0 && (
          <p className="inventory-empty">No free space or compatible hardpoints in this zone.</p>
        )}

        {weaponItems.length > 0 && (
          <section className="inventory-group">
            <div className="inventory-group-heading">
              <h3>Weapons <span>{weaponItems.length}</span></h3>
              <div className="sort-controls" role="group" aria-label="Sort weapons by size">
                {SORT_OPTIONS.map(([order, label]) => (
                  <button
                    key={order}
                    type="button"
                    className={sortOrder === order ? 'sort-button is-active' : 'sort-button'}
                    aria-pressed={sortOrder === order}
                    onClick={() => onSortOrderChange(order)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {renderItems(weaponItems)}
          </section>
        )}

        {otherItems.length > 0 && (
          <section className="inventory-group">
            <div className="inventory-group-heading">
              <h3>Equipment &amp; ammunition <span>{otherItems.length}</span></h3>
            </div>
            {renderItems(otherItems)}
          </section>
        )}
      </div>
    </aside>
  );
}
