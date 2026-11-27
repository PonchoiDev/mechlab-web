import { useEffect, useMemo, useState } from 'react';
import itemsJson from '../data/items.json';
import type { Item } from '../types/item';
import {
  ARSENAL_SIZES,
  ARSENAL_WEAPON_TYPES,
  TECH_OPTIONS,
  TIER_OPTIONS,
  filterWeaponRows,
  getAmmoRows,
  getDlcOptions,
  getEquipmentEffects,
  getItemDlc,
  getWeaponRows,
  groupEquipment,
  parseArsenalQuery,
  sortWeaponRows,
  toArsenalQuery,
  toggleWeaponSort,
  type ArsenalView,
  type DlcFilter,
  type EquipmentCategory,
  type TechFilter,
  type WeaponRow,
  type WeaponSortKey
} from '../utils/arsenal';
import { getSizeName, getTechBaseName, getWeaponTypeName } from '../utils/items';
import { getContentSourceLabel } from '../utils/mechs';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { SupportLink } from '../components/SupportLink';
import { WhatsNew } from '../components/WhatsNew';
import { BrandMark } from '../components/BrandMark';
import { SiteNav } from '../components/SiteNav';

const items = Object.values(itemsJson as unknown as Record<string, Item>);
const DLC_OPTIONS = getDlcOptions(items);

// Hasta dos decimales, sin ceros de más (2.25, 1.3, 15).
const formatNumber = (value: number | null, decimals = 2) => value === null ? '' : String(Number(value.toFixed(decimals)));

interface Column {
  key: WeaponSortKey;
  label: string;
  title?: string;
  value: (row: WeaponRow) => string;
}

const COLUMNS: Column[] = [
  { key: 'hardpoint', label: 'Hardpoint', value: row => `${getSizeName(row.item.size)} ${getWeaponTypeName(row.item.weaponType ?? 'energy')}` },
  { key: 'tonnage', label: 'Tons', value: row => formatNumber(row.item.tonnage) },
  { key: 'damage', label: 'Dmg', title: 'Damage per volley (all missiles or pellets)', value: row => formatNumber(row.damage) },
  { key: 'heat', label: 'Heat', title: 'Heat per volley', value: row => formatNumber(row.heat) },
  { key: 'cooldown', label: 'CD', title: 'Cooldown in seconds', value: row => formatNumber(row.cooldown) },
  { key: 'rpm', label: 'RPM', title: 'Volleys per minute', value: row => formatNumber(row.rpm, 1) },
  { key: 'dps', label: 'DPS', title: 'Damage per second', value: row => formatNumber(row.dps) },
  { key: 'damagePerTon', label: 'Dmg/t', title: "Damage per volley per ton of the weapon itself (ammo not counted)", value: row => formatNumber(row.damagePerTon) },
  { key: 'range', label: 'Range', title: 'Optimal range in meters', value: row => formatNumber(row.range, 0) },
  { key: 'maxRange', label: 'Max', title: 'Maximum range in meters', value: row => formatNumber(row.maxRange, 0) },
  { key: 'speed', label: 'Speed', title: 'Projectile speed in m/s (lasers hit instantly)', value: row => formatNumber(row.speed, 0) },
  { key: 'ammoPerTon', label: 'Ammo/t', title: 'Rounds in one ton of ammo, and the volleys they give', value: row => row.ammoPerTon === null ? '' : `${row.ammoPerTon}` },
  { key: 'dlc', label: 'DLC', value: row => getContentSourceLabel(row.dlc) }
];

