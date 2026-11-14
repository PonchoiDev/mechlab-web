import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import starmapData from '../../data/battletech/starmap.json';
import type { BtStarmapData } from '../../types/battletech';
import type { StarSystem } from '../../types/starmap';
import { NEUTRAL_COLOR, getLegend, groupTags, parseBtQuery, toBtQuery } from '../../utils/battletech/starmap';
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
const URL_DELAY = 250;
const NOTICE_DELAY = 4000;

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

function SystemPanel({ system, pinned, onClose }: SystemPanelProps) {
  const owner = system.owners[0]?.[1] ?? null;
  const details = data.details[system.id];
  return (
    <section className={`starmap-panel bt-system${pinned ? ' is-pinned' : ''}`} aria-label={`${system.name} system`}>
      <div className="starmap-panel-head">
        <FactionEmblem factionId={owner} />
        <div>
          <h2>{system.name}</h2>
          <p>{owner ? factionName(owner) : 'Unclaimed'}</p>
        </div>
        {pinned && <button type="button" className="starmap-close" onClick={onClose} aria-label="Close system details">✕</button>}
      </div>
      {details.description && <p className="bt-description">{details.description}</p>}
      <dl className="starmap-tags">
        <div>
          <dt>Difficulty</dt>
          <dd><span className="bt-difficulty" aria-label={`Career difficulty ${details.difficulty}`}>{details.difficulty}</span> <small>career</small></dd>
        </div>
        {(details.blackMarket || details.factionStore) && (
          <div className="is-quest">
            <dt>Stores</dt>
            <dd>
              {details.factionStore && <span className="bt-store">{factionName(details.factionStore)} faction store</span>}
              {details.blackMarket && <span className="bt-store is-black">Black market</span>}
            </dd>
          </div>
        )}
        {groupTags(details.tags).map(group => (
          <div key={group.label}>
            <dt>{group.label}</dt>
            <dd className="bt-tags">
              {group.tags.map(tag => <span key={tag.id} title={tag.description}>{tag.name}</span>)}
            </dd>
          </div>
        ))}
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
    </section>
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
        placeholder="Search system"
        aria-label="Search system"
        aria-controls="starmap-search-results"
        aria-expanded={results.length > 0}
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
            <li key={system.id} role="option" aria-selected={index === active}>
              <button type="button" onClick={() => pick(system)} onMouseEnter={() => setActive(index)}>{system.name}</button>
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
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(() => (selectedId === null ? null : { systemIds: [selectedId], sequence: 0 }));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const focusOn = useCallback((systemId: number) => setFocus(previous => ({ systemIds: [systemId], sequence: (previous?.sequence ?? 0) + 1 })), []);
  const marks = useMemo(() => getMapMarks({ selectedId, academySystem: null, questOffer: null, campaignStart: null, mechSystem: null }), [selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => window.history.replaceState(null, '', `${window.location.pathname}${toBtQuery(selectedId, data)}`), URL_DELAY);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

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
          <a href="/battletech/argo/">Argo</a>
        </nav>
        <div className="starmap-actions">
          <WhatsNew />
          <button type="button" className="starmap-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
        <SystemSearch
          onPick={system => {
            setSelectedId(system.id);
            focusOn(system.id);
          }}
        />
      </header>

      {shown && <SystemPanel system={shown} pinned={isPinned} onClose={() => setSelectedId(null)} />}

      <div className="starmap-drawers">
        <FactionLegend />
      </div>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toBtQuery(selectedId, data)}`}
          attachLabel="Attach a link to this map view"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="starmap-notice" role="status">{notice}</p>}
    </div>
  );
}
