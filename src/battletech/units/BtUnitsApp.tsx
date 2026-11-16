import { useEffect, useMemo, useState } from 'react';
import itemsJson from '../../data/battletech/items.json';
import unitsJson from '../../data/battletech/units.json';
import type { BtItem } from '../../types/battletech-mechlab';
import type { BtUnit } from '../../types/battletech-units';
import { SOURCE_LABELS } from '../../utils/battletech/catalog';
import {
  BT_LOCATION_LABELS,
  BT_UNIT_KIND_LABELS,
  BT_UNIT_KINDS,
  BT_UNIT_SORTS,
  filterBtUnits,
  getBtUnitArmor,
  getBtUnitEquipment,
  getBtUnitFirepower,
  getBtUnitWeapons,
  parseBtUnitsQuery,
  sortBtUnits,
  toBtCatalog,
  toBtUnitsQuery,
  type BtUnitSort,
  type BtUnitsView
} from '../../utils/battletech/units';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { SupportLink } from '../../components/SupportLink';
import { WhatsNew } from '../../components/WhatsNew';

const units = (unitsJson as unknown as { units: BtUnit[] }).units;
const catalog = toBtCatalog(itemsJson as unknown as BtItem[]);

const WEIGHT_LABELS = { light: 'Light', medium: 'Medium', heavy: 'Heavy', assault: 'Assault' } as const;

const formatRange = (min: number, max: number) => min > 0 ? `${min} to ${max} m` : `${max} m`;

// El dibujo de línea de Sarna, invertido y teñido como en la página de MW5. Si no carga, se quita.
function UnitArt({ image }: { image: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="unit-card-art" aria-hidden="true">
      <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </div>
  );
}

function UnitCard({ unit }: { unit: BtUnit }) {
  const weapons = getBtUnitWeapons(catalog, unit);
  const firepower = getBtUnitFirepower(catalog, unit);
  const armor = getBtUnitArmor(unit);
  const equipment = getBtUnitEquipment(catalog, unit);

  return (
    <article className="unit-card" data-kind={unit.kind}>
      <header className="unit-card-header">
        {unit.sarna?.image && <UnitArt image={unit.sarna.image} />}
        <p className="unit-card-kind">
          <span>{BT_UNIT_KIND_LABELS[unit.kind]}</span>
          <span>{WEIGHT_LABELS[unit.weightClass]}</span>
          {unit.noncombatant && <span className="bt-unit-noncombatant" title="Escort or hunt target: it does not seek combat">Non-combatant</span>}
        </p>
        <h2>{unit.name}</h2>
        <p className="unit-card-meta">
          {unit.tonnage !== null && <span>{unit.tonnage} tons</span>}
          <span>{SOURCE_LABELS[unit.source]}</span>
          {unit.sarna && (
            <a href={unit.sarna.page} target="_blank" rel="noreferrer" title={`${unit.name} on Sarna.net`}>Sarna ↗</a>
          )}
        </p>
      </header>

      <dl className="unit-card-stats">
        <div>
          <dt>Armor</dt>
          <dd>{armor.armor}</dd>
        </div>
        <div>
          <dt title="Internal structure">Structure</dt>
          <dd>{armor.structure}</dd>
        </div>
        <div>
          <dt title="All weapons firing in one turn">Damage</dt>
          <dd>{firepower.damage}</dd>
        </div>
        <div>
          <dt title="Walk and sprint distance per turn">Move</dt>
          <dd>{unit.walk === null ? <small>Static</small> : <>{unit.walk}<small> / {unit.sprint} m</small></>}</dd>
        </div>
      </dl>

      {/* Las torretas tienen una sola ubicación, que ya dicen el blindaje y la estructura de arriba. */}
      {unit.kind !== 'turret' && (
      <dl className="bt-unit-locations">
        {unit.locations.map(location => (
          <div key={location.location}>
            <dt>{BT_LOCATION_LABELS[location.location]}</dt>
            <dd>{location.armor}<small> / {location.structure}</small></dd>
          </div>
        ))}
      </dl>
      )}

      {weapons.length > 0
        ? (
          <table className="unit-weapons">
            <thead>
              <tr>
                <th scope="col">Weapon</th>
                <th scope="col" title="Damage of one attack">Dmg</th>
                <th scope="col" title="Stability damage">Stab</th>
                <th scope="col">Range</th>
              </tr>
            </thead>
            <tbody>
              {weapons.map(weapon => (
                <tr key={weapon.item.id}>
                  <th scope="row"><span className="unit-weapon-count">{weapon.count}×</span> {weapon.item.name}</th>
                  <td>{weapon.damage}{weapon.heatDamage > 0 && <small className="bt-unit-heat"> +{weapon.heatDamage} heat</small>}</td>
                  <td>{weapon.instability || ''}</td>
                  <td>{formatRange(weapon.minRange, weapon.maxRange)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>{firepower.damage}{firepower.heatDamage > 0 && <small className="bt-unit-heat"> +{firepower.heatDamage} heat</small>}</td>
                <td>{firepower.instability || ''}</td>
                <td>{firepower.maxRange} m</td>
              </tr>
            </tfoot>
          </table>
        )
        : <p className="bt-unit-empty">No weapons.</p>}

      {equipment.length > 0 && (
        <p className="bt-unit-equipment">
          <span>Equipment</span> {equipment.map(line => `${line.count > 1 ? `${line.count}× ` : ''}${line.item.name}`).join(', ')}
        </p>
      )}
    </article>
  );
}

export function BtUnitsApp() {
  const [view, setView] = useState<BtUnitsView>(() => parseBtUnitsQuery(window.location.search));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const shown = useMemo(() => sortBtUnits(catalog, filterBtUnits(units, view), view.sort), [view]);
  const counts = useMemo(() => Object.fromEntries(BT_UNIT_KINDS.map(kind => [kind.id, filterBtUnits(units, { kind: kind.id, query: view.query }).length])), [view.query]);
  const total = useMemo(() => filterBtUnits(units, { kind: 'all', query: view.query }).length, [view.query]);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toBtUnitsQuery(view)}`);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (change: Partial<BtUnitsView>) => setView(current => ({ ...current, ...change }));

  return (
    <div className="units">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Enemy units</h1>
        <nav className="units-links" aria-label="BATTLETECH">
          <a href="/battletech/"><small>BATTLETECH</small> MechLab</a>
          <a href="/battletech/starmap/">Star map</a>
          <a href="/battletech/flashpoints/">Flashpoints</a>
          <a href="/battletech/units/" aria-current="page">Enemy units</a>
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
            Tanks, wheeled vehicles and turrets you face in BATTLETECH contracts, with their armor and structure by
            location, how far they move and the weapons they carry. Damage is one attack with every weapon.
          </p>
        </section>

        <section className="units-controls" aria-label="Filters">
          <div className="units-kinds" role="group" aria-label="Unit type">
            <button type="button" aria-pressed={view.kind === 'all'} onClick={() => update({ kind: 'all' })}>
              All <small>{total}</small>
            </button>
            {BT_UNIT_KINDS.map(kind => (
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
              <select value={view.sort} onChange={event => update({ sort: event.target.value as BtUnitSort })}>
                {BT_UNIT_SORTS.map(sort => <option key={sort.id} value={sort.id}>{sort.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        {shown.length > 0
          ? <div className="units-grid">{shown.map(unit => <UnitCard key={unit.id} unit={unit} />)}</div>
          : <p className="units-empty">No units match this search.</p>}
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toBtUnitsQuery(view)}`}
          attachLabel="Attach a link to this list"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
