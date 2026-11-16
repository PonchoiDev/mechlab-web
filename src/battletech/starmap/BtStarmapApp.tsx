import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import starmapData from '../../data/battletech/starmap.json';
import type { BtStarmapData } from '../../types/battletech';
import type { StarSystem } from '../../types/starmap';
import {
  NEUTRAL_COLOR, NO_FILTERS, getActiveFactions, getFactionEmblems, getFilterOptions, getLegend, getMatchingSystems, getSkulls, groupTags,
  hasFilters, parseBtFilters, parseBtQuery, skullLabel, toBtQuery, type BtFilters
} from '../../utils/battletech/starmap';
import { getMapMarks } from '../../utils/marks';
import { searchSystems } from '../../utils/starmap';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { SupportLink } from '../../components/SupportLink';
import { WhatsNew } from '../../components/WhatsNew';
import { StarmapCanvas, type FocusRequest } from '../../starmap/StarmapCanvas';

const data = starmapData as unknown as BtStarmapData;
// El mapa no cambia con la fecha: el lienzo compartido con MW5 la pide igualmente.
const DATE = data.range.start;
const LOGO_PATH = `${import.meta.env.BASE_URL}starmap/logos/`;
const PLANET_PATH = `${import.meta.env.BASE_URL}starmap/planets/`;
const SKULL_URL = `${import.meta.env.BASE_URL}starmap/skull.svg`;
const FILTER_OPTIONS = getFilterOptions(data);
// Sistemas del color de su dueño y territorios rayados, como en el mapa del juego.
const LOOK = { ownerColors: true, hatched: true };
const URL_DELAY = 250;
const NOTICE_DELAY = 4000;

// Los logos van sobre el territorio de cada facción, como en el mapa del juego.
const EMBLEMS = getFactionEmblems(data).map(({ logo, x, y, size }) => ({ url: LOGO_PATH + logo, x, y, size }));

const factionName = (id: string) => data.factions[id]?.name ?? id;

// Logo del juego dentro de un aro del color de la facción, como en el mapa de MW5.
function FactionEmblem({ factionId }: { factionId: string | null }) {
  const faction = factionId ? data.factions[factionId] : null;
  return (
    <span className="starmap-emblem" style={{ '--faction': faction?.color ?? NEUTRAL_COLOR } as CSSProperties} aria-hidden="true">
      {faction?.logo ? <img src={LOGO_PATH + faction.logo} alt="" /> : faction?.short ?? ''}
    </span>
  );
}

function FactionList({ ids }: { ids: string[] }) {
  return (
    <ul className="bt-factions">
      {ids.map(id => (
        <li key={id} style={{ '--faction': data.factions[id]?.color ?? NEUTRAL_COLOR } as CSSProperties}>{factionName(id)}</li>
      ))}
    </ul>
  );
}

interface SystemPanelProps {
  system: StarSystem;
  pinned: boolean;
  onClose: () => void;
}

// CHALLENGE del juego: cinco calaveras, y cada punto de dificultad es media.
function Skulls({ difficulty }: { difficulty: number }) {
  return (
    <span className="bt-skulls" role="img" aria-label={`Challenge ${skullLabel(difficulty)} (career difficulty ${difficulty})`}>
      {getSkulls(difficulty).map((skull, index) => (
        <span key={index} className={`bt-skull is-${skull}`} style={{ '--skull': `url(${SKULL_URL})` } as CSSProperties} />
      ))}
    </span>
  );
}

