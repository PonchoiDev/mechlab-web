import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import starmapData from '../data/starmap.json';
import type { GameDate, StarSystem, StarmapData } from '../types/starmap';
import {
  clampDate,
  countSystemsByOwner,
  dateToDays,
  daysToDate,
  formatGameDate,
  getCurrentEvent,
  getNextEvent,
  getOwnerAt,
  getOwnerChanges,
  getPreviousEvent,
  parseMapQuery,
  searchSystems,
  toMapQuery
} from '../utils/starmap';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { SupportLink } from '../components/SupportLink';
import { StarmapCanvas, type FocusRequest } from './StarmapCanvas';

const data = starmapData as unknown as StarmapData;
const LEGEND_MIN_SYSTEMS = 5;
const URL_DELAY = 250;
const NOTICE_DELAY = 4000;

function FactionEmblem({ factionId }: { factionId: string | null }) {
  const faction = factionId ? data.factions[factionId] : null;
  return (
    <span className="starmap-emblem" style={{ '--faction': faction?.color ?? '#5d6470' } as CSSProperties} aria-hidden="true">
      {faction?.short ?? ''}
    </span>
  );
}

function SystemPanel({ system, date, pinned, onClose }: { system: StarSystem; date: GameDate; pinned: boolean; onClose: () => void }) {
  const owner = getOwnerAt(system, date);
  const currentIndex = system.owners.findLastIndex(([changedOn]) => changedOn <= date);
  const cluster = system.cluster ? data.clusters[system.cluster]?.name : null;
  const isCapital = system.hub ? data.hubs[system.hub]?.capital === system.id : false;

  return (
    <section className={`starmap-panel${pinned ? ' is-pinned' : ''}`} aria-label={`${system.name} system`}>
      <div className="starmap-panel-head">
        <FactionEmblem factionId={owner} />
        <div>
          <h2>{system.name}</h2>
          <p>{owner ? data.factions[owner].name : 'Unclaimed'}</p>
        </div>
        {pinned && <button type="button" className="starmap-close" onClick={onClose} aria-label="Close system details">✕</button>}
      </div>
      {(system.hub || cluster) && (
        <dl className="starmap-tags">
          {system.hub && (
            <div className="is-hub">
              <dt>Industrial hub</dt>
              <dd>{isCapital ? 'Hub capital' : 'Repairs and refits'}</dd>
            </div>
          )}
          {cluster && (
            <div>
              <dt>Cluster</dt>
              <dd>{cluster}</dd>
            </div>
          )}
        </dl>
      )}
      {pinned && (
        <ol className="starmap-history" aria-label="Owners over time">
          {system.owners.map(([changedOn, faction], index) => (
            <li key={changedOn} className={index === currentIndex ? 'is-current' : undefined}>
              <time dateTime={changedOn}>{formatGameDate(changedOn)}</time>
              <span style={{ '--faction': faction ? data.factions[faction].color : '#5d6470' } as CSSProperties}>
                {faction ? data.factions[faction].name : 'Unclaimed'}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="starmap-coordinates">{system.x}, {system.y} ly from Terra</p>
    </section>
  );
}

interface DateControlProps {
  date: GameDate;
  // Sistemas que cambiaron de dueño en el último salto entre eventos, o null si se movió el control.
  changedCount: number | null;
  onChange: (date: GameDate, isJump: boolean) => void;
}

function DateControl({ date, changedCount, onChange }: DateControlProps) {
  const current = getCurrentEvent(data.events, date);
  const previous = getPreviousEvent(data.events, date);
  const next = getNextEvent(data.events, date);

  return (
    <section className="starmap-date" aria-label="Date">
      <p className="starmap-date-era">{current ? current.name : 'Campaign start'}</p>
      <p className="starmap-date-value">{formatGameDate(date)}</p>
      <p className="starmap-date-changes" aria-live="polite">
        {changedCount !== null && (changedCount === 1 ? '1 system changed hands' : `${changedCount} systems changed hands`)}
      </p>
      <input
        type="range"
        aria-label="Date"
        aria-valuetext={formatGameDate(date)}
        min={dateToDays(data.range.start)}
        max={dateToDays(data.range.end)}
        value={dateToDays(date)}
        onChange={event => onChange(daysToDate(Number(event.target.value)), false)}
      />
      <div className="starmap-date-ticks" aria-hidden="true">
        {data.events.map(event => {
          const span = dateToDays(data.range.end) - dateToDays(data.range.start);
          const left = ((dateToDays(event.date) - dateToDays(data.range.start)) / span) * 100;
          return <span key={event.id} style={{ left: `${left}%` }} />;
        })}
      </div>
      <div className="starmap-date-actions">
        <button type="button" disabled={!previous} onClick={() => previous && onChange(previous.date, true)} aria-label="Previous event">◀</button>
        <select
          aria-label="Jump to event"
          value={current && current.date === date ? current.id : ''}
          onChange={event => {
            const target = data.events.find(candidate => candidate.id === event.target.value);
            if (target) onChange(target.date, true);
          }}
        >
          <option value="">Jump to event…</option>
          {data.events.map(event => <option key={event.id} value={event.id}>{event.date.slice(0, 4)} · {event.name}</option>)}
        </select>
        <button type="button" disabled={!next} onClick={() => next && onChange(next.date, true)} aria-label="Next event">▶</button>
      </div>
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

function FactionLegend({ date }: { date: GameDate }) {
  const [isOpen, setIsOpen] = useState(false);
  const factions = countSystemsByOwner(data.systems, date).filter(([, count]) => count >= LEGEND_MIN_SYSTEMS);
  return (
    <section className={`starmap-legend${isOpen ? ' is-open' : ''}`} aria-label="Factions">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>Factions</button>
      {isOpen && (
        <ul>
          {factions.map(([faction, count]) => (
            <li key={faction} style={{ '--faction': data.factions[faction].color } as CSSProperties}>
              <span>{data.factions[faction].name}</span>
              <b>{count}</b>
            </li>
          ))}
          <li className="is-cluster" style={{ '--faction': data.colors.cluster } as CSSProperties}><span>Cluster</span></li>
          <li className="is-cluster" style={{ '--faction': data.colors.hub } as CSSProperties}><span>Industrial hub</span></li>
        </ul>
      )}
    </section>
  );
}

export function StarmapApp() {
  const initial = useMemo(() => parseMapQuery(window.location.search, data), []);
  const [date, setDate] = useState<GameDate>(initial.date);
  const [jump, setJump] = useState<{ changedCount: number } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initial.systemId);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_DELAY);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [focus, setFocus] = useState<FocusRequest | null>(initial.systemId === null ? null : { systemId: initial.systemId, sequence: 0 });

  // La URL guarda la fecha y el sistema elegido, para compartir la vista. Se espera a que el
  // control deslizante se pare para no llenar el historial.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.history.replaceState(null, '', toMapQuery({ date, systemId: selectedId }, data));
    }, URL_DELAY);
    return () => window.clearTimeout(timer);
  }, [date, selectedId]);

  const shown = data.systems.find(system => system.id === (hoveredId ?? selectedId)) ?? null;
  const isPinned = shown !== null && shown.id === selectedId && hoveredId === null;

  const pickSystem = (system: StarSystem) => {
    setSelectedId(system.id);
    setFocus(previous => ({ systemId: system.id, sequence: (previous?.sequence ?? 0) + 1 }));
  };

  return (
    <div className="starmap">
      <StarmapCanvas
        data={data}
        date={date}
        animateDate={jump !== null}
        hoveredId={hoveredId}
        selectedId={selectedId}
        focus={focus}
        onHover={setHoveredId}
        onSelect={setSelectedId}
      />

      <header className="starmap-topbar">
        <a className="starmap-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Star map</h1>
        <nav className="starmap-links" aria-label="MW Builder">
          <a href="/mercs/"><small>MW5 Mercenaries</small> MechLab</a>
        </nav>
        <div className="starmap-actions">
          <button type="button" className="starmap-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
        <SystemSearch onPick={pickSystem} />
      </header>

      {shown && <SystemPanel system={shown} date={date} pinned={isPinned} onClose={() => setSelectedId(null)} />}

      <FactionLegend date={date} />
      {isFeedbackOpen && (
        <FeedbackDialog
          // Se calcula con el estado, no con window.location: la URL se actualiza con retraso.
          buildUrl={`${window.location.origin}${window.location.pathname}${toMapQuery({ date, systemId: selectedId }, data)}`}
          attachLabel="Attach a link to this map view"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="starmap-notice" role="status">{notice}</p>}

      <DateControl
        date={date}
        changedCount={jump?.changedCount ?? null}
        onChange={(next, isJump) => {
          const target = clampDate(next, data.range);
          setJump(isJump ? { changedCount: getOwnerChanges(data.systems, date, target).length } : null);
          setDate(target);
        }}
      />
    </div>
  );
}
