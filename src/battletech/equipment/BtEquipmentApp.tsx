import { useEffect, useMemo, useState } from 'react';
import itemsJson from '../../data/battletech/items.json';
import type { BtHardpoint, BtItem, BtSource } from '../../types/battletech-mechlab';
import { getRarityGroup, HARDPOINT_LABELS, HARDPOINTS, RARITY_GROUPS, SOURCE_LABELS, SOURCES, type BtRarityGroup } from '../../utils/battletech/catalog';
import {
  PLUS_OPTIONS,
  filterBtWeaponRows,
  getBtAmmoRows,
  getBtEquipmentEffects,
  getBtWeaponRows,
  groupBtEquipment,
  groupBtUpgrades,
  parseBtEquipmentQuery,
  sortBtWeaponRows,
  toBtEquipmentQuery,
  toggleBtWeaponSort,
  type BtEquipmentCategory,
  type BtEquipmentView,
  type BtWeaponRow,
  type BtWeaponSortKey
} from '../../utils/battletech/equipment';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { SupportLink } from '../../components/SupportLink';
import { WhatsNew } from '../../components/WhatsNew';

const items = itemsJson as unknown as BtItem[];
const WEAPON_ROWS = getBtWeaponRows(items);
// Solo las fuentes que traen objetos (Flashpoint no trae ninguno).
const ITEM_SOURCES = SOURCES.filter(source => items.some(item => item.source === source));
const RARITY_LABELS = Object.fromEntries(RARITY_GROUPS.map(group => [group.group, group.label])) as Record<BtRarityGroup, string>;

const formatNumber = (value: number | null) => value === null ? '' : String(Number(value.toFixed(2)));
const signed = (value: number) => value > 0 ? `+${value}` : String(value);

interface Column {
  key: BtWeaponSortKey;
  label: string;
  title?: string;
  value: (row: BtWeaponRow) => string;
}

const COLUMNS: Column[] = [
  { key: 'hardpoint', label: 'Hardpoint', value: row => HARDPOINT_LABELS[row.item.hardpoint ?? 'energy'] },
  { key: 'tonnage', label: 'Tons', value: row => formatNumber(row.item.tonnage) },
  { key: 'slots', label: 'Slots', value: row => String(row.item.slots) },
  { key: 'damage', label: 'Dmg', title: 'Damage of one attack: damage per shot times shots', value: row => row.shots > 1 ? `${row.damage} (${row.damagePerShot}×${row.shots})` : String(row.damage) },
  { key: 'instability', label: 'Stab', title: 'Stability damage of one attack', value: row => formatNumber(row.instability) },
  { key: 'heat', label: 'Heat', title: 'Heat generated per attack', value: row => formatNumber(row.heat) },
  { key: 'heatDamage', label: 'Heat dmg', title: 'Heat added to the target', value: row => row.heatDamage ? formatNumber(row.heatDamage) : '' },
  { key: 'accuracy', label: 'Acc', title: 'Accuracy bonus, as the game shows it', value: row => row.accuracy ? signed(row.accuracy) : '' },
  { key: 'crit', label: 'Crit', title: 'Critical chance multiplier', value: row => row.crit !== 1 ? `×${row.crit}` : '' },
  { key: 'minRange', label: 'Min', title: 'Minimum range in meters', value: row => row.minRange ? String(row.minRange) : '' },
  { key: 'maxRange', label: 'Max', title: 'Maximum range in meters; point at a value for the short, medium and long range brackets', value: row => String(row.maxRange) },
  { key: 'ammoPerTon', label: 'Ammo/t', title: 'Rounds in one ton of ammo, and the attacks they give', value: row => row.ammoPerTon === null ? '' : String(row.ammoPerTon) },
  { key: 'damagePerTon', label: 'Dmg/t', title: 'Damage of one attack per ton of the weapon itself (ammo not counted)', value: row => formatNumber(row.damagePerTon) },
  { key: 'rarity', label: 'Rarity', title: 'Common, uncommon and rare items show up in stores; special ones are rewards and lostech', value: row => RARITY_LABELS[getRarityGroup(row.item.rarity)] },
];

