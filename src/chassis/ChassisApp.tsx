import { useEffect, useMemo, useState, type ReactNode } from 'react';
import mechsJson from '../data/mechs.json';
import type { Mech } from '../types/mech';
import {
  DEFAULT_CHASSIS_VIEW,
  countChassis,
  filterChassisRows,
  getChassisLink,
  getChassisRows,
  parseChassisQuery,
  sortChassisRows,
  toChassisQuery,
  toggleChassisSort,
  type ChassisRow,
  type ChassisSortKey,
  type ChassisView
} from '../utils/chassisList';
import {
  CONTENT_SOURCES,
  GAME_START_YEAR,
  HARDPOINT_ABBREVIATIONS,
  HARDPOINT_FILTER_TYPES,
  getAvailableYear,
  getContentSourceLabel,
  getMechRoles,
  getMechSpecs,
  type HardpointFilterType,
  type MechFilters,
  type WeightClassName
} from '../utils/mechs';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { SupportLink } from '../components/SupportLink';
import { WhatsNew } from '../components/WhatsNew';

const mechs = mechsJson as unknown as Mech[];
const ROWS = getChassisRows(mechs);
const CHASSIS_TOTAL = countChassis(ROWS);
const ROLES = getMechRoles(mechs);
const LAST_YEAR = Math.max(...mechs.map(getAvailableYear));
const YEARS = Array.from({ length: LAST_YEAR - GAME_START_YEAR + 1 }, (_, index) => GAME_START_YEAR + index);
const DLCS = CONTENT_SOURCES.filter(source => mechs.some(mech => (mech.dlc ?? 0) === source));
const TONNAGES = [...new Set(mechs.map(mech => mech.tonnageMax))].sort((a, b) => a - b);
const SPEEDS = [60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160];

const WEIGHT_CLASSES: { id: WeightClassName; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'heavy', label: 'Heavy' },
  { id: 'assault', label: 'Assault' }
];

// Los contadores del selector de 'Mechs; artillería y AMS se piden también en el buscador (1art, 1ams).
const MINIMUM_TYPES: HardpointFilterType[] = ['energy', 'ballistic', 'missile', 'omni'];
const MAX_MINIMUM = 9;

const formatNumber = (value: number | null, decimals = 2) => value === null ? '' : String(Number(value.toFixed(decimals)));

interface Column {
  key: ChassisSortKey;
  label: string;
  title?: string;
  value: (row: ChassisRow) => ReactNode;
}

const Hardpoints = ({ row }: { row: ChassisRow }) => (
  <span className="chassis-hardpoints">
    {HARDPOINT_FILTER_TYPES.filter(type => row.hardpoints[type] > 0).map(type => (
      <span key={type} data-type={type}>{row.hardpoints[type]}{HARDPOINT_ABBREVIATIONS[type]}</span>
    ))}
  </span>
);

const COLUMNS: Column[] = [
  { key: 'tonnage', label: 'Tons', value: row => row.tonnage },
  { key: 'hardpoints', label: 'Hardpoints', title: 'Hardpoints by type; sorts by their total', value: row => <Hardpoints row={row} /> },
  { key: 'engine', label: 'Engine', title: 'Engine rating; XL engines are marked', value: row => row.engineRating === null ? '' : <>{row.engineRating}{row.xl && <small> XL</small>}</> },
  { key: 'speed', label: 'Speed', title: 'Top speed in km/h, as the in-game MechLab shows it', value: row => formatNumber(row.speed, 1) },
  { key: 'armor', label: 'Armor', title: 'Maximum armor points', value: row => row.armor },
  { key: 'structure', label: 'Struct.', title: 'Internal structure points', value: row => row.structure },
  { key: 'jumpJets', label: 'JJ', title: 'Jump jets the chassis can mount', value: row => row.jumpJets || '' },
  { key: 'turnSpeed', label: 'Turn', title: 'Turn speed in °/s', value: row => formatNumber(row.turnSpeed, 1) },
  { key: 'torsoYaw', label: 'Twist', title: 'Torso twist speed in °/s', value: row => formatNumber(row.torsoYaw, 1) },
  { key: 'upgradeSlots', label: 'Upgr.', title: 'Slots for cantina upgrades', value: row => row.upgradeSlots ?? '' },
  { key: 'heatCapacity', label: 'Heat cap.', title: 'Base heat capacity of the empty chassis, before any heat sinks', value: row => formatNumber(row.heatCapacity, 1) },
  { key: 'cooling', label: 'Cooling', title: 'Base cooling per second of the empty chassis, before any heat sinks', value: row => formatNumber(row.cooling) },
  { key: 'year', label: 'Year', title: 'Year it becomes available in the campaign', value: row => row.year },
  { key: 'dlc', label: 'DLC', value: row => getContentSourceLabel(row.dlc) }
];

