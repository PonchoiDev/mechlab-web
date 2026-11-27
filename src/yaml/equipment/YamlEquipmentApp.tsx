import { useEffect, useMemo, useState } from 'react';
import { BrandMark } from '../../components/BrandMark';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { SiteNav } from '../../components/SiteNav';
import { SupportLink } from '../../components/SupportLink';
import { WhatsNew } from '../../components/WhatsNew';
import type { YamlItem } from '../../types/yaml-mechlab';
import {
  YAML_ARSENAL_WEAPON_TYPES,
  YAML_SOURCES,
  YAML_TIER_OPTIONS,
  filterYamlWeaponRows,
  getYamlAmmoRows,
  getYamlEquipmentEffects,
  getYamlSource,
  getYamlSourceLabel,
  getYamlTechName,
  getYamlWeaponRows,
  groupYamlEquipment,
  parseYamlArsenalQuery,
  sortYamlWeaponRows,
  toYamlArsenalQuery,
  toggleYamlWeaponSort,
  yamlTierName,
  type YamlArsenalView,
  type YamlEquipmentCategory,
  type YamlTechFilter,
  type YamlWeaponRow,
  type YamlWeaponSortKey
} from '../../utils/yaml/arsenal';

const BASE = import.meta.env.BASE_URL;
// El logo de cada origen: el icono de MW5 para el juego base y el de cada mod.
const sourceIcon = (source: string) => source === 'base' ? `${BASE}mechlab/mw5-icon.png` : `${BASE}mechlab/yaml/mods/${source}-color.png`;

// Hasta dos decimales, sin ceros de más (2.25, 1.3, 15).
const formatNumber = (value: number | null, decimals = 2) => value === null ? '' : String(Number(value.toFixed(decimals)));

const TYPE_LABELS = Object.fromEntries(YAML_ARSENAL_WEAPON_TYPES.map(type => [type.id, type.label]));

interface Column {
  key: YamlWeaponSortKey;
  label: string;
  title?: string;
  value: (row: YamlWeaponRow) => string;
}

const COLUMNS: Column[] = [
  { key: 'hardpoint', label: 'Hardpoint', value: row => TYPE_LABELS[row.item.hardpoint ?? 'energy'] ?? '' },
  { key: 'slots', label: 'Slots', title: 'Critical slots the weapon takes', value: row => String(row.slots) },
  { key: 'tons', label: 'Tons', value: row => formatNumber(row.tons) },
  { key: 'damage', label: 'Dmg', title: 'Damage per volley (per second for machine guns and flamers)', value: row => formatNumber(row.damage) },
  { key: 'heat', label: 'Heat', title: 'Heat per volley (per second for machine guns and flamers)', value: row => formatNumber(row.heat) },
  { key: 'cooldown', label: 'CD', title: 'Cooldown in seconds', value: row => formatNumber(row.cooldown) },
  { key: 'rpm', label: 'RPM', title: 'Volleys per minute, counting beam duration and volley time', value: row => formatNumber(row.rpm, 1) },
  { key: 'dps', label: 'DPS', title: 'Damage per second', value: row => formatNumber(row.dps) },
  { key: 'damagePerTon', label: 'Dmg/t', title: 'Damage per volley per ton of the weapon itself (ammo not counted)', value: row => formatNumber(row.damagePerTon) },
  { key: 'range', label: 'Range', title: 'Optimal range in meters', value: row => formatNumber(row.range, 0) },
  { key: 'maxRange', label: 'Max', title: 'Maximum range in meters', value: row => formatNumber(row.maxRange, 0) },
  { key: 'speed', label: 'Speed', title: 'Projectile speed in m/s (lasers hit instantly)', value: row => formatNumber(row.speed, 0) },
  { key: 'ammoPerTon', label: 'Ammo/t', title: 'Rounds in one ton of ammo, and the volleys they give', value: row => row.ammoPerTon === null ? '' : formatNumber(row.ammoPerTon, 0) }
];

function SourceBadge({ source }: { source: string }) {
  const label = getYamlSourceLabel(source);
  return <img className="yaml-arsenal-source" src={sourceIcon(source)} alt={label} title={label} />;
}

