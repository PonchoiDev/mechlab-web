import { useMemo, useState } from 'react';
import type { Academy, GameDate, StarmapData, TrainingProgram } from '../types/starmap';
import { describeProgram, getAcademyClosing, getSystemAcademies, groupAcademies, searchAcademies } from '../utils/academies';
import { formatGameDate } from '../utils/starmap';

const numberFormat = new Intl.NumberFormat('en');
// Las estrellas de los programas van de 0 a 5, como en la pantalla de la academia del juego.
const MAX_STARS = 5;

const systemName = (data: StarmapData, id: number) => data.systems.find(system => system.id === id)?.name ?? '';

function Stars({ label, value }: { label: string; value: number }) {
  return (
    <span className="starmap-academy-stars" aria-label={`${label}: ${value} of ${MAX_STARS} stars`}>
      <small aria-hidden="true">{label}</small>
      <b aria-hidden="true">{'★'.repeat(value)}<i>{'★'.repeat(MAX_STARS - value)}</i></b>
    </span>
  );
}

function ProgramItem({ program, academyName }: { program: TrainingProgram; academyName: string }) {
  const [minSkill, maxSkill] = program.skill;
  return (
    <li className="starmap-academy-program">
      <h4>{program.name}</h4>
      <p>{describeProgram(program, academyName)}</p>
      <dl>
        <div><dt>Length</dt><dd>{program.days} days</dd></div>
        <div>
          <dt>Cost</dt>
          <dd>
            {numberFormat.format(program.fee)} C-Bills
            {program.tuition > 0 && <small> + {numberFormat.format(program.tuition)} per quarter</small>}
          </dd>
        </div>
        <div><dt>Pilot skill</dt><dd>{minSkill > 0 ? `${minSkill} to ${maxSkill}` : `Up to ${maxSkill}`}</dd></div>
      </dl>
      <div className="starmap-academy-ratings">
        <Stars label="Skills" value={program.stars.skill} />
        <Stars label="Traits" value={program.stars.traits} />
        <Stars label="XP" value={program.stars.xp} />
      </div>
    </li>
  );
}

interface AcademyCardProps {
  data: StarmapData;
  academy: Academy;
  date: GameDate;
  onSystem: (systemId: number) => void;
  onClose: () => void;
}

// Ficha de una academia: dónde está, desde cuándo, qué pide y los programas que ofrece.
export function AcademyCard({ data, academy, date, onSystem, onClose }: AcademyCardProps) {
  const closing = getAcademyClosing(data, academy);
  const notYet = academy.founded !== null && academy.founded > date;
  return (
    <section className="starmap-panel is-pinned starmap-academy" aria-label={academy.name}>
      <div className="starmap-panel-head">
        <span className="starmap-academy-mark" aria-hidden="true" />
        <div>
          <h2>{academy.name}</h2>
          <p>
            Pilot academy · DLC 7 ·{' '}
            <button type="button" className="starmap-system-link" onClick={() => onSystem(academy.system)}>{systemName(data, academy.system)}</button>
          </p>
        </div>
        <button type="button" className="starmap-close" onClick={onClose} aria-label="Close academy details">✕</button>
      </div>
      <ul className="starmap-academy-facts">
        {/* Si se fundó antes de que empiece el mapa, está abierta en todas sus fechas: solo se dice cuándo. */}
        {academy.founded && (
          <li className={notYet ? 'is-warning' : undefined}>
            {academy.founded <= data.range.start ? 'Founded' : notYet ? 'Opens' : 'Open since'} {formatGameDate(academy.founded)}
          </li>
        )}
        {academy.standing !== null && <li>Requires faction standing {academy.standing}</li>}
        {closing && (
          <li className={date >= closing ? 'is-warning' : undefined}>
            {date >= closing ? 'Destroyed by the Clans on' : 'Destroyed when the Clans take the system, on'} {formatGameDate(closing)}
          </li>
        )}
        {academy.clanDestroyed && !closing && <li>Closes if a Clan takes the system</li>}
      </ul>
      <p className="starmap-zone-description">{academy.description}</p>
      <h3 className="starmap-academy-heading">Training programs</h3>
      <ol className="starmap-academy-programs">
        {academy.programs.map(id => data.trainingPrograms[id] && (
          <ProgramItem key={id} program={data.trainingPrograms[id]} academyName={academy.name} />
        ))}
      </ol>
    </section>
  );
}

// Academias de un sistema, dentro de su ficha.
export function SystemAcademies({ data, systemId, date, onPick }: { data: StarmapData; systemId: number; date: GameDate; onPick: (academyId: string) => void }) {
  const academies = getSystemAcademies(data, systemId, date);
  if (academies.length === 0) return null;
  return (
    <section className="starmap-market starmap-academy-entry" aria-label="Pilot academies">
      <h3>{academies.length === 1 ? 'Pilot academy' : 'Pilot academies'} <small>DLC 7</small></h3>
      <ul>
        {academies.map(academy => (
          <li key={academy.id}>
            <button type="button" className="starmap-system-link" onClick={() => onPick(academy.id)}>{academy.name}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface AcademyDrawerProps {
  data: StarmapData;
  date: GameDate;
  selectedId: string | null;
  onPick: (academyId: string) => void;
}

// Academias abiertas en la fecha del mapa. Las franquicias (Virtual World Center, Dutchy RTC…) van
// en una entrada con sus sistemas.
export function AcademyDrawer({ data, date, selectedId, onPick }: AcademyDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Franquicias desplegadas. Al buscar se despliegan todas, para ver qué sistema coincide.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (name: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });
  const groups = useMemo(() => groupAcademies(searchAcademies(data, query, date)), [data, query, date]);
  const total = useMemo(() => searchAcademies(data, '', date).length, [data, date]);
  const pick = (id: string) => {
    // Se cierra para que no tape lo que el mapa encuadra.
    setIsOpen(false);
    onPick(id);
  };

  return (
    <section className={`starmap-legend starmap-quests starmap-academies-drawer${isOpen ? ' is-open' : ''}`} aria-label="Academies">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>
        Academies <b>{total}</b>
      </button>
      {isOpen && (
        <div className="starmap-quests-body">
          <p className="starmap-market-note">Pilot academies (DLC 7) open on {formatGameDate(date)}</p>
          <input
            type="search"
            placeholder="Academy or system"
            aria-label="Search academies"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <ul>
            {groups.map(group => group.academies.length === 1
              ? (
                <li key={group.name}>
                  <button type="button" aria-pressed={group.academies[0].id === selectedId} onClick={() => pick(group.academies[0].id)}>
                    <span>{group.name}</span>
                    <small>{systemName(data, group.academies[0].system)}</small>
                  </button>
                </li>
              )
              : (
                <li key={group.name} className="starmap-academy-group">
                  <button
                    type="button"
                    className="starmap-academy-group-toggle"
                    aria-expanded={query.trim() !== '' || expanded.has(group.name)}
                    onClick={() => toggle(group.name)}
                  >
                    <span>{group.name}</span>
                    <small>Franchise in {group.academies.length} systems</small>
                  </button>
                  {(query.trim() !== '' || expanded.has(group.name)) && (
                    <ul>
                      {group.academies.map(academy => (
                        <li key={academy.id}>
                          <button type="button" aria-pressed={academy.id === selectedId} onClick={() => pick(academy.id)}>
                            <span>{systemName(data, academy.system)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            {groups.length === 0 && <li className="starmap-quests-empty">Nothing found</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
