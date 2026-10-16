import { useState, type KeyboardEvent } from 'react';
import './App.css';
import mechsData from './data/mechs.json';
import itemsData from './data/items.json';
import type { ArmorState, EquippedLoadout, Mech, Zone } from './types/mech';
import type { Item } from './types/item';
import { getItemAmmoFamily, getItemAmmoFamilyLabel, isAmmoCompatibleWithWeapon, isJumpJet, SIZE_RANK } from './utils/items';
import { canEquipItem, createEquippedItem, getAvailableSlotType } from './utils/equipment';
import { createEmptyArmor, createEmptyLoadout, ZONE_LABELS, ZONES } from './utils/zones';
import { getSarnaTitle } from './services/sarna';
import { useSarnaAsset } from './hooks/useSarnaAsset';
import { ComponentPanel } from './components/ComponentPanel';
import { 
  calculateEquippedWeight, 
  calculateArmorWeight, 
  calculateFirepower, 
  calculateHeatSpike,
  calculateArmorPoints,
  calculateCoolingRate,
  calculateTopSpeed,
  getWeaponPerformance,
  maximizeArmor,
  createDefaultArmor
} from './utils/calculators';

type ViewMode = 'workbench' | 'preview';

const mechs = mechsData as unknown as Mech[];
const items = Object.values(itemsData) as Item[];