function SortButton({ view, sortKey, label, title, onSort }: {
  view: ArsenalView; sortKey: WeaponSortKey; label: string; title?: string; onSort: (key: WeaponSortKey) => void;
}) {
  const active = view.sort.key === sortKey;
  return (
    <button type="button" className={active ? 'is-active' : undefined} title={title} onClick={() => onSort(sortKey)}>
      {label}
      <span aria-hidden="true">{active ? (view.sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  );
}

function WeaponTable({ rows, view, onSort }: { rows: WeaponRow[]; view: ArsenalView; onSort: (key: WeaponSortKey) => void }) {
  const ariaSort = (key: WeaponSortKey) => view.sort.key === key ? (view.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
  return (
    <div className="arsenal-table-wrap">
      <table className="arsenal-table arsenal-weapons">
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort('name')}>
              <SortButton view={view} sortKey="name" label="Weapon" onSort={onSort} />
            </th>
            {COLUMNS.map(column => (
              <th key={column.key} scope="col" aria-sort={ariaSort(column.key)}>
                <SortButton view={view} sortKey={column.key} label={column.label} title={column.title} onSort={onSort} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.item.id} data-type={row.item.weaponType ?? undefined}>
              <th scope="row">
                <span className="arsenal-weapon-name" title={row.item.fullName}>{row.item.name}</span>
                <span className="arsenal-weapon-meta">
                  {row.clan && <span className="arsenal-badge" title="Clan weapons have a single tier">Clan</span>}
                  {row.manufacturer && <span>{row.manufacturer}</span>}
                  {!row.clan && <span>{getTechBaseName(row.item.techBase ?? 'InnerSphere')}</span>}
                </span>
              </th>
              {COLUMNS.map(column => (
                <td key={column.key} className={`is-${column.key}`}>
                  {column.value(row)}
                  {column.key === 'ammoPerTon' && row.volleysPerTon !== null && row.volleysPerTon !== row.ammoPerTon && (
                    <small> ({row.volleysPerTon} volleys)</small>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EquipmentCard({ item }: { item: Item }) {
  const effects = getEquipmentEffects(item);
  return (
    <article className="unit-card arsenal-card">
      <header className="unit-card-header">
        <p className="unit-card-kind">
          <span>{getTechBaseName(item.techBase ?? 'InnerSphere')}</span>
          <span>{getContentSourceLabel(getItemDlc(item))}</span>
        </p>
        <h3 className="arsenal-card-name">{item.name}</h3>
      </header>
      <dl className="unit-card-stats arsenal-card-stats">
        <div><dt>Tons</dt><dd>{formatNumber(item.tonnage)}</dd></div>
        <div><dt>Slots</dt><dd>{item.slots ?? 1}</dd></div>
      </dl>
      {effects.length > 0 && (
        <dl className="arsenal-effects">
          {effects.map(effect => (
            <div key={effect.label}><dt>{effect.label}</dt><dd>{effect.value}</dd></div>
          ))}
        </dl>
      )}
      {item.description && <p className="arsenal-description">{item.description}</p>}
    </article>
  );
}

function AmmoTable({ ammo }: { ammo: Item[] }) {
  const rows = useMemo(() => getAmmoRows(items, ammo), [ammo]);
  return (
    <div className="arsenal-table-wrap">
      <table className="arsenal-table arsenal-ammo">
        <thead>
          <tr>
            <th scope="col">Ammo</th>
            <th scope="col">Type</th>
            <th scope="col">Tons</th>
            <th scope="col">Slots</th>
            <th scope="col">Rounds</th>
            <th scope="col" title="Damage per round left when the ammo explodes">Explosion</th>
            <th scope="col">DLC</th>
            <th scope="col">Used by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, users }) => (
            <tr key={item.id}>
              <th scope="row"><span className="arsenal-weapon-name">{item.name}</span></th>
              <td>{item.weaponType ? getWeaponTypeName(item.weaponType) : ''}</td>
              <td>{formatNumber(item.tonnage)}</td>
              <td>{item.slots ?? 1}</td>
              <td>{item.capacity ?? ''}</td>
              <td>{formatNumber(item.explosionDamagePerRound ?? null)}</td>
              <td>{getContentSourceLabel(getItemDlc(item))}</td>
              <td className="arsenal-users">{users.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommonFilters({ view, update }: { view: ArsenalView; update: (change: Partial<ArsenalView>) => void }) {
  return (
    <>
      <label>
        <span>Tech</span>
        <select value={view.tech} onChange={event => update({ tech: event.target.value as TechFilter })}>
          <option value="all">All</option>
          {TECH_OPTIONS.map(tech => <option key={tech.id} value={tech.id}>{tech.label}</option>)}
        </select>
      </label>
      <label>
        <span>DLC</span>
        <select
          value={String(view.dlc)}
          onChange={event => update({ dlc: (event.target.value === 'all' ? 'all' : Number(event.target.value)) as DlcFilter })}
        >
          <option value="all">All</option>
          {DLC_OPTIONS.map(dlc => <option key={dlc} value={dlc}>{getContentSourceLabel(dlc)}</option>)}
        </select>
      </label>
    </>
  );
}

export function EquipmentApp() {
  const [view, setView] = useState<ArsenalView>(() => parseArsenalQuery(window.location.search));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const allRows = useMemo(() => getWeaponRows(items, view.tier), [view.tier]);
  const rows = useMemo(() => sortWeaponRows(filterWeaponRows(allRows, view), view.sort), [allRows, view]);
  const typeCounts = useMemo(() => Object.fromEntries(ARSENAL_WEAPON_TYPES.map(type => [
    type.id, filterWeaponRows(allRows, { ...view, type: type.id }).length
  ])), [allRows, view]);
  const typeTotal = useMemo(() => filterWeaponRows(allRows, { ...view, type: 'all' }).length, [allRows, view]);

  const { query, tech, dlc } = view;
  const allGroups = useMemo(() => groupEquipment(items, { category: 'all', query, tech, dlc }), [query, tech, dlc]);
  const groups = view.category === 'all' ? allGroups : allGroups.filter(group => group.id === view.category);
  const equipmentTotal = allGroups.reduce((total, group) => total + group.items.length, 0);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toArsenalQuery(view)}`);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (change: Partial<ArsenalView>) => setView(current => ({ ...current, ...change }));
  const sortBy = (key: WeaponSortKey) => setView(current => ({ ...current, sort: toggleWeaponSort(current.sort, key) }));
  const weaponCount = allRows.length;
  const equipmentCount = useMemo(() => groupEquipment(items, { category: 'all', query: '', tech: 'all', dlc: 'all' })
    .reduce((total, group) => total + group.items.length, 0), []);

  return (
    <div className="units arsenal">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <BrandMark />
          <span>MW Builder</span>
        </a>
        <h1>Equipment</h1>
        <SiteNav game="mercs" current="equipment" className="units-links" mode="vanilla" />
        <div className="units-actions">
          <WhatsNew />
          <button type="button" className="units-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
      </header>

      <main className="units-main">
        <section className="units-intro">
          <p>
            Every weapon and piece of equipment in the game with its stats. Weapons change with their tier, from Tier 0 to
            Lost Tech; Clan weapons have a single tier. In Mercenaries weapons take no slots: they only need a hardpoint of
            their type and size. Stats are the weapon's own, without pilot skills, cantina upgrades or quirks.
          </p>
        </section>

        <div className="arsenal-tabs" role="group" aria-label="Section">
          <button type="button" aria-pressed={view.tab === 'weapons'} onClick={() => update({ tab: 'weapons' })}>
            Weapons <small>{weaponCount}</small>
          </button>
          <button type="button" aria-pressed={view.tab === 'equipment'} onClick={() => update({ tab: 'equipment' })}>
            Equipment <small>{equipmentCount}</small>
          </button>
        </div>

        {view.tab === 'weapons' && (
          <>
            <section className="units-controls" aria-label="Filters">
              <div className="units-kinds" role="group" aria-label="Weapon type">
                <button type="button" aria-pressed={view.type === 'all'} onClick={() => update({ type: 'all' })}>
                  All <small>{typeTotal}</small>
                </button>
                {ARSENAL_WEAPON_TYPES.map(type => (
                  <button key={type.id} type="button" aria-pressed={view.type === type.id} onClick={() => update({ type: type.id })}>
                    {type.label} <small>{typeCounts[type.id]}</small>
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
                <label>
                  <span>Tier</span>
                  <select value={view.tier} onChange={event => update({ tier: event.target.value })}>
                    {TIER_OPTIONS.map(tier => <option key={tier.id} value={tier.id}>{tier.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Size</span>
                  <select value={view.size} onChange={event => update({ size: event.target.value as ArsenalView['size'] })}>
                    <option value="all">All</option>
                    {ARSENAL_SIZES.map(size => <option key={size.id} value={size.id}>{size.label}</option>)}
                  </select>
                </label>
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
                    onClick={() => update({ category: group.id as EquipmentCategory })}>
                    {group.label} <small>{group.items.length}</small>
                  </button>
                ))}
              </div>
              <div className="units-search arsenal-filters">
                <input
                  type="search"
                  placeholder="Search by name"
                  aria-label="Search equipment by name"
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
                {group.id === 'ammo'
                  ? <AmmoTable ammo={group.items} />
                  : <div className="units-grid">{group.items.map(item => <EquipmentCard key={item.id} item={item} />)}</div>}
              </section>
            )) : <p className="units-empty">No equipment matches these filters.</p>}
          </>
        )}
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toArsenalQuery(view)}`}
          attachLabel="Attach a link to this list"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
