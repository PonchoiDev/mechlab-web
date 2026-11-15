import { useMemo, useState } from 'react';
import type { Zone } from '../../types/mech';
import type { BtArmorSide, BtBuild, BtHardpoint, BtItem, BtSource } from '../../types/battletech-mechlab';
import { SlotBar } from '../../components/SlotBar';
import { EMPTY_VALUE } from '../../utils/format';
import { ZONE_LABELS } from '../../utils/zones';
import { getArmorLimit } from '../../utils/battletech/armor';
import {
  EMPTY_PANEL_FILTERS,
  getAmmoForMountedWeapons,
  getEquippableBtItems,
  getRarityGroup,
  getReplacementWeapons,
  hasPanelFilters,
  matchesPanelFilters,
  RARITY_GROUPS,
  sortBtWeapons,
  type BtPanelFilters,
  type BtWeaponSortOrder
} from '../../utils/battletech/filters';
import { getFixedItems, getHardpointViews, getLocationUsage } from '../../utils/battletech/fitting';
import { BT_ITEMS, getItem, getItemWeaponType, HARDPOINT_LABELS, HARDPOINTS, SOURCE_LABELS, SOURCES } from '../../utils/battletech/mechlabData';
import { BtArmorControl } from './BtArmorControl';
import { useDismiss } from './useDismiss';

// Lo que no cierra el panel al pulsarlo, como en el ComponentEditor de MW5: el panel, las tarjetas, el
// selector de 'Mech y cualquier control.
const KEEPS_EDITOR_OPEN = ['.component-editor', '.component-card', '.mech-picker', 'button', 'a', 'input', 'select', 'textarea', 'label'].join(', ');

type EquipmentTab = 'equipment' | 'ammo';
type EquipmentKind = 'heatSink' | 'jumpJet' | 'upgrade';

const EQUIPMENT_KINDS: { kind: EquipmentKind; label: string }[] = [
  { kind: 'heatSink', label: 'Heat sinks' },
  { kind: 'jumpJet', label: 'Jump jets' },
  { kind: 'upgrade', label: 'Upgrades' }
];

const VERSIONS = [0, 1, 2, 3];
const versionLabel = (plus: number) => plus === 0 ? 'Stock' : '+'.repeat(plus);

interface BtComponentEditorProps {
  build: BtBuild;
  zone: Zone;
  selectedHardpoint: number | null;
  onSelectHardpoint: (index: number | null) => void;
  onMount: (zone: Zone, item: BtItem) => void;
  onReplace: (zone: Zone, index: number, item: BtItem) => void;
  onRemove: (zone: Zone, index: number) => void;
  onArmorChange: (zone: Zone, side: BtArmorSide, value: number) => void;
  onArmorStep: (zone: Zone, side: BtArmorSide, steps: number) => void;
  onClose: () => void;
  side: 'left' | 'right';
  onToggleSide: () => void;
}

const formatNumber = (value: number) => String(Number(value.toFixed(2)));
const formatCost = (value: number) => value >= 1000 ? `${formatNumber(value / 1000)}k` : String(value);
const slotsLabel = (item: BtItem) => `${item.slots} ${item.slots === 1 ? 'slot' : 'slots'}`;

// Lo que el juego dice de cada objeto, para el tooltip: fabricante, bonificaciones, alcance mínimo y precio.
const describeItem = (item: BtItem) => [
  item.manufacturer,
  ...item.bonuses,
  item.weapon && item.weapon.minRange > 0 ? `Min range ${item.weapon.minRange} m` : '',
  item.weapon && item.weapon.shots > 1 ? `${item.weapon.shots} shots of ${formatNumber(item.weapon.damage)}` : '',
  `${formatCost(item.cost)} C-Bills`,
  item.source !== 'base' ? SOURCE_LABELS[item.source] : ''
].filter(Boolean).join(' · ');