// La ficha del juego: el planeta, el nombre y la dificultad arriba; el dueño y las facciones activas a la
// izquierda, el resumen en el centro y los atributos a la derecha. Añade lo que el juego no enseña ahí:
// tiendas, contratos y biomas.
function SystemPanel({ system, pinned, onClose }: SystemPanelProps) {
  const owner = system.owners[0]?.[1] ?? null;
  const details = data.details[system.id];
  const factions = getActiveFactions(data, details);
  return (
    <section className={`starmap-panel bt-system${pinned ? ' is-pinned' : ''}`} aria-label={`${system.name} system`}>
      <div className="bt-system-head">
        {details.planet && <img className="bt-planet" src={PLANET_PATH + details.planet} alt="" width={56} height={56} />}
        <h2>{system.name}</h2>
        <div className="bt-challenge">
          <small>Challenge</small>
          <Skulls difficulty={details.difficulty} />
        </div>
        {pinned && <button type="button" className="starmap-close" onClick={onClose} aria-label="Close system details">✕</button>}
      </div>
      <div className="bt-system-body">
        <div className="bt-system-col">
          <h3>System owner</h3>
          <p className="bt-owner"><FactionEmblem factionId={owner} /> {owner ? factionName(owner) : 'Unclaimed'}</p>
          {factions.length > 0 && (
            <>
              <h3>Active factions</h3>
              <ul className="bt-active-factions">
                {factions.map(faction => (
                  <li
                    key={faction.id}
                    className={faction.active ? 'is-active' : undefined}
                    title={`${faction.name}${faction.employer ? ' · offers contracts' : ''}${faction.target ? ' · contract target' : ''}`}
                  >
                    {faction.logo ? <img src={LOGO_PATH + faction.logo} alt={faction.name} /> : <span>{faction.name}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="bt-system-col is-summary">
          <h3>System summary</h3>
          {details.description && <p className="bt-description">{details.description}</p>}
          <dl className="starmap-tags">
            {(details.blackMarket || details.factionStore) && (
              <div className="is-quest">
                <dt>Stores</dt>
                <dd>
                  {details.factionStore && <span className="bt-store">{factionName(details.factionStore)} faction store</span>}
                  {details.blackMarket && <span className="bt-store is-black">Black market</span>}
                </dd>
              </div>
            )}
            {details.employers.length > 0 && (
              <div>
                <dt>Contracts from</dt>
                <dd><FactionList ids={details.employers} /></dd>
              </div>
            )}
            {details.targets.length > 0 && (
              <div>
                <dt>Fighting</dt>
                <dd><FactionList ids={details.targets} /></dd>
              </div>
            )}
            {details.biomes.length > 0 && (
              <div>
                <dt>Battlefields</dt>
                <dd className="bt-tags">{details.biomes.map(biome => <span key={biome}>{biome}</span>)}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="bt-system-col">
          <h3>Attributes</h3>
          <dl className="starmap-tags bt-attributes">
            {groupTags(details.tags).map(group => (
              <div key={group.label}>
                <dt>{group.label}</dt>
                <dd className="bt-tags">
                  {group.tags.map(tag => <span key={tag.id} title={tag.description}>{tag.name}</span>)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

// Los filtros del mapa del juego: dificultad, bioma y tienda. Los sistemas que no cumplen se apagan.
function MapFilters({ filters, onChange }: { filters: BtFilters; onChange: (filters: BtFilters) => void }) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  return (
    <div className="bt-filters" role="group" aria-label="Filters">
      <label>
        <span>Difficulty filter</span>
        <select value={filters.difficulty ?? ''} onChange={event => onChange({ ...filters, difficulty: event.target.value ? Number(event.target.value) : null })}>
          <option value="">No filter</option>
          {FILTER_OPTIONS.difficulties.map(value => <option key={value} value={value}>{skullLabel(value)}</option>)}
        </select>
      </label>
      <label>
        <span>Biome filter</span>
        <select value={filters.biome ?? ''} onChange={event => onChange({ ...filters, biome: event.target.value || null })}>
          <option value="">No filter</option>
          {FILTER_OPTIONS.biomes.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>Store filter</span>
        <select value={filters.store ?? ''} onChange={event => onChange({ ...filters, store: event.target.value || null })}>
          <option value="">No filter</option>
          {FILTER_OPTIONS.stores.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {hasFilters(filters) && <button type="button" className="bt-filters-clear" onClick={() => onChange(NO_FILTERS)}>Clear</button>}
      <button type="button" className="bt-filters-info" aria-expanded={isInfoOpen} aria-label="About the filters" onClick={() => setIsInfoOpen(open => !open)}>i</button>
      {isInfoOpen && (
        <p className="bt-filters-help">
          Systems that don't match every filter fade out. Difficulty is the career one, in skulls; biome, the kinds of
          battlefield its contracts use; store, a black market or a faction store.
        </p>
      )}
    </div>
  );
}

function SystemSearch({ onPick }: { onPick: (system: StarSystem) => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchSystems(data.systems, query), [query]);

  const pick = (system: StarSystem) => {
    onPick(system);
    setQuery('');
    setActive(0);
  };

  return (
    <div className="starmap-search" role="search">
      <input
        type="search"
        role="combobox"
        aria-autocomplete="list"
        placeholder="Search system"
        aria-label="Search system"
        aria-controls="starmap-search-results"
        aria-expanded={results.length > 0}
        aria-activedescendant={results[active] ? `starmap-search-option-${results[active].id}` : undefined}
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') setActive(index => Math.min(results.length - 1, index + 1));
          else if (event.key === 'ArrowUp') setActive(index => Math.max(0, index - 1));
          else if (event.key === 'Enter' && results[active]) pick(results[active]);
          else if (event.key === 'Escape') setQuery('');
          else return;
          event.preventDefault();
        }}
      />
      {results.length > 0 && (
        <ul id="starmap-search-results" role="listbox" aria-label="Systems">
          {results.map((system, index) => (
            // Opciones sin botón dentro, como pide el patrón de combobox: el foco sigue en el campo y
            // mousedown evita que lo pierda antes del clic.
            <li
              key={system.id}
              id={`starmap-search-option-${system.id}`}
              className="starmap-search-option"
              role="option"
              aria-selected={index === active}
              onMouseDown={event => event.preventDefault()}
              onClick={() => pick(system)}
              onMouseEnter={() => setActive(index)}
            >
              {system.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FactionLegend() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <section className={`starmap-legend${isOpen ? ' is-open' : ''}`} aria-label="Factions">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>Factions</button>
      {isOpen && (
        <ul>
          {getLegend(data).map(faction => (
            <li key={faction.id} className={data.factions[faction.id]?.logo ? 'has-logo' : undefined} style={{ '--faction': faction.color } as CSSProperties}>
              {data.factions[faction.id]?.logo && <img src={LOGO_PATH + data.factions[faction.id].logo} alt="" />}
              <span>{faction.name}</span>
              <b>{faction.count}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BtStarmapApp() {
  const [selectedId, setSelectedId] = useState<number | null>(() => parseBtQuery(window.location.search, data));
  const [filters, setFilters] = useState<BtFilters>(() => parseBtFilters(window.location.search, data));
  const matches = useMemo(() => getMatchingSystems(data, filters), [filters]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(() => (selectedId === null ? null : { systemIds: [selectedId], sequence: 0 }));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const focusOn = useCallback((systemId: number) => setFocus(previous => ({ systemIds: [systemId], sequence: (previous?.sequence ?? 0) + 1 })), []);
  const marks = useMemo(() => getMapMarks({ selectedId, academySystem: null, questOffer: null, campaignStart: null, mechSystem: null }), [selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => window.history.replaceState(null, '', `${window.location.pathname}${toBtQuery(selectedId, data, filters)}`), URL_DELAY);
    return () => window.clearTimeout(timer);
  }, [selectedId, filters]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_DELAY);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const shown = data.systems.find(system => system.id === (hoveredId ?? selectedId)) ?? null;
  const isPinned = shown !== null && shown.id === selectedId;

  return (
    <div className="starmap bt-starmap">
      <StarmapCanvas
        data={data}
        date={DATE}
        animateDate={false}
        hoveredId={hoveredId}
        selectedId={selectedId}
        questRoute={null}
        marks={marks}
        territoryColors={null}
        focus={focus}
        onHover={setHoveredId}
        onSelect={setSelectedId}
        onZone={() => undefined}
        mercZones={[]}
        emblems={EMBLEMS}
        look={LOOK}
        matches={matches}
        onMercZone={() => undefined}
      />

      <header className="starmap-topbar">
        <a className="starmap-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Star map</h1>
        <nav className="starmap-links" aria-label="MW Builder">
          <a href="/battletech/"><small>BATTLETECH</small> MechLab</a>
          <a href="/battletech/flashpoints/">Flashpoints</a>
          <a href="/battletech/units/">Enemy units</a>
          <a href="/battletech/argo/">Argo</a>
          <a href="/battletech/equipment/">Equipment</a>
        </nav>
        <div className="starmap-actions">
          <WhatsNew />
          <button type="button" className="starmap-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
        <SystemSearch
          onPick={system => {
            // El ratón puede seguir sobre otro sistema: sin limpiarlo, la ficha enseñaría ese.
            setHoveredId(null);
            setSelectedId(system.id);
            focusOn(system.id);
          }}
        />
      </header>

      {shown && <SystemPanel system={shown} pinned={isPinned} onClose={() => setSelectedId(null)} />}

      <MapFilters filters={filters} onChange={setFilters} />

      <div className="starmap-drawers">
        <FactionLegend />
      </div>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toBtQuery(selectedId, data, filters)}`}
          attachLabel="Attach a link to this map view"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="starmap-notice" role="status">{notice}</p>}
    </div>
  );
}
