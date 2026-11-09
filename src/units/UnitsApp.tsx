import { useEffect, useMemo, useState } from 'react';
import unitsJson from '../data/units.json';
import type { Unit, UnitsData } from '../types/units';
import {
  RARITY_LABELS,
  UNIT_KIND_LABELS,
  UNIT_KINDS,
  UNIT_SORTS,
  filterUnits,
  getUnitFirepower,
  getUnitWeapons,
  groupRarity,
  parseUnitsQuery,
  sortUnits,
  toUnitsQuery,
  type UnitSort,
  type UnitsView
} from '../utils/units';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { SupportLink } from '../components/SupportLink';
import { WhatsNew } from '../components/WhatsNew';
import { RARITY_COLORS } from '../starmap/rarityColors';

const data = unitsJson as unknown as UnitsData;

const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

// El dibujo de línea de Sarna, invertido y teñido como en la portada. Si no carga, se quita.
function UnitArt({ image }: { image: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="unit-card-art" aria-hidden="true">
      <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </div>
  );
}

function UnitCard({ unit }: { unit: Unit }) {
  const weapons = getUnitWeapons(data, unit);
  const firepower = getUnitFirepower(data, unit);
  const rarity = groupRarity(data, unit);
  const factionCount = rarity.reduce((total, group) => total + group.factions.length, 0);

  return (
    <article className="unit-card" data-kind={unit.kind}>
      <header className="unit-card-header">
        {unit.sarna?.image && <UnitArt image={unit.sarna.image} />}
        <p className="unit-card-kind">
          <span>{UNIT_KIND_LABELS[unit.kind]}</span>
          {unit.role && <span>{unit.role}</span>}
        </p>
        <h2>{unit.name}</h2>
        <p className="unit-card-meta">
          <span>Tier {unit.tier}</span>
          <span>BV {unit.battleValue}</span>
          <span>Since {unit.introYear}</span>
          {unit.sarna && (
            <a href={unit.sarna.page} target="_blank" rel="noreferrer" title={`${unit.name} on Sarna.net`}>Sarna ↗</a>
          )}
        </p>
      </header>

      <dl className="unit-card-stats">
        <div>
          <dt title="The game scales hit points with contract difficulty">{unit.squad ? 'Base HP / suit' : 'Base HP'}</dt>
          <dd>{unit.hitPoints === null ? '?' : formatNumber(unit.hitPoints)}</dd>
        </div>
        {unit.squad
          ? <div><dt>Squad</dt><dd>{unit.squad} suits</dd></div>
          : <div><dt>Speed</dt><dd>{unit.speed === null ? '?' : <>{formatNumber(unit.speed)} <small>km/h</small></>}</dd></div>}
        <div>
          <dt>{unit.squad ? 'Alpha / suit' : 'Alpha'}</dt>
          <dd>{formatNumber(firepower.damage)}</dd>
        </div>
        <div>
          <dt>{unit.squad ? 'DPS / suit' : 'DPS'}</dt>
          <dd>{formatNumber(firepower.dps)}</dd>
        </div>
      </dl>

      <table className="unit-weapons">
        <thead>
          <tr>
            <th scope="col">Weapon</th>
            <th scope="col">Dmg</th>
            <th scope="col">DPS</th>
            <th scope="col">Range</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map(weapon => (
            <tr key={weapon.id}>
              <th scope="row"><span className="unit-weapon-count">{weapon.count}×</span> {weapon.name}</th>
              <td>{formatNumber(weapon.damage)}</td>
              <td>{formatNumber(weapon.dps)}</td>
              <td>{weapon.range ? `${Math.round(weapon.range)} m` : '?'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rarity.length > 0 && (
        <details className="unit-rarity">
          <summary>Fielded by {factionCount} {factionCount === 1 ? 'faction' : 'factions'}</summary>
          <dl>
            {rarity.map(group => (
              <div key={group.rarity}>
                <dt><i style={{ background: RARITY_COLORS[group.rarity] }} aria-hidden="true" />{RARITY_LABELS[group.rarity]}</dt>
                <dd>{group.factions.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </article>
  );
}

export function UnitsApp() {
  const [view, setView] = useState<UnitsView>(() => parseUnitsQuery(window.location.search));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const units = useMemo(() => sortUnits(data, filterUnits(data.units, view), view.sort), [view]);
  const counts = useMemo(() => Object.fromEntries(UNIT_KINDS.map(kind => [kind.id, filterUnits(data.units, { kind: kind.id, query: view.query }).length])), [view.query]);
  const total = useMemo(() => filterUnits(data.units, { kind: 'all', query: view.query }).length, [view.query]);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toUnitsQuery(view)}`);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (change: Partial<UnitsView>) => setView(current => ({ ...current, ...change }));

  return (
    <div className="units">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Enemy units</h1>
        <nav className="units-links" aria-label="MW Builder">
          <a href="/mercs/"><small>MW5 Mercenaries</small> MechLab</a>
          <a href="/mercs/starmap/">Star map</a>
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
            Tanks, hovercraft, VTOLs, turrets and battle armor you face in contracts, with the weapons they carry.
            Hit points are the game's base values: contracts scale them up with difficulty.
          </p>
        </section>

        <section className="units-controls" aria-label="Filters">
          <div className="units-kinds" role="group" aria-label="Unit type">
            <button type="button" aria-pressed={view.kind === 'all'} onClick={() => update({ kind: 'all' })}>
              All <small>{total}</small>
            </button>
            {UNIT_KINDS.map(kind => (
              <button key={kind.id} type="button" aria-pressed={view.kind === kind.id} onClick={() => update({ kind: kind.id })}>
                {kind.label} <small>{counts[kind.id]}</small>
              </button>
            ))}
          </div>
          <div className="units-search">
            <input
              type="search"
              placeholder="Search by name"
              aria-label="Search by name"
              value={view.query}
              onChange={event => update({ query: event.target.value })}
            />
            <label>
              <span>Sort</span>
              <select value={view.sort} onChange={event => update({ sort: event.target.value as UnitSort })}>
                {UNIT_SORTS.map(sort => <option key={sort.id} value={sort.id}>{sort.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        {units.length > 0
          ? <div className="units-grid">{units.map(unit => <UnitCard key={unit.id} unit={unit} />)}</div>
          : <p className="units-empty">No units match this search.</p>}
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toUnitsQuery(view)}`}
          attachLabel="Attach a link to this list"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