const getMechDisplayName = (mech: Mech): string => {
  const sarnaTitle = getSarnaTitle(mech);
  return sarnaTitle.toLocaleLowerCase() !== mech.name.toLocaleLowerCase()
    ? `${mech.name} (${sarnaTitle})`
    : mech.name;
};

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [mechSearchQuery, setMechSearchQuery] = useState('');
  const [isMechPickerOpen, setIsMechPickerOpen] = useState(false);
  const [activeMechOption, setActiveMechOption] = useState(0);
  const currentMech = mechs[selectedIndex];
  const { asset: sarnaAsset, isLoading: isSarnaLoading, markImageBroken } = useSarnaAsset(currentMech);
  const [viewMode, setViewMode] = useState<ViewMode>('workbench');

  const [loadout, setLoadout] = useState<EquippedLoadout>(createEmptyLoadout);

  const [activeZone, setActiveZone] = useState<Zone | null>(null);
  const [weaponSortOrder, setWeaponSortOrder] = useState<'large-first' | 'small-first'>('large-first');

  const [armor, setArmor] = useState<ArmorState>(() => createDefaultArmor(currentMech.components));

  const filteredMechs = mechs
    .map((mech, index) => ({ mech, index }))
    .filter(({ mech }) => {
      const query = mechSearchQuery.trim().toLocaleLowerCase();
      return !query || [mech.name, mech.sarnaName ?? mech.name, getSarnaTitle(mech), mech.variant, mech.id]
        .some(value => value.toLocaleLowerCase().includes(query));
    });

  const openMechPicker = () => {
    if (!isMechPickerOpen) {
      const query = currentMech.name;
      const matchingOptions = mechs
        .map((mech, index) => ({ mech, index }))
        .filter(({ mech }) => [mech.name, mech.sarnaName ?? '', mech.variant, mech.id]
          .some(value => value.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
      const selectedOption = matchingOptions.findIndex(({ index }) => index === selectedIndex);
      setMechSearchQuery(query);
      setActiveMechOption(Math.max(selectedOption, 0));
    }
    setIsMechPickerOpen(true);
  };

  const selectMech = (index: number) => {
    if (index !== selectedIndex) {
      setSelectedIndex(index);
      setArmor(createDefaultArmor(mechs[index].components));
      setLoadout(createEmptyLoadout());
      setActiveZone(null);
    }
    setMechSearchQuery('');
    setIsMechPickerOpen(false);
  };

  const handleMechPickerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsMechPickerOpen(true);
      setActiveMechOption(current => Math.min(current + 1, Math.max(filteredMechs.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsMechPickerOpen(true);
      setActiveMechOption(current => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && isMechPickerOpen && filteredMechs.length > 0) {
      event.preventDefault();
      const option = filteredMechs[Math.min(activeMechOption, filteredMechs.length - 1)];
      selectMech(option.index);
    } else if (event.key === 'Escape' && isMechPickerOpen) {
      event.preventDefault();
      setMechSearchQuery('');
      setIsMechPickerOpen(false);
    }
  };

  const handleArmorChange = (zone: Zone, type: 'front' | 'rear', value: number) => {
    setArmor(prev => ({ ...prev, [zone]: { ...prev[zone], [type]: value } }));
  };

  const handleEquipItem = (item: Item) => {
    if (!activeZone) return;

    const zone = activeZone;
    const componentData = currentMech.components[zone];
    setLoadout(prev => {
      const zoneItems = prev[zone];
      if (!canEquipItem(item, componentData, zoneItems)) return prev;

      const slotType = item.type === 'weapon'
        ? undefined
        : getAvailableSlotType(item, componentData, zoneItems) ?? undefined;
      if (item.type !== 'weapon' && !slotType) return prev;

      return { ...prev, [zone]: [...zoneItems, createEquippedItem(item, slotType)] };
    });
  };

  const handleRemoveItem = (zone: Zone, instanceId: string) => {
    setLoadout(prev => ({ ...prev, [zone]: prev[zone].filter(item => item.instanceId !== instanceId) }));
  };

  const handleClearArmor = () => {
    setArmor(createEmptyArmor());
  };

  const handleMaximizeArmor = () => {
    const availableTonnage = currentMech.tonnageMax - currentMech.baseTonnage - equipmentWeight;
    setArmor(prev => maximizeArmor(currentMech.components, availableTonnage, prev));
  };

  const handleRemoveLoadoutItems = (type: 'weapon' | 'ammo') => {
    setLoadout(previous => Object.fromEntries(
      Object.entries(previous).map(([zone, equippedItems]) => [
        zone,
        equippedItems.filter(item => item.type !== type)
      ])
    ) as EquippedLoadout);
  };

  const handleTierChange = (zone: Zone, instanceId: string, tier: string) => {
    setLoadout(prev => ({
      ...prev,
      [zone]: prev[zone].map(item => item.instanceId === instanceId ? { ...item, tier } : item)
    }));
  };

  const getAvailableItems = () => {
    if (!activeZone) return [];

    const currentZoneItems = loadout[activeZone];
    const componentData = currentMech.components[activeZone];
    const equippedWeapons = Object.values(loadout)
      .flat()
      .filter(item => item.type === 'weapon');

    return items.filter(item => {
      if (!canEquipItem(item, componentData, currentZoneItems)) return false;
      if (item.type !== 'ammo') return true;

      return equippedWeapons.some(weapon => isAmmoCompatibleWithWeapon(item, weapon));
    });
  };

  const displayedItems = getAvailableItems();
  const weaponItems = displayedItems.filter(item => item.type === 'weapon');
  const sortedWeaponItems = [...weaponItems].sort((first, second) =>
    weaponSortOrder === 'large-first'
      ? SIZE_RANK[second.size] - SIZE_RANK[first.size]
      : SIZE_RANK[first.size] - SIZE_RANK[second.size]
  );
  const otherItems = displayedItems.filter(item => item.type !== 'weapon');
  const mechIllustration = sarnaAsset?.imageUrl ? (
    <img
      className="mech-image"
      src={sarnaAsset.imageUrl}
      alt={`${currentMech.name} ${currentMech.variant}`}
      onError={markImageBroken}
    />
  ) : (
    <p className="image-status">
      {isSarnaLoading ? 'Fetching reference from Sarna…' : 'No reference image available.'}
    </p>
  );
  const sarnaSource = !isSarnaLoading && sarnaAsset && (
    <a className="source-link" href={sarnaAsset.pageUrl} target="_blank" rel="noreferrer">
      IMAGE SOURCE / SARNA <span aria-hidden="true">↗</span>
    </a>
  );
  const renderInventoryItems = (availableItems: Item[]) => availableItems.map((item) => (
    <button
      key={item.id}
      type="button"
      onClick={() => handleEquipItem(item)}
      className="inventory-item"
    >
      <span className="inventory-item-name">{item.name}</span>
      <span className="inventory-item-spec">{item.size} <i /> {item.tonnage}t <i /> {item.slots}s</span>
    </button>
  ));
  
  const equipmentWeight = calculateEquippedWeight(loadout);
  const armorWeight = calculateArmorWeight(armor);
  const totalWeight = currentMech.baseTonnage + equipmentWeight + armorWeight;
  const firePower = calculateFirepower(loadout);
  const heatSpike = calculateHeatSpike(loadout);
  const armorPoints = calculateArmorPoints(armor);
  const maxArmorPoints = Object.values(currentMech.components)
    .reduce((total, component) => total + component.maxArmor, 0);
  const totalCoolingRate = calculateCoolingRate(loadout, currentMech.BaseCoolingRate);
  const weapons = getWeaponPerformance(loadout);
  const jumpJetCount = Object.values(loadout).flat().filter(isJumpJet).length;
  const maxWeaponRange = weapons.reduce((max, weapon) => Math.max(max, weapon.range ?? 0), 0);
  const ammunition = Object.entries(loadout).flatMap(([zone, equippedItems]) =>
    equippedItems
      .filter(item => item.type === 'ammo')
      .map(item => ({ zone, item }))
  );
  const ammunitionGroups = Array.from(ammunition.reduce((groups, { item }) => {
    const family = getItemAmmoFamily(item) ?? item.id;
    const group = groups.get(family) ?? {
      label: getItemAmmoFamilyLabel(item),
      capacity: 0,
      bins: 0
    };
    group.capacity += item.capacity ?? 0;
    group.bins += 1;
    groups.set(family, group);
    return groups;
  }, new Map<string, { label: string; capacity: number; bins: number }>()).values());

  return (
    <div className="mechlab-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">M</span>
          <div>
            <p className="eyebrow">FIELD CONFIGURATION SYSTEM</p>
            <h1>MechLab <span>MW5</span></h1>
          </div>
        </div>
        <div className="topbar-tools">
          <div className="view-switch" role="group" aria-label="Application view">
            <button
              type="button"
              aria-pressed={viewMode === 'workbench'}
              className={viewMode === 'workbench' ? 'view-switch-button is-active' : 'view-switch-button'}
              onClick={() => setViewMode('workbench')}
            >
              Workshop
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'preview'}
              className={viewMode === 'preview' ? 'view-switch-button is-active' : 'view-switch-button'}
              onClick={() => setViewMode('preview')}
            >
              Build preview
            </button>
          </div>
          <div
            className="mech-picker"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setMechSearchQuery('');
                setIsMechPickerOpen(false);
              }
            }}
          >
            <span>CHASSIS / VARIANT</span>
            <input
              type="search"
              role="combobox"
              aria-label="Search chassis by name, variant or ID"
              aria-autocomplete="list"
              aria-expanded={isMechPickerOpen}
              aria-controls="mech-options"
              aria-activedescendant={isMechPickerOpen && filteredMechs[activeMechOption]
                ? `mech-option-${filteredMechs[activeMechOption].index}`
                : undefined}
              autoComplete="off"
              className="mech-picker-input"
              placeholder="Search by name, variant or ID"
              value={isMechPickerOpen ? mechSearchQuery : `${getMechDisplayName(currentMech)} / ${currentMech.variant}`}
              onFocus={openMechPicker}
              onClick={openMechPicker}
              onChange={(event) => {
                setMechSearchQuery(event.target.value);
                setActiveMechOption(0);
                setIsMechPickerOpen(true);
              }}
              onKeyDown={handleMechPickerKeyDown}
            />
            {isMechPickerOpen && (
              <div className="mech-options" id="mech-options" role="listbox" aria-label="Chassis results">
                {filteredMechs.length > 0 ? filteredMechs.map(({ mech, index }, optionIndex) => (
                  <div
                    key={`${mech.id}-${index}`}
                    id={`mech-option-${index}`}
                    role="option"
                    aria-selected={index === selectedIndex}
                    className={optionIndex === activeMechOption ? 'mech-option is-active' : 'mech-option'}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActiveMechOption(optionIndex)}
                    onClick={() => selectMech(index)}
                  >
                    <span>{getMechDisplayName(mech)}</span>
                    <strong>{mech.variant}</strong>
                    {mech.id !== mech.variant && <small>{mech.id}</small>}
                  </div>
                )) : (
                  <p className="mech-no-results">No chassis found</p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="readout-strip" aria-label="Mech statistics">
        <div className="readout-cell">
          <span className="readout-label">TONNAGE</span>
          <strong className={totalWeight > currentMech.tonnageMax ? 'readout-warning' : ''}>
            {totalWeight.toFixed(2)} <small>/ {currentMech.tonnageMax} t</small>
          </strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">ARMOR POINTS</span>
          <strong>{armorPoints.toFixed(0)} <small>/ {maxArmorPoints.toFixed(0)}</small></strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">ARMOR MASS</span>
          <strong>{armorWeight.toFixed(2)} <small>t</small></strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">TOP SPEED</span>
          <strong>{calculateTopSpeed(currentMech.baseSpeed).toFixed(1)} <small>km/h · {jumpJetCount} JJ</small></strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">VOLLEY DAMAGE</span>
          <strong>{firePower}</strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">HEAT SPIKE</span>
          <strong>{heatSpike}</strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">TOTAL COOLING RATE</span>
          <strong>{totalCoolingRate === null ? 'N/A' : <>{totalCoolingRate.toFixed(1)} <small>heat/s</small></>}</strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">MAX WEAPON RANGE</span>
          <strong>{maxWeaponRange > 0 ? `${maxWeaponRange.toFixed(0)} m` : '—'}</strong>
        </div>
      </section>

      <nav className="utility-toolbar" aria-label="Loadout utilities">
        <div className="utility-group">
          <span className="utility-label">ARMOR</span>
          <button type="button" className="utility-button" onClick={handleClearArmor} disabled={armorPoints === 0}>
            Clear armor
          </button>
          <button
            type="button"
            className="utility-button utility-button-primary"
            onClick={handleMaximizeArmor}
            disabled={armorPoints >= maxArmorPoints || totalWeight >= currentMech.tonnageMax}
          >
            Max armor
          </button>
        </div>
        <div className="utility-group">
          <span className="utility-label">LOADOUT</span>
          <button
            type="button"
            className="utility-button"
            onClick={() => handleRemoveLoadoutItems('weapon')}
            disabled={!Object.values(loadout).flat().some(item => item.type === 'weapon')}
          >
            Remove weapons
          </button>
          <button
            type="button"
            className="utility-button"
            onClick={() => handleRemoveLoadoutItems('ammo')}
            disabled={!Object.values(loadout).flat().some(item => item.type === 'ammo')}
          >
            Remove ammo
          </button>
        </div>
      </nav>

      {viewMode === 'workbench' ? <div className="workbench">
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
            {activeZone && displayedItems.length === 0 && (
              <p className="inventory-empty">No free space or compatible hardpoints in this zone.</p>
            )}

            {weaponItems.length > 0 && (
              <section className="inventory-group">
                <div className="inventory-group-heading">
                  <h3>Weapons <span>{weaponItems.length}</span></h3>
                  <div className="sort-controls" role="group" aria-label="Sort weapons by size">
                    {([
                      ['large-first', 'Largest'],
                      ['small-first', 'Smallest']
                    ] as const).map(([order, label]) => (
                      <button
                        key={order}
                        type="button"
                        className={weaponSortOrder === order ? 'sort-button is-active' : 'sort-button'}
                        aria-pressed={weaponSortOrder === order}
                        onClick={() => setWeaponSortOrder(order)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {renderInventoryItems(sortedWeaponItems)}
              </section>
            )}

            {otherItems.length > 0 && (
              <section className="inventory-group">
                <div className="inventory-group-heading">
                  <h3>Equipment &amp; ammunition <span>{otherItems.length}</span></h3>
                </div>
                {renderInventoryItems(otherItems)}
              </section>
            )}
          </div>
        </aside>

        <main className="mech-stage">
          <div className="stage-heading">
            <div>
              <p className="eyebrow">02 / VISUAL REFERENCE</p>
              <h2>{currentMech.name}</h2>
            </div>
            <span className="variant-tag">{currentMech.variant}</span>
          </div>
          <div className="image-well">
            {mechIllustration}
          </div>
          {sarnaSource}
        </main>

        <aside className="components-column">
          <header className="section-heading components-heading">
            <div>
              <p className="eyebrow">03 / HARDPOINTS</p>
              <h2>Components</h2>
            </div>
            <span className="component-count">8 SECTIONS</span>
          </header>
          <div className="component-stack">
            {ZONES.map(({ zone, label }) => (
              <ComponentPanel
                key={zone}
                title={label}
                baseData={currentMech.components[zone]}
                equippedItems={loadout[zone]}
                isActive={activeZone === zone}
                armorFront={armor[zone]?.front || 0}
                armorRear={armor[zone]?.rear || 0}
                onSelect={() => setActiveZone(zone)}
                onRemoveItem={(instanceId) => handleRemoveItem(zone, instanceId)}
                onTierChange={(instanceId, tier) => handleTierChange(zone, instanceId, tier)}
                onArmorChange={(type, value) => handleArmorChange(zone, type, value)}
              />
            ))}
          </div>
        </aside>
      </div> : (
        <section className="build-preview" aria-label="Final build preview">
          <header className="preview-heading">
            <div>
              <p className="eyebrow">04 / FINAL CONFIGURATION</p>
              <h2>{currentMech.name} <span>{currentMech.variant}</span></h2>
            </div>
            <p className="preview-hint">COMPONENT LOADOUT / {Object.values(loadout).flat().length} ITEMS FITTED</p>
          </header>
          <div className="preview-board">
            <div className="preview-mech">
              {mechIllustration}
              {sarnaSource}
            </div>
            {ZONES.map(({ zone, label, position }) => {
              const items = loadout[zone];
              const weapons = items.filter(item => item.type === 'weapon');
              const equipment = items.filter(item => item.type !== 'weapon');
              const partArmor = armor[zone];
              const componentData = currentMech.components[zone];
              const maxArmor = componentData.maxArmor;
              const totalArmor = partArmor.front + partArmor.rear;

              return (
                <article key={zone} className={`preview-component preview-${position}`}>
                  <header>
                    <h3>{label}</h3>
                    <span>{items.length.toString().padStart(2, '0')}</span>
                  </header>
                  <div className="preview-armor" aria-label={`Armor: ${partArmor.front} front${componentData.hasRearArmor ? `, ${partArmor.rear} rear` : ''}, ${maxArmor} maximum`}>
                    <div className="preview-armor-values">
                      <span className="preview-armor-front-label">FRONT {partArmor.front}</span>
                      {componentData.hasRearArmor && (
                        <span className="preview-armor-rear-label">REAR {partArmor.rear}</span>
                      )}
                      <strong>{totalArmor}/{maxArmor}</strong>
                    </div>
                    <div className="preview-armor-track" aria-hidden="true">
                      <span className="preview-armor-front" style={{ width: `${maxArmor > 0 ? partArmor.front / maxArmor * 100 : 0}%` }} />
                      {componentData.hasRearArmor && (
                        <span className="preview-armor-rear" style={{ width: `${maxArmor > 0 ? partArmor.rear / maxArmor * 100 : 0}%` }} />
                      )}
                    </div>
                  </div>
                  <div className="preview-component-items">
                    {weapons.length > 0 && (
                      <section className="preview-item-group">
                        <h4>WEAPONS</h4>
                        {weapons.map(item => (
                          <span key={item.instanceId} className="preview-equipped-item">{item.name}</span>
                        ))}
                      </section>
                    )}
                    {equipment.length > 0 && (
                      <section className="preview-item-group">
                        <h4>EQUIPMENT / AMMO</h4>
                        {equipment.map(item => (
                          <span key={item.instanceId} className="preview-equipped-item">{item.name}</span>
                        ))}
                      </section>
                    )}
                    {items.length === 0 && <span className="preview-empty">No equipment</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {(weapons.length > 0 || ammunition.length > 0) && (
        <section className="loadout-analysis" aria-label="Loadout performance">
          {weapons.length > 0 && (
            <div className="analysis-table-wrap">
              <header className="analysis-heading">
                <div>
                  <p className="eyebrow">05 / COMBAT DATA</p>
                  <h2>Weapon performance</h2>
                </div>
                <span className="analysis-note">NOMINAL DPS = DAMAGE × RPM / 60</span>
              </header>
              <div className="analysis-overflow">
                <table className="weapon-table">
                  <thead>
                    <tr>
                      <th>Weapon</th>
                      <th>Section</th>
                      <th>Volley damage</th>
                      <th>Heat</th>
                      <th>RPM</th>
                      <th>Nominal DPS</th>
                      <th>Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weapons.map(({ item, zone, damage, heat, rpm, dps, range }, index) => (
                      <tr key={`${item.id}-${zone}-${index}`}>
                        <td>{item.name}</td>
                        <td>{ZONE_LABELS[zone]}</td>
                        <td>{damage.toFixed(1)}</td>
                        <td>{heat.toFixed(1)}</td>
                        <td>{rpm > 0 ? rpm.toFixed(1) : '—'}</td>
                        <td>{dps > 0 ? dps.toFixed(1) : '—'}</td>
                        <td>{range !== null ? `${range.toFixed(0)} m` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {ammunition.length > 0 && (
            <div className="ammunition-list">
              <header className="analysis-heading">
                <div>
                  <p className="eyebrow">STORES</p>
                  <h2>Installed ammunition</h2>
                </div>
              </header>
              {ammunitionGroups.map(({ label, capacity, bins }) => (
                <div className="ammunition-row" key={label}>
                  <span>{label}<small>{bins} {bins === 1 ? 'bin' : 'bins'}</small></span>
                  <strong>{capacity} rounds</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}