function SortButton({ view, sortKey, label, title, onSort }: {
  view: ChassisView; sortKey: ChassisSortKey; label: string; title?: string; onSort: (key: ChassisSortKey) => void;
}) {
  const active = view.sort.key === sortKey;
  return (
    <button type="button" className={active ? 'is-active' : undefined} title={title} onClick={() => onSort(sortKey)}>
      {label}
      <span aria-hidden="true">{active ? (view.sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  );
}

function ChassisTable({ rows, view, onSort }: { rows: ChassisRow[]; view: ChassisView; onSort: (key: ChassisSortKey) => void }) {
  const ariaSort = (key: ChassisSortKey) => view.sort.key === key ? (view.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
  return (
    <div className="arsenal-table-wrap">
      <table className="arsenal-table chassis-table">
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort('name')}>
              <SortButton view={view} sortKey="name" label="'Mech" onSort={onSort} />
            </th>
            {COLUMNS.map(column => (
              <th key={column.key} scope="col" aria-sort={ariaSort(column.key)} className={`is-${column.key}`}>
                <SortButton view={view} sortKey={column.key} label={column.label} title={column.title} onSort={onSort} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.mech.id} data-class={row.weightClass}>
              <th scope="row">
                <a className="chassis-link" href={getChassisLink(row.mech)} title="Open its stock build in the MechLab">
                  <span className="arsenal-weapon-name">{row.chassis} <span className="chassis-variant">{row.mech.variant}</span></span>
                </a>
                <span className="arsenal-weapon-meta">
                  {row.mech.hero && <span className="arsenal-badge">Hero</span>}
                  {row.mech.techBase === 'Clan' && <span className="arsenal-badge">Clan</span>}
                  {row.mech.role && <span>{row.mech.role}</span>}
                  {/* Las siglas van juntas, para que en pantallas estrechas se partan como texto y no una por línea. */}
                  <span className="chassis-specs">
                    {getMechSpecs(row.mech).filter(spec => spec.kind !== 'engine').map(spec => (
                      <span key={spec.kind} className={`chassis-spec is-${spec.kind}`}>{spec.label} </span>
                    ))}
                  </span>
                </span>
              </th>
              {COLUMNS.map(column => (
                <td key={column.key} className={`is-${column.key}`}>
                  {column.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const toggleValue = <T,>(values: T[], value: T): T[] =>
  values.includes(value) ? values.filter(current => current !== value) : [...values, value];

const parseOptional = (value: string): number | null => value === '' ? null : Number(value);

export function ChassisApp() {
  const [view, setView] = useState<ChassisView>(() => parseChassisQuery(window.location.search));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => sortChassisRows(filterChassisRows(ROWS, view), view.sort), [view]);
  const classCounts = useMemo(() => Object.fromEntries(WEIGHT_CLASSES.map(({ id }) => [
    id, filterChassisRows(ROWS, { ...view, filters: { ...view.filters, weightClasses: [id] } }).length
  ])), [view]);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toChassisQuery(view)}`);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (change: Partial<ChassisView>) => setView(current => ({ ...current, ...change }));
  const updateFilters = (change: (filters: MechFilters) => Partial<MechFilters>) =>
    setView(current => ({ ...current, filters: { ...current.filters, ...change(current.filters) } }));
  const sortBy = (key: ChassisSortKey) => setView(current => ({ ...current, sort: toggleChassisSort(current.sort, key) }));
  const changeMinimum = (type: HardpointFilterType, step: number) => updateFilters(filters => ({
    minHardpoints: { ...filters.minHardpoints, [type]: Math.min(MAX_MINIMUM, Math.max(0, (filters.minHardpoints[type] ?? 0) + step)) }
  }));
  const isFiltered = toChassisQuery({ ...view, sort: DEFAULT_CHASSIS_VIEW.sort }) !== '';
  const { filters } = view;
  const toggles: { id: 'jumpJets' | 'ecm' | 'hero'; label: string; title: string }[] = [
    { id: 'jumpJets', label: 'Jump jets', title: "Only 'Mechs that can mount jump jets" },
    { id: 'ecm', label: 'ECM', title: "Only 'Mechs with an ECM slot" }
  ];

  return (
    <div className="units arsenal chassis">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Chassis</h1>
        <nav className="units-links" aria-label="MW Builder">
          <a href="/mercs/"><small>MW5 Mercenaries</small> MechLab</a>
          <a href="/mercs/campaigns/">HRQ &amp; Campaigns</a>
          <a href="/mercs/starmap/">Star map</a>
          <a href="/mercs/units/">Enemy units</a>
          <a href="/mercs/pilots/">Pilots</a>
          <a href="/mercs/equipment/">Equipment</a>
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
            Every 'Mech variant you can get in the game, with the stats of its chassis. Heat capacity and cooling are the
            empty chassis' own, before any heat sinks. Sort by any column, filter like in the MechLab's 'Mech picker, and
            click a variant to open its stock build in the MechLab.
          </p>
        </section>

        <section className="units-controls chassis-controls" aria-label="Filters">
          <div className="units-kinds" role="group" aria-label="Weight class">
            {WEIGHT_CLASSES.map(({ id, label }) => (
              <button key={id} type="button" aria-pressed={filters.weightClasses.includes(id)}
                onClick={() => updateFilters(current => ({ weightClasses: toggleValue(current.weightClasses, id) }))}>
                {label} <small>{classCounts[id]}</small>
              </button>
            ))}
            {toggles.map(toggle => (
              <button key={toggle.id} type="button" title={toggle.title} aria-pressed={filters[toggle.id]}
                onClick={() => updateFilters(current => ({ [toggle.id]: !current[toggle.id] }))}>
                {toggle.label}
              </button>
            ))}
            <button type="button" title="Only 'Mechs with an AMS hardpoint" aria-pressed={(filters.minHardpoints.ams ?? 0) > 0}
              onClick={() => updateFilters(current => ({
                minHardpoints: { ...current.minHardpoints, ams: (current.minHardpoints.ams ?? 0) > 0 ? 0 : 1 }
              }))}>
              AMS
            </button>
            <button type="button" title="Hero variants" aria-pressed={filters.hero}
              onClick={() => updateFilters(current => ({ hero: !current.hero }))}>
              Hero
            </button>
          </div>

          <div className="units-search arsenal-filters">
            <input
              type="search"
              placeholder="Name, variant or 3e 2m jj"
              aria-label="Search 'Mechs by name, variant or ID"
              value={view.query}
              onChange={event => update({ query: event.target.value })}
            />
            <label>
              <span>Tech</span>
              <select value={filters.techBase ?? ''} onChange={event => updateFilters(() => ({ techBase: (event.target.value || null) as MechFilters['techBase'] }))}>
                <option value="">All</option>
                <option value="InnerSphere">Inner Sphere</option>
                <option value="Clan">Clan</option>
              </select>
            </label>
            <label>
              <span>Role</span>
              <select value={filters.roles[0] ?? ''} onChange={event => updateFilters(() => ({ roles: event.target.value ? [event.target.value] : [] }))}>
                <option value="">All</option>
                {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label>
              <span>DLC</span>
              <select value={filters.dlcs.length === 1 ? String(filters.dlcs[0]) : ''}
                onChange={event => updateFilters(() => ({ dlcs: event.target.value === '' ? [] : [Number(event.target.value)] }))}>
                <option value="">All</option>
                {DLCS.map(dlc => <option key={dlc} value={dlc}>{getContentSourceLabel(dlc)}</option>)}
              </select>
            </label>
            <label title="Only 'Mechs available by this year of the campaign">
              <span>Available by</span>
              <select value={filters.maxYear ?? ''} onChange={event => updateFilters(() => ({ maxYear: parseOptional(event.target.value) }))}>
                <option value="">Any year</option>
                {YEARS.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label>
              <span>Tons</span>
              <select aria-label="Minimum tonnage" value={view.minTons ?? ''} onChange={event => update({ minTons: parseOptional(event.target.value) })}>
                <option value="">Min</option>
                {TONNAGES.map(tons => <option key={tons} value={tons}>{tons}</option>)}
              </select>
              <select aria-label="Maximum tonnage" value={view.maxTons ?? ''} onChange={event => update({ maxTons: parseOptional(event.target.value) })}>
                <option value="">Max</option>
                {TONNAGES.map(tons => <option key={tons} value={tons}>{tons}</option>)}
              </select>
            </label>
            <label>
              <span>Speed</span>
              <select aria-label="Minimum speed" value={view.minSpeed ?? ''} onChange={event => update({ minSpeed: parseOptional(event.target.value) })}>
                <option value="">Any</option>
                {SPEEDS.map(speed => <option key={speed} value={speed}>{speed}+ km/h</option>)}
              </select>
            </label>
          </div>

          <div className="chassis-minimums" role="group" aria-label="Minimum hardpoints">
            <span title="Omni hardpoints count as energy, ballistic or missile">Min hardpoints</span>
            {MINIMUM_TYPES.map(type => {
              const value = filters.minHardpoints[type] ?? 0;
              return (
                <span key={type} className={value > 0 ? 'chassis-stepper is-active' : 'chassis-stepper'} data-type={type}>
                  <button type="button" aria-label={`Fewer ${type} hardpoints`} disabled={value === 0} onClick={() => changeMinimum(type, -1)}>−</button>
                  <span><b>{value}</b>{HARDPOINT_ABBREVIATIONS[type].trim()}</span>
                  <button type="button" aria-label={`More ${type} hardpoints`} disabled={value === MAX_MINIMUM} onClick={() => changeMinimum(type, 1)}>+</button>
                </span>
              );
            })}
          </div>
        </section>

        <p className="chassis-count" role="status">
          {rows.length === ROWS.length
            ? `${ROWS.length} variants · ${CHASSIS_TOTAL} chassis`
            : `${rows.length} of ${ROWS.length} variants · ${countChassis(rows)} chassis`}
          {isFiltered && (
            <button type="button" onClick={() => update({ ...DEFAULT_CHASSIS_VIEW, sort: view.sort })}>Clear filters</button>
          )}
        </p>

        {rows.length > 0
          ? <ChassisTable rows={rows} view={view} onSort={sortBy} />
          : <p className="units-empty">No 'Mechs match these filters.</p>}
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toChassisQuery(view)}`}
          attachLabel="Attach a link to this list"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
