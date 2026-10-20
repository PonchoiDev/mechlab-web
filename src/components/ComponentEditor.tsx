import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '../types/item';
import type { ComponentData, EquippedItem, Loadout, Zone } from '../types/mech';
import { clampArmorValue, getWeaponStats } from '../utils/calculators';
import {
  getComponentStatus,
  getEquippableItems,
  getHardpointViews,
  getSlotTypeLabel,
  getWeaponsForHardpoint
} from '../utils/equipment';
import {
  filterItems,
  getItemWeaponType,
  getSizeName,
  getSlotsLabel,
  getTechBaseName,
  getWeaponTypeName,
  SIZE_RANK
} from '../utils/items';
import type { WeaponType } from '../types/item';
import { ArmorControl } from './ArmorControl';
import { HardpointChip } from './HardpointChip';
import { SlotBar } from './SlotBar';
import { TierSelector } from './TierSelector';

type WeaponSortOrder = 'large-first' | 'small-first';

const KEEPS_EDITOR_OPEN = [
  '.component-editor',
  '.component-card',
  '.mech-picker',
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label'
].join(', ');
type EquipmentTab = 'equipment' | 'ammo';

interface ComponentEditorProps {
  zone: Zone;
  label: string;
  componentData: ComponentData;
  catalog: Item[];
  loadout: Loadout<EquippedItem>;
  armorFront: number;
  armorRear: number;
  selectedHardpoint: number | null;
  onSelectHardpoint: (hardpointIndex: number | null) => void;
  onEquip: (item: Item, hardpointIndex?: number) => void;
  onRemoveItem: (instanceId: string) => void;
  onTierChange: (instanceId: string, tier: string) => void;
  onArmorChange: (type: 'front' | 'rear', value: number) => void;
  onClose: () => void;
}

const sortWeapons = (weapons: Item[], order: WeaponSortOrder) => {
  const direction = order === 'large-first' ? -1 : 1;
  return [...weapons].sort((first, second) =>
    direction * (SIZE_RANK[first.size] - SIZE_RANK[second.size]) ||
    direction * (first.tonnage - second.tonnage) ||
    first.name.localeCompare(second.name)
  );
};

const matchesSearch = (item: Item, search: string) =>
  !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase());

const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

function ItemOption({ item, onEquip }: { item: Item; onEquip: (item: Item) => void }) {
  const stats = item.type === 'weapon' ? getWeaponStats(item) : null;

  return (
    <button type="button" className="item-option" onClick={() => onEquip(item)}>
      <span className="item-option-main">
        <span className="item-option-name">{item.name}</span>
        <span className="item-option-spec">
          {item.type === 'weapon'
            ? <>{getSizeName(item.size)} <i /> {item.tonnage} t</>
            : <>{item.tonnage} t <i /> {getSlotsLabel(item)}</>}
        </span>
      </span>
      {stats && (
        <span className="item-option-stats">
          <span>{formatNumber(stats.damage)} dmg</span>
          <span>{formatNumber(stats.heat)} heat</span>
          <span>{stats.range !== null ? `${formatNumber(stats.range)} m` : '—'}</span>
        </span>
      )}
    </button>
  );
}

