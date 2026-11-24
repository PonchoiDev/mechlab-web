import { useEffect, useMemo, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { TierSelector } from '../components/TierSelector';
import type { YamlBuild, YamlItem, YamlMech } from '../types/yaml-mechlab';
import { ZONE_LABELS } from '../utils/zones';
import { getInternalLabel, getZoneRows, INTERNAL_SLOT_LABELS, type FillerGroup } from '../utils/yaml/board';
import { getDefaultTier, getWeaponTiers } from '../utils/yaml/combat';
import { getItemColor, getModLogo, getSlotColor, getYamlItem } from '../utils/yaml/data';
import {
  countYamlByCategory, filterYamlInventory, getYamlInternalChoices, getYamlInventoryCategory, getYamlInventoryItems,
  sortYamlInventory, YAML_INVENTORY_CATEGORIES, type YamlInventoryCategory, type YamlInventoryFilters,
  type YamlInventoryTarget, type YamlSortDirection, type YamlSortKey
} from '../utils/yaml/inventory';

// Inventario del MechLab de YAML, el mismo que el de MW5 y BATTLETECH (components/InventoryPanel.tsx y
// battletech/mechlab/BtInventoryPanel.tsx) con las reglas de YAML. Con una ranura interna elegida en el
// tablero, enseña lo que admite, como el panel «Equipping to» del mechlab del juego.

interface YamlInventoryPanelProps {
  mech: YamlMech;
  build: YamlBuild;
  side: 'left' | 'right';
  target: YamlInventoryTarget | null;
  fillers: Record<string, FillerGroup[]>;
  onClearTarget: () => void;
  pickedItem: string | null;
  onPick: (id: string | null) => void;
  onEquip: (id: string) => void;
  onQuickEquip: (id: string) => void;
  onChooseInternal: (slotType: string, id: string | null) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onRemoveWeapon: (hardpoint: string) => void;
  onRemoveItem: (index: number) => void;
  // El nivel elegido para cada arma del inventario y el de las armas montadas.
  inventoryTiers: Record<string, number>;
  onInventoryTierChange: (id: string, tier: number) => void;
  onWeaponTierChange: (hardpoint: string, tier: number) => void;
  onToggleSide: () => void;
  onClose: () => void;
}

const ICON_BASE = `${import.meta.env.BASE_URL}mechlab/inventory/`;
const CATEGORY_LABELS: Record<YamlInventoryCategory, string> = {
  all: 'All', energy: 'Energy', ballistic: 'Ballistic', missile: 'Missile', ams: 'AMS', melee: 'Melee', equipment: 'Equipment', ammo: 'Ammo'
};
const HAS_ICON: YamlInventoryCategory[] = ['energy', 'ballistic', 'missile', 'ams', 'melee', 'equipment'];
const COLUMNS: [YamlSortKey, string, string][] = [['name', 'Name', 'Name'], ['slots', 'Slots', 'Critical slots'], ['tons', 'Tons', 'Tonnage']];
// El logo del mod de la pieza, como en el mechlab del juego.
export function ModLogo({ id }: { id: string | undefined }) {
  const logo = getModLogo(id);
  return logo ? <img className="yaml-mod-logo" src={logo} alt="" width={22} height={22} /> : null;
}

// El selector de nivel del MechLab de MW5, solo en las armas con más de un nivel.
function WeaponTierSelector({ id, tier, onChange }: { id: string; tier: number; onChange: (tier: number) => void }) {
  const tiers = getWeaponTiers(id);
  if (tiers.length < 2) return null;
  const item = { name: getYamlItem(id)?.name ?? id, tier: String(tier), tiers: Object.fromEntries(tiers.map(value => [value, true])) };
  return <TierSelector item={item} onChange={(value) => onChange(Number(value))} />;
}

const DEFAULT_FILTERS: YamlInventoryFilters = { category: 'all', search: '', fitsOnly: true };
const formatTons = (tons: number) => String(Number(tons.toFixed(2)));
const weaponType = (item: YamlItem) => item.kind === 'weapon' ? item.hardpoint : undefined;

function InventoryRow({ id, item, isPicked, hint, tier, onTierChange, onActivate, onContextMenu, onDragStart, onDragEnd }: {
  id: string;
  item: YamlItem;
  isPicked: boolean;
  hint: string;
  tier: number;
  onTierChange: (tier: number) => void;
  onActivate: () => void;
  onContextMenu: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <li className={isPicked ? 'inventory-row is-picked' : 'inventory-row'} data-weapon-type={weaponType(item)} data-category={item.kind}
      style={{ '--item-color': getItemColor(id), '--weapon-color': getItemColor(id) } as CSSProperties}>
      {/* Un div y no un botón: Firefox no deja arrastrar botones. */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isPicked}
        className="inventory-item"
        draggable
        data-id={id}
        title={`${item.name}: ${hint}`}
        onClick={onActivate}
        onContextMenu={(event: MouseEvent) => { event.preventDefault(); onContextMenu(); }}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onActivate();
        }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <span className="inventory-item-name">{item.name}<ModLogo id={id} /></span>
        <span>{item.slots}</span>
        <span>{formatTons(item.tons)}</span>
      </div>
      {/* El nivel se elige en la fila seleccionada: una fila por arma, no una por nivel como en el juego. */}
      {isPicked && item.kind === 'weapon' && (
        <div className="inventory-item-tier">
          <WeaponTierSelector id={id} tier={tier} onChange={onTierChange} />
        </div>
      )}
    </li>
  );
}