// La tarjeta de objeto del panel de MW5 (ItemOption): nombre, tamaño y peso, y las cifras de las armas.
// En BATTLETECH el tamaño son las ranuras, y no hay DPS. Como la lista del juego, lleva encima el
// fabricante y la bonificación de la versión, y en las armas daño, inestabilidad y calor por disparo
// (un UAC/2 son 2 disparos de 25: «25 ×2»).
function ItemOption({ item, onEquip }: { item: BtItem; onEquip: (item: BtItem) => void }) {
  const weapon = item.weapon;
  return (
    <button type="button" className="item-option" data-weapon-type={getItemWeaponType(item)} title={describeItem(item)} onClick={() => onEquip(item)}>
      <span className="item-option-main">
        {(item.manufacturer || item.bonuses.length > 0) && (
          <span className="bt-item-maker">
            {item.manufacturer && item.manufacturer !== 'Generic' && <span>{item.manufacturer}</span>}
            {item.bonuses.length > 0 && <span className="bt-item-bonus">{item.bonuses.join(' ')}</span>}
          </span>
        )}
        <span className="item-option-name">{item.name}</span>
        <span className="item-option-spec">
          {slotsLabel(item)} <i /> {formatNumber(item.tonnage)} t
          {item.ammo && <><i /> {item.ammo.capacity} shots</>}
          {item.heatSink && item.heatSink.dissipation > 0 && <><i /> {item.heatSink.dissipation} sinking</>}
          {item.jumpJet && <><i /> {item.jumpJet.minTonnage}-{item.jumpJet.maxTonnage} t</>}
        </span>
      </span>
      {weapon ? (
        <span className="item-option-stats">
          <span>{formatNumber(weapon.damage)}{weapon.shots > 1 && <small> ×{weapon.shots}</small>} dmg</span>
          <span>{formatNumber(weapon.instability)} stab</span>
          <span>{formatNumber(weapon.heat)} heat</span>
          <span>{weapon.maxRange > 0 ? `${weapon.maxRange} m` : EMPTY_VALUE}</span>
        </span>
      ) : null}
    </button>
  );
}