export function ComponentEditor({
  zone,
  label,
  componentData,
  catalog,
  loadout,
  armorFront,
  armorRear,
  selectedHardpoint,
  onSelectHardpoint,
  onEquip,
  onRemoveItem,
  onTierChange,
  onArmorChange,
  onClose
}: ComponentEditorProps) {
  const [equipmentTab, setEquipmentTab] = useState<EquipmentTab>('equipment');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<WeaponSortOrder>('large-first');
  const [weaponSearch, setWeaponSearch] = useState('');
  const [weaponTechBase, setWeaponTechBase] = useState<string | null>(null);
  const [weaponType, setWeaponType] = useState<WeaponType | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const zoneItems = loadout[zone];
  const status = getComponentStatus(componentData, zoneItems);
  const hardpoints = getHardpointViews(componentData.hardpoints, zoneItems);
  const selectedView = selectedHardpoint !== null ? hardpoints[selectedHardpoint] : undefined;
  const equippable = useMemo(
    () => getEquippableItems(catalog, componentData, loadout, zone),
    [catalog, componentData, loadout, zone]
  );
  const candidateWeapons = useMemo(() => selectedHardpoint === null
    ? equippable.filter(item => item.type === 'weapon')
    : getWeaponsForHardpoint(catalog, componentData, zoneItems, selectedHardpoint),
  [catalog, componentData, equippable, selectedHardpoint, zoneItems]);
  const techBaseOptions = [...new Set(candidateWeapons.map(item => item.techBase).filter((value): value is string => !!value))].sort();
  const weaponTypeOptions = [...new Set(candidateWeapons.map(getItemWeaponType).filter((value): value is WeaponType => !!value))];
  const weapons = sortWeapons(filterItems(candidateWeapons, {
    search: weaponSearch,
    techBase: weaponTechBase,
    weaponType: selectedHardpoint === null ? weaponType : null
  }), sortOrder);
  const hasWeaponFilters = weaponSearch.trim() !== '' || weaponTechBase !== null || weaponType !== null;
  const others = equippable
    .filter(item => item.type === equipmentTab)
    .filter(item => matchesSearch(item, search));
  const ammoCount = equippable.filter(item => item.type === 'ammo').length;

  const equipWeapon = (item: Item) => {
    if (selectedHardpoint === null) {
      onEquip(item);
      return;
    }
    onEquip(item, selectedHardpoint);
    // Pasa al siguiente anclaje libre para poder rellenarlos seguidos.
    const freeIndices = hardpoints
      .filter(view => !view.weapon && view.index !== selectedHardpoint)
      .map(view => view.index);
    onSelectHardpoint(freeIndices.find(index => index > selectedHardpoint) ?? freeIndices[0] ?? null);
  };

  useEffect(() => {
    panelRef.current?.focus();
  }, [zone]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // Un clic en una zona sin nada interactivo cierra el panel, como Escape.
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.isConnected || target.closest(KEEPS_EDITOR_OPEN)) return;
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  const weaponsTitle = selectedView
    ? `Weapons for ${getWeaponTypeName(selectedView.hardpoint.type)} · ${getSizeName(selectedView.hardpoint.size)}`
    : 'Compatible weapons';

  return (
    <aside className="component-editor" aria-label={`${label} editor`} ref={panelRef} tabIndex={-1}>
      <header className="editor-header">
        <div>
          <p className="eyebrow">COMPONENT</p>
          <h2>{label}</h2>
        </div>
        <button type="button" className="editor-close" aria-label="Close editor" onClick={onClose}>✕</button>
      </header>

      <section className="editor-section">
        <div className="editor-section-heading">
          <h3>Hardpoints</h3>
          {selectedHardpoint !== null && (
            <button type="button" className="editor-link" onClick={() => onSelectHardpoint(null)}>Show all</button>
          )}
        </div>
        {hardpoints.length > 0 ? (
          <div className="editor-hardpoints">
            {hardpoints.map(view => (
              <HardpointChip
                key={view.index}
                view={view}
                isSelected={selectedHardpoint === view.index}
                onClick={() => onSelectHardpoint(selectedHardpoint === view.index ? null : view.index)}
              />
            ))}
          </div>
        ) : (
          <p className="editor-empty">This component has no weapon hardpoints.</p>
        )}
      </section>

      {hardpoints.length > 0 && (
        <section className="editor-section">
          <div className="editor-section-heading">
            <h3>{weaponsTitle} <span>{selectedView?.weapon ? 0 : weapons.length}</span></h3>
            <div className="sort-controls" role="group" aria-label="Sort weapons by size">
              {(['large-first', 'small-first'] as const).map(order => (
                <button
                  key={order}
                  type="button"
                  className={sortOrder === order ? 'sort-button is-active' : 'sort-button'}
                  aria-pressed={sortOrder === order}
                  onClick={() => setSortOrder(order)}
                >
                  {order === 'large-first' ? 'Largest' : 'Smallest'}
                </button>
              ))}
            </div>
          </div>
          {selectedView?.weapon ? (
            <div className="editor-occupied">
              <p className="editor-empty">Occupied by {selectedView.weapon.name}.</p>
              <button
                type="button"
                className="editor-link"
                onClick={() => onRemoveItem((selectedView.weapon as EquippedItem).instanceId)}
              >
                Remove it
              </button>
            </div>
          ) : candidateWeapons.length > 0 ? (
            <>
              <div className="editor-filters">
                <input
                  type="search"
                  className="editor-search"
                  placeholder="Search weapons"
                  aria-label="Search weapons"
                  value={weaponSearch}
                  onChange={(event) => setWeaponSearch(event.target.value)}
                />
                {techBaseOptions.length > 1 && (
                  <div className="filter-chips" role="group" aria-label="Filter by tech base">
                    {[null, ...techBaseOptions].map(option => (
                      <button
                        key={option ?? 'all'}
                        type="button"
                        className={weaponTechBase === option ? 'filter-chip is-active' : 'filter-chip'}
                        aria-pressed={weaponTechBase === option}
                        onClick={() => setWeaponTechBase(option)}
                      >
                        {option ? getTechBaseName(option) : 'All tech'}
                      </button>
                    ))}
                  </div>
                )}
                {selectedHardpoint === null && weaponTypeOptions.length > 1 && (
                  <div className="filter-chips" role="group" aria-label="Filter by weapon type">
                    {[null, ...weaponTypeOptions].map(option => (
                      <button
                        key={option ?? 'all'}
                        type="button"
                        className={weaponType === option ? 'filter-chip is-active' : 'filter-chip'}
                        aria-pressed={weaponType === option}
                        data-weapon-type={option ?? undefined}
                        onClick={() => setWeaponType(option)}
                      >
                        {option ? getWeaponTypeName(option) : 'All types'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {weapons.length > 0 ? (
                <div className="item-options">
                  {weapons.map(item => <ItemOption key={item.id} item={item} onEquip={equipWeapon} />)}
                </div>
              ) : (
                <div className="editor-occupied">
                  <p className="editor-empty">No weapons match these filters.</p>
                  {hasWeaponFilters && (
                    <button
                      type="button"
                      className="editor-link"
                      onClick={() => { setWeaponSearch(''); setWeaponTechBase(null); setWeaponType(null); }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="editor-empty">No compatible weapons fit the free hardpoints.</p>
          )}
        </section>
      )}

      <section className="editor-section">
        <div className="editor-section-heading">
          <h3>Installed <span>{zoneItems.length}</span></h3>
        </div>
        {zoneItems.length === 0 && hardpoints.every(view => !view.builtInWeapon) ? (
          <p className="editor-empty">Nothing installed yet.</p>
        ) : (
          <div className="installed-list">
            {hardpoints.filter(view => view.builtInWeapon).map(view => (
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
                <button
                  type="button"
                  className="remove-item"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onRemoveItem(item.instanceId)}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="editor-section">
        <div className="editor-section-heading">
          <div className="editor-tabs" role="tablist" aria-label="Equipment type">
            {([['equipment', 'Equipment'], ['ammo', `Ammo (${ammoCount})`]] as const).map(([tab, tabLabel]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={equipmentTab === tab}
                className={equipmentTab === tab ? 'editor-tab is-active' : 'editor-tab'}
                onClick={() => setEquipmentTab(tab)}
              >
                {tabLabel}
              </button>
            ))}
          </div>
        </div>
        <div className="editor-slots">
          <SlotBar used={status.usedSlots} capacity={status.maxSlots} label="Slots" />
          {status.specialSlots.map(slot => (
            <SlotBar
              key={slot.slotType}
              used={slot.used}
              capacity={slot.capacity}
              label={getSlotTypeLabel(slot.slotType)}
              variant="special"
            />
          ))}
        </div>
        <input
          type="search"
          className="editor-search"
          placeholder={`Search ${equipmentTab === 'ammo' ? 'ammo' : 'equipment'}`}
          aria-label={`Search ${equipmentTab === 'ammo' ? 'ammo' : 'equipment'}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {others.length > 0 ? (
          <div className="item-options">
            {others.map(item => <ItemOption key={item.id} item={item} onEquip={onEquip} />)}
          </div>
        ) : (
          <p className="editor-empty">
            {equipmentTab === 'ammo'
              ? 'No ammo available: equip a weapon that uses ammo, or free some slots.'
              : 'No equipment fits the free slots.'}
          </p>
        )}
      </section>

      <section className="editor-section">
        <div className="editor-section-heading">
          <h3>Armor <span>{armorFront + armorRear} / {componentData.maxArmor}</span></h3>
          <span className="editor-note">Structure {componentData.structure}</span>
        </div>
        <ArmorControl
          label={`${label} front armor`}
          shortLabel="F"
          value={armorFront}
          onChange={(value) => onArmorChange('front', clampArmorValue(value, armorRear, componentData.maxArmor))}
        />
        {componentData.hasRearArmor && (
          <ArmorControl
            label={`${label} rear armor`}
            shortLabel="R"
            value={armorRear}
            onChange={(value) => onArmorChange('rear', clampArmorValue(value, armorFront, componentData.maxArmor))}
          />
        )}
      </section>
    </aside>
  );
}