function SortButton({ view, sortKey, label, title, onSort }: {
  view: BtEquipmentView; sortKey: BtWeaponSortKey; label: string; title?: string; onSort: (key: BtWeaponSortKey) => void;
}) {
  const active = view.sort.key === sortKey;
  return (
    <button type="button" className={active ? 'is-active' : undefined} title={title} onClick={() => onSort(sortKey)}>
      {label}
      <span aria-hidden="true">{active ? (view.sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  );
}

function WeaponTable({ rows, view, onSort }: { rows: BtWeaponRow[]; view: BtEquipmentView; onSort: (key: BtWeaponSortKey) => void }) {
  const ariaSort = (key: BtWeaponSortKey) => view.sort.key === key ? (view.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
  return (
    <div className="arsenal-table-wrap">
      <table className="arsenal-table arsenal-weapons">
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort('name')}><SortButton view={view} sortKey="name" label="Weapon" onSort={onSort} /></th>
            {COLUMNS.map(column => (
              <th key={column.key} scope="col" aria-sort={ariaSort(column.key)}>
                <SortButton view={view} sortKey={column.key} label={column.label} title={column.title} onSort={onSort} />
              </th>
            ))}
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.item.id} data-type={row.item.hardpoint}>
              <th scope="row">
                <span className="arsenal-weapon-name">{row.item.name}</span>
                <span className="arsenal-weapon-meta">
                  <span>{row.item.manufacturer}</span>
                  {row.item.bonuses.map(bonus => <span key={bonus} className="arsenal-badge">{bonus}</span>)}
                  {row.indirectFire && <span title="Can fire at targets out of line of sight">Indirect</span>}
                </span>
              </th>
              {COLUMNS.map(column => (
                <td
                  key={column.key}
                  className={`is-${column.key}`}
                  // Los tramos de alcance corto, medio y largo del juego van en la ayuda del alcance máximo:
                  // como columna aparte, la tabla no cabía.
                  title={column.key === 'maxRange' ? `Short, medium and long range brackets: ${row.rangeSplit.join(' · ')} m` : undefined}
                >
                  {column.value(row)}
                  {column.key === 'ammoPerTon' && row.attacksPerTon !== null && row.attacksPerTon !== row.ammoPerTon && (
                    <small> ({row.attacksPerTon} attacks)</small>
                  )}
                </td>
              ))}
              <td>{SOURCE_LABELS[row.item.source]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EquipmentCard({ item }: { item: BtItem }) {
  const effects = getBtEquipmentEffects(item);
  return (
    <article className="unit-card arsenal-card">
      <header className="unit-card-header">
        <p className="unit-card-kind">
          <span>{item.manufacturer}</span>
          <span>{RARITY_LABELS[getRarityGroup(item.rarity)]}</span>
          <span>{SOURCE_LABELS[item.source]}</span>
        </p>
        <h3 className="arsenal-card-name">{item.name}</h3>
      </header>
      <dl className="unit-card-stats arsenal-card-stats">
        <div><dt>Tons</dt><dd>{formatNumber(item.tonnage)}</dd></div>
        <div><dt>Slots</dt><dd>{item.slots}</dd></div>
      </dl>
      <dl className="arsenal-effects">
        {effects.map(effect => (
          <div key={effect.label}><dt>{effect.label}</dt><dd>{effect.value}</dd></div>
        ))}
      </dl>
      {item.bonuses.length > 0 && (
        <ul className="arsenal-bonus-list" aria-label="Bonuses">
          {item.bonuses.map(bonus => <li key={bonus}>{bonus}</li>)}
        </ul>
      )}
    </article>
  );
}

function AmmoTable({ ammo }: { ammo: BtItem[] }) {
  const rows = useMemo(() => getBtAmmoRows(items, ammo), [ammo]);
  return (
    <div className="arsenal-table-wrap">
      <table className="arsenal-table arsenal-ammo">
        <thead>
          <tr>
            <th scope="col">Ammo</th>
            <th scope="col">Tons</th>
            <th scope="col">Slots</th>
            <th scope="col">Rounds</th>
            <th scope="col">Source</th>
            <th scope="col">Used by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, users }) => (
            <tr key={item.id}>
              <th scope="row"><span className="arsenal-weapon-name">{item.name}</span></th>
              <td>{formatNumber(item.tonnage)}</td>
              <td>{item.slots}</td>
              <td>{item.ammo?.capacity ?? ''}</td>
              <td>{SOURCE_LABELS[item.source]}</td>
              <td className="arsenal-users">{users.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommonFilters({ view, update }: { view: BtEquipmentView; update: (change: Partial<BtEquipmentView>) => void }) {
  return (
    <>
      <label>
        <span>Version</span>
        <select value={String(view.plus)} onChange={event => update({ plus: event.target.value === 'all' ? 'all' : Number(event.target.value) })}>
          <option value="all">All</option>
          {PLUS_OPTIONS.map(option => <option key={option.plus} value={option.plus}>{option.label}</option>)}
        </select>
      </label>
      <label>
        <span>Source</span>
        <select value={view.source} onChange={event => update({ source: event.target.value as BtSource | 'all' })}>
          <option value="all">All</option>
          {ITEM_SOURCES.map(source => <option key={source} value={source}>{SOURCE_LABELS[source]}</option>)}
        </select>
      </label>
      <label>
        <span>Rarity</span>
        <select value={view.rarity} onChange={event => update({ rarity: event.target.value as BtRarityGroup | 'all' })}>
          <option value="all">All</option>
          {RARITY_GROUPS.map(group => <option key={group.group} value={group.group} title={group.title}>{group.label}</option>)}
        </select>
      </label>
    </>
  );
}

export function BtEquipmentApp() {
  const [view, setView] = useState<BtEquipmentView>(() => parseBtEquipmentQuery(window.location.search));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => sortBtWeaponRows(filterBtWeaponRows(WEAPON_ROWS, view), view.sort), [view]);
  const typeCounts = useMemo(() => Object.fromEntries(HARDPOINTS.map(hardpoint => [
    hardpoint, filterBtWeaponRows(WEAPON_ROWS, { ...view, hardpoint }).length
  ])), [view]);
  const typeTotal = useMemo(() => filterBtWeaponRows(WEAPON_ROWS, { ...view, hardpoint: 'all' }).length, [view]);

  const { query, plus, source, rarity } = view;
  const allGroups = useMemo(() => groupBtEquipment(items, { category: 'all', query, plus, source, rarity }), [query, plus, source, rarity]);
  const groups = view.category === 'all' ? allGroups : allGroups.filter(group => group.id === view.category);
  const equipmentTotal = allGroups.reduce((total, group) => total + group.items.length, 0);
  const equipmentCount = useMemo(() => groupBtEquipment(items, { category: 'all', query: '', plus: 'all', source: 'all', rarity: 'all' })
    .reduce((total, group) => total + group.items.length, 0), []);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toBtEquipmentQuery(view)}`);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (change: Partial<BtEquipmentView>) => setView(current => ({ ...current, ...change }));
  const sortBy = (key: BtWeaponSortKey) => setView(current => ({ ...current, sort: toggleBtWeaponSort(current.sort, key) }));

  return (
    <div className="units arsenal">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Equipment</h1>
        <nav className="units-links" aria-label="BATTLETECH">
          <a href="/battletech/"><small>BATTLETECH</small> MechLab</a>
          <a href="/battletech/starmap/">Star map</a>
          <a href="/battletech/flashpoints/">Flashpoints</a>
          <a href="/battletech/units/">Enemy units</a>
          <a href="/battletech/argo/">Argo</a>
          <a href="/battletech/equipment/" aria-current="page">Equipment</a>
        </nav>
        <div className="units-actions">
          <WhatsNew />
          <button type="button" className="units-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
      </header>

      <main className="units-main">
        <section className="units-intro">
          <p>
            Every weapon and piece of equipment in BATTLETECH, from the base game and its DLC. Each manufacturer makes its own
            +, + + and + + + versions, with their own bonus, so every version gets its own row. Weapons take slots and a
            hardpoint of their type; damage is one attack, as weapons fire once per turn.
          </p>
        </section>

        <div className="arsenal-tabs" role="group" aria-label="Section">
          <button type="button" aria-pressed={view.tab === 'weapons'} onClick={() => update({ tab: 'weapons' })}>
            Weapons <small>{WEAPON_ROWS.length}</small>
          </button>
          <button type="button" aria-pressed={view.tab === 'equipment'} onClick={() => update({ tab: 'equipment' })}>
            Equipment <small>{equipmentCount}</small>
          </button>
        </div>

        {view.tab === 'weapons' && (
          <>
            <section className="units-controls" aria-label="Filters">
              <div className="units-kinds" role="group" aria-label="Hardpoint">
                <button type="button" aria-pressed={view.hardpoint === 'all'} onClick={() => update({ hardpoint: 'all' })}>
                  All <small>{typeTotal}</small>
                </button>
                {HARDPOINTS.map(hardpoint => (
                  <button key={hardpoint} type="button" aria-pressed={view.hardpoint === hardpoint}
                    onClick={() => update({ hardpoint: hardpoint as BtHardpoint })}>
                    {HARDPOINT_LABELS[hardpoint]} <small>{typeCounts[hardpoint]}</small>
                  </button>
                ))}
              </div>
              <div className="units-search arsenal-filters">
                <input
                  type="search"
                  placeholder="Name or manufacturer"
                  aria-label="Search weapons by name or manufacturer"
                  value={view.query}
                  onChange={event => update({ query: event.target.value })}
                />
                <CommonFilters view={view} update={update} />
              </div>
            </section>
            {rows.length > 0
              ? <WeaponTable rows={rows} view={view} onSort={sortBy} />
              : <p className="units-empty">No weapons match these filters.</p>}
          </>
        )}

        {view.tab === 'equipment' && (
          <>
            <section className="units-controls" aria-label="Filters">
              <div className="units-kinds" role="group" aria-label="Equipment type">
                <button type="button" aria-pressed={view.category === 'all'} onClick={() => update({ category: 'all' })}>
                  All <small>{equipmentTotal}</small>
                </button>
                {allGroups.map(group => (
                  <button key={group.id} type="button" aria-pressed={view.category === group.id}
                    onClick={() => update({ category: group.id as BtEquipmentCategory })}>
                    {group.label} <small>{group.items.length}</small>
                  </button>
                ))}
              </div>
              <div className="units-search arsenal-filters">
                <input
                  type="search"
                  placeholder="Name or manufacturer"
                  aria-label="Search equipment by name or manufacturer"
                  value={view.query}
                  onChange={event => update({ query: event.target.value })}
                />
                <CommonFilters view={view} update={update} />
              </div>
            </section>
            {groups.length > 0 ? groups.map(group => (
              <section key={group.id} className="arsenal-section">
                <h2>{group.label} <small>{group.items.length}</small></h2>
                <p>{group.description}</p>
                {group.id === 'ammo' && <AmmoTable ammo={group.items} />}
                {group.id === 'upgrades' && groupBtUpgrades(group.items).map(upgrades => (
                  <div key={upgrades.group} className="arsenal-subsection">
                    <h3>{upgrades.label} <small>{upgrades.items.length}</small></h3>
                    <div className="units-grid">{upgrades.items.map(item => <EquipmentCard key={item.id} item={item} />)}</div>
                  </div>
                ))}
                {group.id !== 'ammo' && group.id !== 'upgrades' && (
                  <div className="units-grid">{group.items.map(item => <EquipmentCard key={item.id} item={item} />)}</div>
                )}
              </section>
            )) : <p className="units-empty">No equipment matches these filters.</p>}
          </>
        )}
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toBtEquipmentQuery(view)}`}
          attachLabel="Attach a link to this list"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
