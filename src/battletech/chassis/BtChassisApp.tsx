import { useEffect, useMemo, useState } from 'react';
import { getBuildsPageUrl } from '../../utils/publishedBuilds';
import type { BtHardpoint, BtSource, BtWeightClass } from '../../types/battletech-mechlab';
import {
  DEFAULT_BT_CHASSIS_VIEW,
  countBtChassis,
  filterBtChassisRows,
  getBtChassisLink,
  getBtChassisRows,
  parseBtChassisQuery,
  sortBtChassisRows,
  toBtChassisQuery,
  type BtChassisRow,
  type BtChassisSortKey,
  type BtChassisView
} from '../../utils/battletech/chassisList';
import { type BtMechFilters } from '../../utils/battletech/filters';
import {
  BT_MECHS,
  HARDPOINT_LABELS,
  HARDPOINT_SHORT,
  HARDPOINTS,
  MECH_TAGS,
  SOURCE_LABELS,
  SOURCES,
  WEIGHT_CLASS_LABELS,
  WEIGHT_CLASSES
} from '../../utils/battletech/mechlabData';
import { toggleColumnSort } from '../../utils/tableSort';
import { ChassisTable, MinimumStepper, type ChassisColumn } from '../../components/ChassisTable';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { SupportLink } from '../../components/SupportLink';
import { WhatsNew } from '../../components/WhatsNew';
import { BrandMark } from '../../components/BrandMark';

const ROWS = getBtChassisRows(BT_MECHS);
const CHASSIS_TOTAL = countBtChassis(ROWS);
const TONNAGES = [...new Set(BT_MECHS.map(mech => mech.tonnage))].sort((a, b) => a - b);
const SPRINTS = [150, 175, 200, 225, 250, 275, 300, 325, 350];
const MAX_MINIMUM = 9;
const MAX_JUMP_JETS = Math.max(...BT_MECHS.map(mech => mech.maxJumpJets));

const formatNumber = (value: number | null) => value === null ? '' : String(Number(value.toFixed(2)));

const Hardpoints = ({ row }: { row: BtChassisRow }) => (
  <span className="chassis-hardpoints">
    {HARDPOINTS.filter(type => row.hardpoints[type] > 0).map(type => (
      <span key={type} data-type={type}>{row.hardpoints[type]}{HARDPOINT_SHORT[type]}</span>
    ))}
  </span>
);

const COLUMNS: ChassisColumn<BtChassisRow, BtChassisSortKey>[] = [
  { key: 'tonnage', label: 'Tons', value: row => row.tonnage },
  { key: 'hardpoints', label: 'Hardpoints', title: 'Hardpoints by type; sorts by their total', value: row => <Hardpoints row={row} /> },
  { key: 'freeTonnage', label: 'Free t', title: 'Tons left on the empty chassis for weapons, equipment and armor', value: row => formatNumber(row.freeTonnage) },
  { key: 'armor', label: 'Armor', title: 'Maximum armor points', value: row => row.armor },
  { key: 'structure', label: 'Struct.', title: 'Internal structure points', value: row => row.structure },
  { key: 'walk', label: 'Walk', title: 'Walking distance in meters per turn', value: row => formatNumber(row.walk) },
  { key: 'sprint', label: 'Sprint', title: 'Sprinting distance in meters per turn', value: row => formatNumber(row.sprint) },
  { key: 'jumpJets', label: 'JJ', title: 'Jump jets the chassis can mount', value: row => row.jumpJets },
  { key: 'stability', label: 'Stab.', title: 'Stability', value: row => row.stability },
  { key: 'melee', label: 'Melee', title: 'Melee damage', value: row => row.melee },
  { key: 'dfa', label: 'DFA', title: 'Death from above damage', value: row => row.dfa },
  { key: 'source', label: 'Source', value: row => SOURCE_LABELS[row.mech.source] }
];

const toggleValue = <T,>(values: T[], value: T): T[] =>
  values.includes(value) ? values.filter(current => current !== value) : [...values, value];

const parseOptional = (value: string): number | null => value === '' ? null : Number(value);

