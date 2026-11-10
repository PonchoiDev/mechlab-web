import { Fragment, useMemo, useState, type CSSProperties } from 'react';
import type { AvailabilityData, GameDate, MechAvailability, Quest, StarmapData } from '../types/starmap';
import { countSources, describeRewardSource, getAvailabilityAt, getFixedSources, getLaterVariants, getOnePlaceMechs, isProduced, RARITY_NAMES, searchMechs, type FixedSources } from '../utils/availability';
import { formatGameDate } from '../utils/starmap';
import { MechLink } from './MarketPanels';
import { NOT_SOLD_COLOR, RARITY_COLORS } from './rarityColors';


// Sin rareza: cargando o, si falló la descarga, un aviso con un botón para reintentar.
function AvailabilityStatus({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (!failed) return <li className="starmap-quests-empty">Loading…</li>;
  return (
    <li className="starmap-quests-empty">
      Couldn&rsquo;t load the &rsquo;Mech data.
      <button type="button" className="starmap-mech-date" onClick={onRetry}>Try again</button>
    </li>
  );
}

const systemName = (data: StarmapData, id: number) => data.systems.find(system => system.id === id)?.name ?? '';


// Una línea por fuente fija: la HRQ, el mercado especial, el sistema donde está colocado o la misión.
const describeSources = (data: StarmapData, { quests, markets, uniques, rewards }: FixedSources): string[] => [
  ...quests.map(quest => `Quest reward: ${quest.name}`),
  ...markets.map(market => `Special market: ${systemName(data, market.system)}`),
  ...uniques.map(unique => `${systemName(data, unique.system)} from ${formatGameDate(unique.from)}`),
  ...rewards.map(describeRewardSource)
];

interface MechDrawerProps {
  availability: AvailabilityData | null;
  failed: boolean;
  date: GameDate;
  // Último día del mapa: después no se puede ir a una fecha.
  lastDate: GameDate;
  onDate: (date: GameDate) => void;
  selectedId: string | null;
  onOpen: () => void;
  onPick: (mechId: string) => void;
}

// Buscador de variantes, junto a Quests y Special markets. La rareza se carga al abrirlo.
export function MechDrawer({ availability, failed, date, lastDate, onDate, selectedId, onOpen, onPick }: MechDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => (availability ? searchMechs(availability, query, date) : []), [availability, query, date]);
  const later = useMemo(() => (availability ? getLaterVariants(availability, query, date) : { count: 0, next: null }), [availability, query, date]);
  // Lo que cambia en la lista mientras el foco sigue en el buscador, para los lectores de pantalla.
  const status = !availability
    ? (failed ? 'Couldn\u2019t load the \u2019Mech data' : '')
    : !query.trim() ? ''
      : [
        results.length === 1 ? '1 \u2019Mech found' : `${results.length} \u2019Mechs found`,
        later.count > 0 && (later.count === 1 ? '1 more enters production later' : `${later.count} more enter production later`)
      ].filter(Boolean).join('. ');

  return (
    <section className={`starmap-legend starmap-quests starmap-mechs-drawer${isOpen ? ' is-open' : ''}`} aria-label="Find a 'Mech">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) onOpen();
          setIsOpen(open => !open);
        }}
      >
        Find a &rsquo;Mech
      </button>
      <p className="starmap-sr-only" role="status" aria-live="polite">{isOpen ? status : ''}</p>
      {isOpen && (
        <div className="starmap-quests-body">
          <input
            type="search"
            placeholder="'Mech or variant, like Atlas or AS7-D"
            aria-label="Search 'Mechs"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <ul>
            {!availability && <AvailabilityStatus failed={failed} onRetry={onOpen} />}
            {availability && !query.trim() && <li className="starmap-quests-empty">Type a name to see where each faction sells it. Only &rsquo;Mechs in production on {formatGameDate(date)} are listed</li>}
            {results.map(mech => (
              <li key={mech.id}>
                <button
                  type="button"
                  aria-pressed={mech.id === selectedId}
                  onClick={() => {
                    // Se cierra para que no tape lo que el mapa encuadra.
                    setIsOpen(false);
                    onPick(mech.id);
                  }}
                >
                  <span>{mech.name} <small>{mech.id}</small></span>
                  {(mech.otherName || mech.hero) && <small>{[mech.otherName, mech.hero && 'Hero'].filter(Boolean).join(' · ')}</small>}
                </button>
              </li>
            ))}
            {availability && query.trim() && (
              <LaterVariants {...later} hasResults={results.length > 0} date={date} lastDate={lastDate} onDate={onDate} />
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

// Variantes que llegan después de la fecha del mapa, al final de la lista o en lugar de ella: un botón
// lleva a la fecha de la siguiente, si es antes del final del mapa.
function LaterVariants({ count, next, hasResults, date, lastDate, onDate }: {
  count: number;
  next: GameDate | null;
  hasResults: boolean;
  date: GameDate;
  lastDate: GameDate;
  onDate: (date: GameDate) => void;
}) {
  if (!next) return hasResults ? null : <li className="starmap-quests-empty">No &rsquo;Mechs found</li>;
  const variants = count === 1 ? 'variant enters' : 'variants enter';
  return (
    <li className="starmap-quests-empty">
      {hasResults ? `${count} more ${variants} production later.` : `No 'Mechs in production on ${formatGameDate(date)}.`}
      {next <= lastDate
        ? <button type="button" className="starmap-mech-date" onClick={() => onDate(next)}>Show from {formatGameDate(next)}</button>
        : <> {hasResults ? 'The next one' : count === 1 ? 'It' : 'The first one'} enters production on {formatGameDate(next)}, after the map ends.</>}
    </li>
  );
}

interface HeroDrawerProps {
  data: StarmapData;
  availability: AvailabilityData | null;
  failed: boolean;
  selectedId: string | null;
  onOpen: () => void;
  onPick: (mechId: string) => void;
}

// 'Mechs que solo se consiguen en un sitio: los hero que no salen a la venta y, aparte, las variantes
// especiales que no vende ninguna facción (el Wolverine de Razer).
export function HeroDrawer({ data, availability, failed, selectedId, onOpen, onPick }: HeroDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { heroes, special } = useMemo(() => (availability ? getOnePlaceMechs(data, availability) : { heroes: [], special: [] }), [data, availability]);
  const groups = [{ title: 'Hero \u2019Mechs', entries: heroes }, { title: 'Special variants', entries: special }];

  return (
    <section className={`starmap-legend starmap-quests starmap-heroes-drawer${isOpen ? ' is-open' : ''}`} aria-label="Special 'Mech locations">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) onOpen();
          setIsOpen(open => !open);
        }}
      >
        <span className="starmap-drawer-extra">Special </span>&rsquo;Mech locations {availability && <b>{heroes.length + special.length}</b>}
      </button>
      {isOpen && (
        <div className="starmap-quests-body">
          <p className="starmap-market-note">&rsquo;Mechs you can only get in one place. Other heroes come up for sale at random</p>
          <ul>
            {!availability && <AvailabilityStatus failed={failed} onRetry={onOpen} />}
            {availability && groups.flatMap(({ title, entries }) => [
              <li key={title} className="starmap-quests-group">{title}</li>,
              ...entries.map(({ mech, sources }) => (
                <li key={mech.id}>
                  <button
                    type="button"
                    aria-pressed={mech.id === selectedId}
                    onClick={() => {
                      // Se cierra para que no tape lo que el mapa encuadra.
                      setIsOpen(false);
                      onPick(mech.id);
                    }}
                  >
                    <span>{mech.name} <small>{mech.id}</small></span>
                    <small>{describeSources(data, sources).join(' · ')}</small>
                  </button>
                </li>
              ))
            ])}
          </ul>
        </div>
      )}
    </section>
  );
}

interface MechCardProps {
  data: StarmapData;
  availability: AvailabilityData;
  mech: MechAvailability;
  date: GameDate;
  onSystem: (systemId: number) => void;
  // La misión de una recompensa: encuadra y marca su sistema sin cerrar la ficha.
  onMission: (systemId: number) => void;
  onQuest: (quest: Quest) => void;
  onClose: () => void;
}

// Ficha de la variante: si existe en la fecha, quién la vende y con qué rareza, y sus fuentes fijas.
export function MechCard({ data, availability, mech, date, onSystem, onMission, onQuest, onClose }: MechCardProps) {
  const produced = isProduced(mech, date);
  // Las facciones que no la venden ya salen en gris en el mapa: listarlas solo estorba. Antes de que
  // exista la variante, el mapa la pinta toda en gris y la ficha tampoco lista vendedores.
  const groups = produced
    ? getAvailabilityAt(data, availability, mech, date).flatMap(({ rarity, factions }) => (rarity ? [{ rarity, factions }] : []))
    : [];
  const sources = getFixedSources(data, mech.id);
  const hasSources = countSources(sources) > 0;
  const isSold = produced && groups.some(({ rarity }) => rarity !== 'unavailable');

  return (
    <section className="starmap-panel is-pinned starmap-quest starmap-mech" aria-label={`${mech.name} ${mech.id}`}>
      <div className="starmap-panel-head">
        <span className="starmap-quest-mark starmap-mech-mark" aria-hidden="true">{mech.hero ? 'H' : 'M'}</span>
        <div>
          <h2>{mech.name}</h2>
          <p>{[mech.id, mech.otherName && `Also known as ${mech.otherName}`, mech.hero && 'Hero'].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className="starmap-close" onClick={onClose} aria-label="Close 'Mech details">✕</button>
      </div>
      <dl className="starmap-tags">
        <div className="is-quest">
          <dt>Faction markets</dt>
          <dd>
            {produced
              ? <p className="starmap-mech-since">In production since {formatGameDate(mech.from)}</p>
              : <p className="starmap-quest-status">Not produced until {formatGameDate(mech.from)}</p>}
            {produced && !isSold && (
              <p className="starmap-quest-status">
                {mech.heroMarket
                  ? 'No faction market sells it, but it can come up for sale as a hero \u2019Mech'
                  : !hasSources ? 'No faction market sells it, and the game gives it no fixed place'
                    : Object.keys(mech.rarity).length === 0 ? 'No faction market sells it' : 'No faction market sells it on this date'}
              </p>
            )}
            {isSold && mech.heroMarket && <p className="starmap-mech-since">It can also come up for sale as a hero &rsquo;Mech</p>}
            <ul className="starmap-rarity">
              {groups.map(({ rarity, factions }) => (
                <li key={rarity} style={{ '--rarity': produced ? RARITY_COLORS[rarity] : NOT_SOLD_COLOR } as CSSProperties}>
                  <b>{RARITY_NAMES[rarity]}</b>
                  <span>
                    {factions.map(({ id, systems, systemIds }, index) => (
                      <Fragment key={id}>
                        {index > 0 && ', '}
                        {data.factions[id].name} ({systems})
                        {systemIds && rarity !== 'unavailable' && (
                          <>
                            {': '}
                            {systemIds.map((systemId, position) => (
                              <Fragment key={systemId}>
                                {position > 0 && ' '}
                                <button type="button" className="starmap-system-link" onClick={() => onSystem(systemId)}>{systemName(data, systemId)}</button>
                              </Fragment>
                            ))}
                          </>
                        )}
                      </Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        {hasSources && (
          <div className="is-quest">
            <dt>Always available</dt>
            <dd>
              <ul className="starmap-quest-requirements">
                {sources.quests.map(quest => (
                  <li key={quest.id}>
                    Quest reward: <button type="button" className="starmap-system-link" onClick={() => onQuest(quest)}>{quest.name}</button>
                  </li>
                ))}
                {sources.markets.map(market => (
                  <li key={market.id}>
                    Special market (DLC {market.dlc}): <button type="button" className="starmap-system-link" onClick={() => onSystem(market.system)}>{systemName(data, market.system)}</button>
                  </li>
                ))}
                {sources.uniques.map(unique => (
                  <li key={unique.mech}>
                    <button type="button" className="starmap-system-link" onClick={() => onSystem(unique.system)}>{systemName(data, unique.system)}</button> from {formatGameDate(unique.from)}
                  </li>
                ))}
                {sources.rewards.map(reward => {
                  const { system } = reward;
                  return (
                    <li key={reward.id}>
                      {system !== undefined && reward.kind === 'mission'
                        ? <>Mission reward: <button type="button" className="starmap-system-link" onClick={() => onMission(system)}>{reward.title}</button>{reward.dlc && ` (DLC ${reward.dlc})`}</>
                        : describeRewardSource(reward)}
                      {system !== undefined && (
                        <> at <button type="button" className="starmap-system-link" onClick={() => onSystem(system)}>{systemName(data, system)}</button></>
                      )}
                      {reward.summary && reward.summary !== reward.title && <small className="starmap-mech-reward">{reward.summary}</small>}
                    </li>
                  );
                })}
              </ul>
            </dd>
          </div>
        )}
      </dl>
      <div className="starmap-mech-lab">
        <MechLink id={mech.id} name="Open in the MechLab" />
      </div>
    </section>
  );
}