function SortButton({ view, sortKey, label, title, onSort }: {
  view: YamlArsenalView; sortKey: YamlWeaponSortKey; label: string; title?: string; onSort: (key: YamlWeaponSortKey) => void;
}) {
  const active = view.sort.key === sortKey;
  return (
    <button type="button" className={active ? 'is-active' : undefined} title={title} onClick={() => onSort(sortKey)}>
      {label}
      <span aria-hidden="true">{active ? (view.sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  );
}

function WeaponTable({ rows, view, onSort }: { rows: YamlWeaponRow[]; view: YamlArsenalView; onSort: (key: YamlWeaponSortKey) => void }) {
  const ariaSort = (key: YamlWeaponSortKey) => view.sort.key === key ? (view.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
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
            <th scope="col" aria-sort={ariaSort('source')}>
              <SortButton view={view} sortKey="source" label="Source" title="Base game or the mod that adds or changes it" onSort={onSort} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} data-type={row.item.hardpoint}>
              <th scope="row">
                <span className="arsenal-weapon-name">{row.name}</span>
                <span className="arsenal-weapon-meta">
                  {row.clan ? <span className="arsenal-badge">Clan</span> : <span>{row.techName}</span>}
                  {row.tierMissing && <span title="This weapon does not have the chosen tier">{yamlTierName(row.tier)} only</span>}
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
              <td className="is-source"><SourceBadge source={row.source} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EquipmentCard({ item }: { item: YamlItem }) {
  const effects = getYamlEquipmentEffects(item);
  const source = getYamlSource(item);
  return (
    <article className="unit-card arsenal-card">
      <header className="unit-card-header">
        <p className="unit-card-kind">
          <span>{getYamlTechName(item)}</span>
          <span className="yaml-arsenal-card-source"><SourceBadge source={source} />{getYamlSourceLabel(source)}</span>
        </p>
        <h3 className="arsenal-card-name">{item.name}</h3>
      </header>
      <dl className="unit-card-stats arsenal-card-stats">
        <div><dt>Tons</dt><dd>{formatNumber(item.tons)}</dd></div>
        <div><dt>Slots</dt><dd>{item.slots}</dd></div>
      </dl>
      {effects.length > 0 && (
        <dl className="arsenal-effects">
          {effects.map((effect, index) => (
            <div key={`${effect.label}-${index}`}><dt>{effect.label}</dt><dd>{effect.value}</dd></div>
          ))}
        </dl>
      )}
    </article>
  );
}

function AmmoTable({ ammo }: { ammo: { id: string; item: YamlItem }[] }) {
  const rows = useMemo(() => getYamlAmmoRows(ammo), [ammo]);
  return (
    <div className="arsenal-table-wrap">
      <table className="arsenal-table arsenal-ammo">
        <thead>
          <tr>
            <th scope="col">Ammo</th>
            <th scope="col">Tons</th>
            <th scope="col">Slots</th>
            <th scope="col">Rounds</th>
            <th scope="col" title="Rounds per ton of ammo">Per ton</th>
            <th scope="col">Source</th>
            <th scope="col">Used by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, item, perTon, users }) => (
            <tr key={id}>
              <th scope="row"><span className="arsenal-weapon-name">{item.name}</span></th>
              <td>{formatNumber(item.tons)}</td>
              <td>{item.slots}</td>
              <td>{formatNumber(item.capacity ?? null, 0)}</td>
              <td>{formatNumber(perTon, 0)}</td>
              <td className="is-source"><SourceBadge source={getYamlSource(item)} /></td>
              <td className="arsenal-users">{users.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommonFilters({ view, update }: { view: YamlArsenalView; update: (change: Partial<YamlArsenalView>) => void }) {
  return (
    <>
      <label>
        <span>Tech</span>
        <select value={view.tech} onChange={event => update({ tech: event.target.value as YamlTechFilter })}>
          <option value="all">All</option>
          <option value="innerSphere">Inner Sphere</option>
          <option value="clan">Clan</option>
        </select>
      </label>
      <label>
        <span>Source</span>
        <select value={view.source} onChange={event => update({ source: event.target.value })}>
          <option value="all">All</option>
          {YAML_SOURCES.map(source => <option key={source.id} value={source.id}>{source.label}</option>)}
        </select>
      </label>
    </>
  );
}

// La página de armas y equipo de YAML (docs/specs/pagina-equipo-yaml.md), con la composición de la de MW5.
export function YamlEquipmentApp() {
  const [view, setView] = useState<YamlArsenalView>(() => parseYamlArsenalQuery(window.location.search));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const allRows = useMemo(() => getYamlWeaponRows(view.tier), [view.tier]);
  const rows = useMemo(() => sortYamlWeaponRows(filterYamlWeaponRows(allRows, view), view.sort), [allRows, view]);
  const typeCounts = useMemo(() => Object.fromEntries(YAML_ARSENAL_WEAPON_TYPES.map(type => [
    type.id, filterYamlWeaponRows(allRows, { ...view, type: type.id }).length
  ])), [allRows, view]);
  const typeTotal = useMemo(() => filterYamlWeaponRows(allRows, { ...view, type: 'all' }).length, [allRows, view]);

  const { query, tech, source } = view;
  const allGroups = useMemo(() => groupYamlEquipment({ category: 'all', query, tech, source }), [query, tech, source]);
  const groups = view.category === 'all' ? allGroups : allGroups.filter(group => group.id === view.category);
  const equipmentTotal = allGroups.reduce((total, group) => total + group.items.length, 0);
  const weaponCount = allRows.length;
  const equipmentCount = useMemo(() => groupYamlEquipment({ category: 'all', query: '', tech: 'all', source: 'all' })
    .reduce((total, group) => total + group.items.length, 0), []);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toYamlArsenalQuery(view)}`);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (change: Partial<YamlArsenalView>) => setView(current => ({ ...current, ...change }));
  const sortBy = (key: YamlWeaponSortKey) => setView(current => ({ ...current, sort: toggleYamlWeaponSort(current.sort, key) }));

  return (
    <div className="units arsenal yaml-arsenal">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <BrandMark />
          <span>MW Builder</span>
        </a>
        <h1>YAML Equipment</h1>
        <SiteNav game="mercs" current="equipment" className="units-links" mode="yaml" />
        <div className="units-actions">
          <WhatsNew />
          <button type="button" className="units-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
      </header>

      <main className="units-main">
        <section className="units-intro">
          <p>
            Every weapon and piece of equipment with the rules of the <strong>Yet Another Mechlab</strong> mods: weapons take
            critical slots, and engines, gyros, cockpits, structure and armor are equipment too. Stats are the weapon's own,
            as the <a href={`${BASE}yaml/`}>YAML MechLab</a> counts them without quirks, equipment bonuses or cantina upgrades.
            For the game without mods, see the <a href={`${BASE}equipment/`}>MW5 equipment page</a>.
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
                {YAML_ARSENAL_WEAPON_TYPES.map(type => (
                  <button key={type.id} type="button" aria-pressed={view.type === type.id} onClick={() => update({ type: type.id })}>
                    {type.label} <small>{typeCounts[type.id]}</small>
                  </button>
                ))}
              </div>
              <div className="units-search arsenal-filters">
                <input
                  type="search"
                  placeholder="Weapon name"
                  aria-label="Search weapons by name"
                  value={view.query}
                  onChange={event => update({ query: event.target.value })}
                />
                <label>
                  <span>Tier</span>
                  <select value={view.tier} onChange={event => update({ tier: event.target.value })}>
                    {YAML_TIER_OPTIONS.map(tier => <option key={tier.id} value={tier.id}>{tier.label}</option>)}
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
                    onClick={() => update({ category: group.id as YamlEquipmentCategory })}>
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
                  : <div className="units-grid">{group.items.map(entry => <EquipmentCard key={entry.id} item={entry.item} />)}</div>}
              </section>
            )) : <p className="units-empty">No equipment matches these filters.</p>}
          </>
        )}
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toYamlArsenalQuery(view)}`}
          attachLabel="Attach a link to this list"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