// La ubicación elegida y lo que lleva, para quitarlo, como en el inventario de MW5.
function TargetSection({ mech, build, target, fillers, onClear, onRemoveWeapon, onRemoveItem, onTierChange }: {
  mech: YamlMech;
  build: YamlBuild;
  target: YamlInventoryTarget;
  fillers: Record<string, FillerGroup[]>;
  onClear: () => void;
  onRemoveWeapon: (hardpoint: string) => void;
  onRemoveItem: (index: number) => void;
  onTierChange: (hardpoint: string, tier: number) => void;
}) {
  const rows = getZoneRows(mech, build, target.zone, fillers).filter(row => row.kind !== 'free');
  const hardpointWeapon = target.hardpoint ? build.weapons.find(weapon => weapon.hardpoint === target.hardpoint) : undefined;
  return (
    <section className="inventory-target" aria-label="Target">
      <div className="inventory-target-heading">
        <div>
          <p className="eyebrow">{target.internal ? 'EQUIPPING TO' : 'EQUIP INTO'}</p>
          <h3>
            {ZONE_LABELS[target.zone]}
            {target.internal && ` · ${INTERNAL_SLOT_LABELS[target.internal]}: ${getInternalLabel(build, target.internal)}`}
            {hardpointWeapon && ` · replace ${getYamlItem(hardpointWeapon.item)?.name ?? hardpointWeapon.item}`}
          </h3>
        </div>
        <button type="button" className="editor-close" aria-label="Clear target" title="Clear target (Esc)" onClick={onClear}>✕</button>
      </div>
      {!target.internal && (rows.length === 0 ? (
        <p className="editor-empty">Nothing installed yet.</p>
      ) : (
        <div className="installed-list inventory-installed">
          {rows.map((row, index) => (
            <div key={index} className={row.kind === 'fixedFiller' || row.kind === 'dynamicFiller' ? 'installed-item is-built-in' : 'installed-item'}>
              <span className="installed-item-name">{row.kind === 'dynamicFiller' ? 'Dynamic filler' : 'label' in row ? row.label : ''} <small>{row.slots} {row.slots === 1 ? 'slot' : 'slots'}</small></span>
              {row.kind === 'weapon' && <WeaponTierSelector id={row.item} tier={row.tier} onChange={(tier) => onTierChange(row.hardpoint, tier)} />}
              {row.kind === 'weapon' && <button type="button" className="remove-item" aria-label={`Remove ${row.label}`} onClick={() => onRemoveWeapon(row.hardpoint)}>✕</button>}
              {row.kind === 'item' && <button type="button" className="remove-item" aria-label={`Remove ${row.label}`} onClick={() => onRemoveItem(row.index)}>✕</button>}
              {(row.kind === 'fixedFiller' || row.kind === 'dynamicFiller') && <span className="built-in-tag">FILLER</span>}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function InternalChoices({ mech, build, slotType, onChoose }: { mech: YamlMech; build: YamlBuild; slotType: string; onChoose: (id: string | null) => void }) {
  const choices = useMemo(() => getYamlInternalChoices(mech, build, slotType), [mech, build, slotType]);
  const current = build.internal[slotType];
  return (
    <div className="inventory-scroll">
      <div className="inventory-table-head" role="group">
        <button type="button" disabled>Name</button>
        <button type="button" disabled>Tons</button>
      </div>
      <ul className="inventory-list yaml-internal-choices">
        {slotType !== 'Engine' && (
          <li className={!current ? 'inventory-row is-picked' : 'inventory-row'}>
            <div role="button" tabIndex={0} className="inventory-item" onClick={() => onChoose(null)}>
              <span className="inventory-item-name">{getInternalLabel({ ...build, internal: {} }, slotType)}</span>
              <span>0</span>
            </div>
          </li>
        )}
        {choices.map(choice => (
          <li key={choice.id} className={[choice.id === current ? 'inventory-row is-picked' : 'inventory-row', choice.error ? 'is-blocked' : ''].filter(Boolean).join(' ')}
            style={{ '--item-color': getYamlItem(choice.id)?.color ?? getSlotColor(slotType) } as CSSProperties}>
            <div
              role="button"
              tabIndex={0}
              aria-disabled={!!choice.error}
              className="inventory-item"
              title={choice.error ?? `Install ${choice.name}`}
              onClick={() => onChoose(choice.id)}
            >
              <span className="inventory-item-name">{choice.name}<ModLogo id={choice.id} />{choice.error && <small className="yaml-choice-reason">{choice.error}</small>}</span>
              <span>{formatTons(choice.tons)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function YamlInventoryPanel(props: YamlInventoryPanelProps) {
  const { mech, build, side, target, pickedItem, onPick, onEquip, onQuickEquip, onDragStart, onDragEnd } = props;
  const [filters, setFilters] = useState<YamlInventoryFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<YamlSortKey>('name');
  const [sortDirection, setSortDirection] = useState<YamlSortDirection>('asc');
  const catalog = useMemo(() => getYamlInventoryItems(), []);

  // Al elegir un destino, la casilla se marca y la pestaña vuelve a All, como en MW5.
  const targetKey = target ? `${target.zone}:${target.hardpoint}:${target.internal}` : null;
  const [lastTargetKey, setLastTargetKey] = useState(targetKey);
  if (targetKey !== lastTargetKey) {
    setLastTargetKey(targetKey);
    if (targetKey) setFilters(current => ({ ...current, category: 'all', fitsOnly: true }));
  }

  const matching = useMemo(
    () => filterYamlInventory(catalog, { ...filters, category: 'all' }, mech, build, target),
    [catalog, filters, mech, build, target]
  );
  const counts = countYamlByCategory(matching);
  const shown = sortYamlInventory(
    filters.category === 'all' ? matching : matching.filter(({ item }) => getYamlInventoryCategory(item) === filters.category),
    sortKey,
    sortDirection
  );
  const update = (changes: Partial<YamlInventoryFilters>) => setFilters(current => ({ ...current, ...changes }));
  const sortBy = (key: YamlSortKey) => {
    if (key === sortKey) {
      setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'name' ? 'asc' : 'desc');
  };

  useEffect(() => {
    if (!pickedItem) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onPick(null); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pickedItem, onPick]);

  const hint = target
    ? `click to equip it in ${ZONE_LABELS[target.zone]}, or drag it onto the board`
    : 'drag it onto the board, click it and then click a location, or right-click to equip it where it fits';

  return (
    <aside className={side === 'left' ? 'inventory-panel yaml-inventory is-left' : 'inventory-panel yaml-inventory'} aria-label="Inventory">
      <header className="editor-header inventory-header">
        <div>
          <p className="eyebrow">ARSENAL</p>
          <h2>Inventory</h2>
        </div>
        <span className="editor-header-actions">
          <button type="button" className="editor-side" aria-label={side === 'right' ? 'Move inventory to the left' : 'Move inventory to the right'} onClick={props.onToggleSide}>⇄</button>
          <button type="button" className="editor-close" aria-label="Close inventory" onClick={props.onClose}>✕</button>
        </span>
      </header>

      {target && (
        <TargetSection mech={mech} build={build} target={target} fillers={props.fillers} onClear={props.onClearTarget}
          onRemoveWeapon={props.onRemoveWeapon} onRemoveItem={props.onRemoveItem} onTierChange={props.onWeaponTierChange} />
      )}

      {target?.internal ? (
        <InternalChoices mech={mech} build={build} slotType={target.internal} onChoose={(id) => props.onChooseInternal(target.internal!, id)} />
      ) : (
        <>
          <div className="inventory-controls">
            <p className="inventory-hint" role="status">
              {target
                ? <>Click an item to equip it in <strong>{ZONE_LABELS[target.zone]}</strong>, or drag it anywhere on the board.</>
                : pickedItem
                  ? <>Placing <strong>{getYamlItem(pickedItem)?.name}</strong>: click a highlighted location. Esc to stop.</>
                  : 'Click a location to equip into it, or one of its internal slots to change the engine, gyro, armor or structure.'}
            </p>
            <input type="search" className="editor-search" placeholder="Search items" aria-label="Search items" value={filters.search}
              onChange={(event) => update({ search: event.target.value })} />
            <div className="inventory-row-controls">
              <label className="inventory-fits">
                <input type="checkbox" checked={filters.fitsOnly} onChange={(event) => update({ fitsOnly: event.target.checked })} />
                {target ? `Fits ${ZONE_LABELS[target.zone]}` : 'Fits this \'Mech'}
              </label>
            </div>
          </div>

          <div className="inventory-tabs" role="group" aria-label="Item type">
            {YAML_INVENTORY_CATEGORIES.map(category => (
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
                {HAS_ICON.includes(category) ? <img src={`${ICON_BASE}${category}.png`} alt="" width={22} height={22} /> : CATEGORY_LABELS[category]}
                <small>{counts[category]}</small>
              </button>
            ))}
          </div>

          <div className="inventory-scroll">
            <div className="inventory-table-head" role="group" aria-label="Sort items">
              {COLUMNS.map(([key, label, description]) => (
                <button key={key} type="button" className={sortKey === key ? 'is-active' : undefined} aria-pressed={sortKey === key}
                  title={sortKey === key ? `${description}: click again to reverse the order` : `Sort by ${description.toLowerCase()}`}
                  onClick={() => sortBy(key)}>
                  {label}{sortKey === key && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                </button>
              ))}
            </div>
            {shown.length > 0 ? (
              <ul className="inventory-list">
                {shown.map(({ id, item }) => {
                  const isPicked = !target && pickedItem === id;
                  return (
                    <InventoryRow
                      key={id}
                      id={id}
                      item={item}
                      isPicked={isPicked}
                      hint={hint}
                      tier={props.inventoryTiers[id] ?? getDefaultTier(id)}
                      onTierChange={(tier) => props.onInventoryTierChange(id, tier)}
                      onActivate={() => target ? onEquip(id) : onPick(isPicked ? null : id)}
                      onContextMenu={() => onQuickEquip(id)}
                      onDragStart={(event) => {
                        // Firefox no empieza a arrastrar sin datos; el objeto viaja en el estado de la página.
                        event.dataTransfer.setData('text/plain', item.name);
                        event.dataTransfer.effectAllowed = 'copyMove';
                        onDragStart(id);
                      }}
                      onDragEnd={onDragEnd}
                    />
                  );
                })}
              </ul>
            ) : (
              <div className="inventory-empty">
                <p className="editor-empty">
                  {filters.fitsOnly ? (target ? `Nothing that fits ${ZONE_LABELS[target.zone]} matches these filters.` : 'Nothing that fits this \'Mech matches these filters.') : 'No items match these filters.'}
                </p>
                <button type="button" className="editor-link" onClick={() => setFilters({ ...DEFAULT_FILTERS, fitsOnly: false })}>Clear filters</button>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