// Filtros propios de BATTLETECH, con los filter-chips del panel de MW5: versión (+, + +, + + +), fuente y rareza.
function PanelFilterChips({ filters, items, onChange }: { filters: BtPanelFilters; items: BtItem[]; onChange: (filters: BtPanelFilters) => void }) {
  const versions = VERSIONS.filter(plus => items.some(item => item.plus === plus));
  const sources = SOURCES.filter(source => items.some(item => item.source === source));
  const rarities = RARITY_GROUPS.filter(({ group }) => items.some(item => getRarityGroup(item.rarity) === group));
  const toggle = <T,>(list: T[], value: T) => list.includes(value) ? list.filter(entry => entry !== value) : [...list, value];
  return (
    <>
      {versions.length > 1 && (
        <div className="filter-chips" role="group" aria-label="Filter by version">
          <button type="button" className={filters.plus.length === 0 ? 'filter-chip is-active' : 'filter-chip'} aria-pressed={filters.plus.length === 0} onClick={() => onChange({ ...filters, plus: [] })}>All versions</button>
          {versions.map(plus => (
            <button key={plus} type="button" className={filters.plus.includes(plus) ? 'filter-chip is-active' : 'filter-chip'} aria-pressed={filters.plus.includes(plus)} onClick={() => onChange({ ...filters, plus: toggle(filters.plus, plus) })}>
              {versionLabel(plus)}
            </button>
          ))}
        </div>
      )}
      {sources.length > 1 && (
        <div className="filter-chips" role="group" aria-label="Filter by source">
          <button type="button" className={filters.sources.length === 0 ? 'filter-chip is-active' : 'filter-chip'} aria-pressed={filters.sources.length === 0} onClick={() => onChange({ ...filters, sources: [] })}>All sources</button>
          {sources.map((source: BtSource) => (
            <button key={source} type="button" className={filters.sources.includes(source) ? 'filter-chip is-active' : 'filter-chip'} aria-pressed={filters.sources.includes(source)} onClick={() => onChange({ ...filters, sources: toggle(filters.sources, source) })}>
              {SOURCE_LABELS[source]}
            </button>
          ))}
        </div>
      )}
      {rarities.length > 1 && (
        <div className="filter-chips" role="group" aria-label="Filter by rarity">
          <button type="button" className={filters.rarities.length === 0 ? 'filter-chip is-active' : 'filter-chip'} aria-pressed={filters.rarities.length === 0} onClick={() => onChange({ ...filters, rarities: [] })}>Any rarity</button>
          {rarities.map(({ group, label, title }) => (
            <button key={group} type="button" title={title} className={filters.rarities.includes(group) ? 'filter-chip is-active' : 'filter-chip'} aria-pressed={filters.rarities.includes(group)} onClick={() => onChange({ ...filters, rarities: toggle(filters.rarities, group) })}>
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// Panel de la ubicación elegida, con la estructura del ComponentEditor de MW5: anclajes, armas que caben
// (o con las que cambiar la del anclaje elegido), lo instalado, el resto del equipo y la munición, y el
// blindaje. Solo ofrece lo que cabe ahora, como MW5.
export function BtComponentEditor({
  build,
  zone,
  selectedHardpoint,
  onSelectHardpoint,
  onMount,
  onReplace,
  onRemove,
  onArmorChange,
  onArmorStep,
  onClose,
  side,
  onToggleSide
}: BtComponentEditorProps) {
  useDismiss(onClose, KEEPS_EDITOR_OPEN);
  const [sortOrder, setSortOrder] = useState<BtWeaponSortOrder>('large-first');
  const [weaponFilters, setWeaponFilters] = useState<BtPanelFilters>(EMPTY_PANEL_FILTERS);
  const [weaponType, setWeaponType] = useState<BtHardpoint | null>(null);
  const [equipmentTab, setEquipmentTab] = useState<EquipmentTab>('equipment');
  const [equipmentKind, setEquipmentKind] = useState<EquipmentKind | null>(null);
  const [equipmentFilters, setEquipmentFilters] = useState<BtPanelFilters>(EMPTY_PANEL_FILTERS);
  const { mech, loadout, armor } = build;
  const label = ZONE_LABELS[zone];
  const location = mech.locations[zone];
  const usage = getLocationUsage(mech, loadout, zone);
  const hardpoints = getHardpointViews(mech, loadout, zone);
  const fixed = getFixedItems(mech, zone);
  const selected = selectedHardpoint === null ? null : hardpoints[selectedHardpoint] ?? null;
  const installed = loadout[zone].map((id, index) => ({ item: getItem(id), index }))
    .filter((entry): entry is { item: BtItem; index: number } => entry.item !== undefined);
  const frontMax = getArmorLimit(mech, zone, 'front');
  const rearMax = location.maxRearArmor;

  const equippable = useMemo(() => getEquippableBtItems(mech, loadout, zone, BT_ITEMS), [mech, loadout, zone]);
  const candidateWeapons = selected?.item && selected.index !== null
    ? getReplacementWeapons(mech, loadout, zone, selected.index, BT_ITEMS)
    : equippable.filter(item => item.kind === 'weapon' && (!selected || item.hardpoint === selected.type));
  const weaponTypeOptions = HARDPOINTS.filter(type => candidateWeapons.some(item => item.hardpoint === type));
  const weapons = sortBtWeapons(candidateWeapons.filter(item =>
    matchesPanelFilters(item, weaponFilters) && (selected !== null || weaponType === null || item.hardpoint === weaponType)), sortOrder);
  const hasWeaponFilters = hasPanelFilters(weaponFilters) || weaponType !== null;
  const ammoItems = getAmmoForMountedWeapons(mech, loadout, equippable);
  const others = equipmentTab === 'ammo'
    ? ammoItems
    : equippable.filter(item => (item.kind === 'heatSink' || item.kind === 'jumpJet' || item.kind === 'upgrade') && (equipmentKind === null || item.kind === equipmentKind));
  const shownOthers = others.filter(item => matchesPanelFilters(item, equipmentFilters));

  const weaponsTitle = selected?.item
    ? <>Replace <span className="editor-weapon-name" data-weapon-type={selected.type}>{selected.item.name}</span> with</>
    : selected
      ? `Weapons for ${HARDPOINT_LABELS[selected.type]}`
      : 'Compatible weapons';

  const equipWeapon = (item: BtItem) => {
    if (selected?.item && selected.index !== null) {
      onReplace(zone, selected.index, item);
      return;
    }
    onMount(zone, item);
    if (selectedHardpoint === null) return;
    // Pasa al siguiente anclaje libre para poder rellenarlos seguidos, como en MW5.
    const free = hardpoints.map((view, index) => ({ view, index })).filter(({ view, index }) => !view.item && index !== selectedHardpoint).map(({ index }) => index);
    onSelectHardpoint(free.find(index => index > selectedHardpoint) ?? free[0] ?? null);
  };

  return (
    <aside className={side === 'left' ? 'component-editor is-left' : 'component-editor'} aria-label={`${label} editor`}>
      <header className="editor-header">
        <div>
          <p className="eyebrow">COMPONENT</p>
          <h2>{label}</h2>
        </div>
        <span className="editor-header-actions">
          <button
            type="button"
            className="editor-side"
            aria-label={side === 'right' ? 'Move panel to the left' : 'Move panel to the right'}
            title={side === 'right' ? 'Move panel to the left' : 'Move panel to the right'}
            onClick={onToggleSide}
          >
            ⇄
          </button>
          <button type="button" className="editor-close" aria-label="Close editor" onClick={onClose}>✕</button>
        </span>
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
            {hardpoints.map((view, index) => (
              <button
                key={index}
                type="button"
                className={['hardpoint-chip', view.item ? 'is-occupied' : 'is-free', selectedHardpoint === index ? 'is-selected' : ''].filter(Boolean).join(' ')}
                data-weapon-type={view.type}
                aria-pressed={selectedHardpoint === index}
                title={`${HARDPOINT_LABELS[view.type]} hardpoint: ${view.item?.name ?? 'free'}`}
                onClick={() => onSelectHardpoint(selectedHardpoint === index ? null : index)}
              >
                <span className="hardpoint-chip-label">{HARDPOINT_LABELS[view.type]}</span>
                <span className="hardpoint-chip-content">
                  <span className="hardpoint-chip-name">{view.item?.name ?? 'Free'}</span>
                  {view.item && <span className="hardpoint-chip-tier">{view.item.slots} sl</span>}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="editor-empty">This location has no weapon hardpoints.</p>
        )}
      </section>

      {hardpoints.length > 0 && (
        <section className="editor-section">
          <div className="editor-section-heading">
            <h3>{weaponsTitle} <span className="editor-count">{weapons.length}</span></h3>
            <div className="sort-controls" role="group" aria-label="Sort weapons by size">
              {(['large-first', 'small-first'] as const).map(order => (
                <button
                  key={order}
                  type="button"
                  className={sortOrder === order ? 'sort-button is-active' : 'sort-button'}
                  aria-pressed={sortOrder === order}
                  title="Size is the slots the weapon takes"
                  onClick={() => setSortOrder(order)}
                >
                  {order === 'large-first' ? 'Largest' : 'Smallest'}
                </button>
              ))}
            </div>
          </div>
          {selected?.item && selected.index !== null && (
            <div className="editor-occupied">
              <p className="editor-empty">Pick a weapon below to swap it in this hardpoint.</p>
              <button type="button" className="editor-link" onClick={() => { onRemove(zone, selected.index!); onSelectHardpoint(null); }}>
                Remove it
              </button>
            </div>
          )}
          {candidateWeapons.length > 0 ? (
            <>
              <div className="editor-filters">
                <input
                  type="search"
                  className="editor-search"
                  placeholder="Search weapons"
                  aria-label="Search weapons"
                  value={weaponFilters.query}
                  onChange={(event) => setWeaponFilters({ ...weaponFilters, query: event.target.value })}
                />
                {selected === null && weaponTypeOptions.length > 1 && (
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
                        {option ? HARDPOINT_LABELS[option] : 'All types'}
                      </button>
                    ))}
                  </div>
                )}
                <PanelFilterChips filters={weaponFilters} items={candidateWeapons} onChange={setWeaponFilters} />
              </div>
              {weapons.length > 0 ? (
                <div className="item-options">
                  {weapons.map(item => <ItemOption key={item.id} item={item} onEquip={equipWeapon} />)}
                </div>
              ) : (
                <div className="editor-occupied">
                  <p className="editor-empty">No weapons match these filters.</p>
                  {hasWeaponFilters && (
                    <button type="button" className="editor-link" onClick={() => { setWeaponFilters(EMPTY_PANEL_FILTERS); setWeaponType(null); }}>
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="editor-empty">No compatible weapons fit the free hardpoints and slots.</p>
          )}
        </section>
      )}

      <section className="editor-section">
        <div className="editor-section-heading">
          <h3>Installed <span>{fixed.length + installed.length}</span></h3>
        </div>
        {fixed.length + installed.length === 0 ? (
          <p className="editor-empty">Nothing installed yet.</p>
        ) : (
          <div className="installed-list">
            {fixed.map((item, index) => (
              <div key={`fixed-${index}`} className="installed-item is-built-in" data-weapon-type={getItemWeaponType(item)} title={item.bonuses.join(' · ')}>
                <span className="installed-item-name">{item.name} <small>{slotsLabel(item)} · {formatNumber(item.tonnage)} t</small></span>
                <span className="built-in-tag">BUILT-IN</span>
              </div>
            ))}
            {installed.map(({ item, index }) => (
              <div key={`${item.id}-${index}`} className="installed-item" data-weapon-type={getItemWeaponType(item)} title={describeItem(item)}>
                <span className="installed-item-name">
                  {item.name} <small>{slotsLabel(item)} · {formatNumber(item.tonnage)} t</small>
                  {item.bonuses.length > 0 && <small className="bt-item-bonus"> {item.bonuses.join(' ')}</small>}
                </span>
                <button type="button" className="remove-item" aria-label={`Remove ${item.name}`} onClick={() => onRemove(zone, index)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="editor-section">
        <div className="editor-section-heading">
          <div className="editor-tabs" role="group" aria-label="Equipment type">
            {(['equipment', 'ammo'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                className={equipmentTab === tab ? 'editor-tab is-active' : 'editor-tab'}
                aria-pressed={equipmentTab === tab}
                onClick={() => setEquipmentTab(tab)}
              >
                {tab === 'equipment' ? 'Equipment' : `Ammo (${ammoItems.length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="editor-slots">
          <SlotBar used={usage.slots.used} capacity={usage.slots.capacity} label="Slots" />
        </div>
        <input
          type="search"
          className="editor-search"
          placeholder={`Search ${equipmentTab === 'ammo' ? 'ammo' : 'equipment'}`}
          aria-label={`Search ${equipmentTab === 'ammo' ? 'ammo' : 'equipment'}`}
          value={equipmentFilters.query}
          onChange={(event) => setEquipmentFilters({ ...equipmentFilters, query: event.target.value })}
        />
        {equipmentTab === 'equipment' && (
          <div className="filter-chips" role="group" aria-label="Filter by equipment type">
            {[null, ...EQUIPMENT_KINDS.map(entry => entry.kind)].map(kind => (
              <button
                key={kind ?? 'all'}
                type="button"
                className={equipmentKind === kind ? 'filter-chip is-active' : 'filter-chip'}
                aria-pressed={equipmentKind === kind}
                onClick={() => setEquipmentKind(kind)}
              >
                {kind ? EQUIPMENT_KINDS.find(entry => entry.kind === kind)!.label : 'All'}
              </button>
            ))}
          </div>
        )}
        <PanelFilterChips filters={equipmentFilters} items={others} onChange={setEquipmentFilters} />
        {shownOthers.length > 0 ? (
          <div className="item-options">
            {shownOthers.map(item => <ItemOption key={item.id} item={item} onEquip={(choice) => onMount(zone, choice)} />)}
          </div>
        ) : (
          <p className="editor-empty">
            {others.length > 0
              ? 'Nothing matches these filters.'
              : equipmentTab === 'ammo'
                ? 'No ammo available: mount a weapon that uses ammo, or free some slots.'
                : 'No equipment fits the free slots of this location.'}
          </p>
        )}
      </section>

      <section className="editor-section">
        <div className="editor-section-heading">
          <h3>Armor <span>{armor[zone].front + armor[zone].rear} / {frontMax + (rearMax ?? 0)}</span></h3>
          <span className="editor-note">Structure {location.structure}</span>
        </div>
        <BtArmorControl
          label={`${label} front armor`}
          shortLabel="F"
          value={armor[zone].front}
          max={frontMax}
          onChange={(value) => onArmorChange(zone, 'front', value)}
          onStep={(steps) => onArmorStep(zone, 'front', steps)}
        />
        {rearMax !== null && (
          <BtArmorControl
            label={`${label} rear armor`}
            shortLabel="R"
            value={armor[zone].rear}
            max={rearMax}
            onChange={(value) => onArmorChange(zone, 'rear', value)}
            onStep={(steps) => onArmorStep(zone, 'rear', steps)}
          />
        )}
      </section>
    </aside>
  );
}