export function BtChassisApp() {
  const [view, setView] = useState<BtChassisView>(() => parseBtChassisQuery(window.location.search));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => sortBtChassisRows(filterBtChassisRows(ROWS, view), view.sort), [view]);
  const classCounts = useMemo(() => Object.fromEntries(WEIGHT_CLASSES.map(id => [
    id, filterBtChassisRows(ROWS, { ...view, filters: { ...view.filters, weightClasses: [id] } }).length
  ])), [view]);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toBtChassisQuery(view)}`);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (change: Partial<BtChassisView>) => setView(current => ({ ...current, ...change }));
  const updateFilters = (change: (filters: BtMechFilters) => Partial<BtMechFilters>) =>
    setView(current => ({ ...current, filters: { ...current.filters, ...change(current.filters) } }));
  const sortBy = (key: BtChassisSortKey) => setView(current => ({ ...current, sort: toggleColumnSort(current.sort, key) }));
  const isFiltered = toBtChassisQuery({ ...view, sort: DEFAULT_BT_CHASSIS_VIEW.sort }) !== '';
  const { filters } = view;

  return (
    <div className="units arsenal chassis">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <BrandMark />
          <span>MW Builder</span>
        </a>
        <h1>Chassis</h1>
        <nav className="units-links" aria-label="BATTLETECH">
          <a href="/battletech/"><small>BATTLETECH</small> MechLab</a>
          <a href="/battletech/builds/">Builds</a>
          <a href="/battletech/flashpoints/">Flashpoints</a>
          <a href="/battletech/starmap/">Star map</a>
          <a href="/battletech/units/">Enemy units</a>
          <a href="/battletech/argo/">Argo</a>
          <a href="/battletech/equipment/">Equipment</a>
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
            Every 'Mech variant in BATTLETECH and its DLC, with the stats of its empty chassis: no equipment and no armor,
            only what is fixed to it. Sort by any column, filter like in the MechLab's 'Mech picker, and click a variant to
            open its stock build in the MechLab.
          </p>
        </section>

        <section className="units-controls chassis-controls" aria-label="Filters">
          <div className="units-kinds" role="group" aria-label="Weight class">
            {WEIGHT_CLASSES.map((id: BtWeightClass) => (
              <button key={id} type="button" aria-pressed={filters.weightClasses.includes(id)}
                onClick={() => updateFilters(current => ({ weightClasses: toggleValue(current.weightClasses, id) }))}>
                {WEIGHT_CLASS_LABELS[id]} <small>{classCounts[id]}</small>
              </button>
            ))}
          </div>

          <div className="units-search arsenal-filters">
            <input
              type="search"
              placeholder="Name, variant or 3e 2m jj"
              aria-label="Search 'Mechs by name, variant or role"
              value={filters.query}
              onChange={event => updateFilters(() => ({ query: event.target.value }))}
            />
            <label title="Role tags the game gives each variant">
              <span>Role</span>
              <select value={filters.tags[0] ?? ''} onChange={event => updateFilters(() => ({ tags: event.target.value ? [event.target.value] : [] }))}>
                <option value="">All</option>
                {MECH_TAGS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>
            <label>
              <span>Source</span>
              <select value={filters.sources.length === 1 ? filters.sources[0] : ''}
                onChange={event => updateFilters(() => ({ sources: event.target.value ? [event.target.value as BtSource] : [] }))}>
                <option value="">All</option>
                {SOURCES.map(source => <option key={source} value={source}>{SOURCE_LABELS[source]}</option>)}
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
              <span>Sprint</span>
              <select aria-label="Minimum sprint distance" value={view.minSprint ?? ''} onChange={event => update({ minSprint: parseOptional(event.target.value) })}>
                <option value="">Any</option>
                {SPRINTS.map(sprint => <option key={sprint} value={sprint}>{sprint}+ m</option>)}
              </select>
            </label>
          </div>

          <div className="chassis-minimums" role="group" aria-label="Minimum hardpoints and jump jets">
            <span>Min hardpoints</span>
            {HARDPOINTS.map((type: BtHardpoint) => (
              <MinimumStepper
                key={type}
                type={type}
                label={`${HARDPOINT_LABELS[type]} hardpoints`}
                short={HARDPOINT_SHORT[type]}
                value={filters.minHardpoints[type]}
                max={MAX_MINIMUM}
                onChange={value => updateFilters(current => ({ minHardpoints: { ...current.minHardpoints, [type]: value } }))}
              />
            ))}
            <MinimumStepper
              type="jumpJets"
              label="jump jets"
              short="JJ"
              value={filters.minJumpJets}
              max={MAX_JUMP_JETS}
              onChange={value => updateFilters(() => ({ minJumpJets: value }))}
            />
          </div>
        </section>

        <p className="chassis-count" role="status">
          {rows.length === ROWS.length
            ? `${ROWS.length} variants · ${CHASSIS_TOTAL} chassis`
            : `${rows.length} of ${ROWS.length} variants · ${countBtChassis(rows)} chassis`}
          {isFiltered && (
            <button type="button" onClick={() => update({ ...DEFAULT_BT_CHASSIS_VIEW, sort: view.sort })}>Clear filters</button>
          )}
        </p>

        {rows.length > 0
          ? (
            <ChassisTable
              rows={rows}
              columns={COLUMNS}
              sort={view.sort}
              onSort={sortBy}
              rowKey={row => row.mech.id}
              link={row => getBtChassisLink(row.mech)}
              buildsLink={row => getBuildsPageUrl('battletech', { mech: row.mech.id })}
              name={row => ({
                chassis: row.chassis,
                variant: row.mech.variant,
                meta: (
                  <>
                    <span>{row.mech.role}</span>
                    {row.fixed.length > 0 && (
                      <span className="chassis-specs">
                        {row.fixed.map(tag => <span key={tag.label} className="chassis-fixed" title={`Fixed: ${tag.title}`}>{tag.label} </span>)}
                      </span>
                    )}
                  </>
                )
              })}
            />
          )
          : <p className="units-empty">No 'Mechs match these filters.</p>}
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toBtChassisQuery(view)}`}
          attachLabel="Attach a link to this list"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
