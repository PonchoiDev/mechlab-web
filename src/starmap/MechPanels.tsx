import { Fragment, useMemo, useState, type CSSProperties } from 'react';
import type { AvailabilityData, GameDate, MechAvailability, Quest, StarmapData } from '../types/starmap';
import { getAvailabilityAt, getFixedSources, getHeroMechs, isProduced, RARITY_NAMES, searchMechs, type FixedSources } from '../utils/availability';
import { formatGameDate } from '../utils/starmap';
import { MechLink } from './MarketPanels';
import { NOT_SOLD_COLOR, RARITY_COLORS } from './rarityColors';


const systemName = (data: StarmapData, id: number) => data.systems.find(system => system.id === id)?.name ?? '';

// Una línea por fuente fija: la HRQ, el mercado especial o el sistema donde está colocado.
const describeSources = (data: StarmapData, { quests, markets, uniques }: FixedSources): string[] => [
  ...quests.map(quest => `Quest reward: ${quest.name}`),
  ...markets.map(market => `Special market: ${systemName(data, market.system)}`),
  ...uniques.map(unique => `${systemName(data, unique.system)} from ${formatGameDate(unique.from)}`)
];

interface MechDrawerProps {
  availability: AvailabilityData | null;
  date: GameDate;
  selectedId: string | null;
  onOpen: () => void;
  onPick: (mechId: string) => void;
}

// Buscador de variantes, junto a Quests y Special markets. La rareza se carga al abrirlo.
export function MechDrawer({ availability, date, selectedId, onOpen, onPick }: MechDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => (availability ? searchMechs(availability, query, date) : []), [availability, query, date]);

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
            {!availability && <li className="starmap-quests-empty">Loading…</li>}
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
                  {mech.hero && <small>Hero</small>}
                </button>
              </li>
            ))}
            {availability && query.trim() && results.length === 0 && <li className="starmap-quests-empty">No &rsquo;Mechs in production on {formatGameDate(date)}</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

interface HeroDrawerProps {
  data: StarmapData;
  availability: AvailabilityData | null;
  selectedId: string | null;
  onOpen: () => void;
  onPick: (mechId: string) => void;
}

// 'Mechs hero que solo se consiguen en un sitio: recompensa de una HRQ, mercado especial o colocados.
export function HeroDrawer({ data, availability, selectedId, onOpen, onPick }: HeroDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const heroes = useMemo(() => (availability ? getHeroMechs(data, availability) : []), [data, availability]);

  return (
    <section className={`starmap-legend starmap-quests starmap-heroes-drawer${isOpen ? ' is-open' : ''}`} aria-label="Hero 'Mechs">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) onOpen();
          setIsOpen(open => !open);
        }}
      >
        Hero &rsquo;Mechs {availability && <b>{heroes.length}</b>}
      </button>
      {isOpen && (
        <div className="starmap-quests-body">
          <p className="starmap-market-note">Hero &rsquo;Mechs you can only get in one place</p>
          <ul>
            {!availability && <li className="starmap-quests-empty">Loading…</li>}
            {heroes.map(({ mech, sources }) => (
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
            ))}
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
  onQuest: (quest: Quest) => void;
  onClose: () => void;
}

// Ficha de la variante: si existe en la fecha, quién la vende y con qué rareza, y sus fuentes fijas.
export function MechCard({ data, availability, mech, date, onSystem, onQuest, onClose }: MechCardProps) {
  // Las facciones que no la venden ya salen en gris en el mapa: listarlas solo estorba.
  const groups = getAvailabilityAt(data, availability, mech, date).flatMap(({ rarity, factions }) => (rarity ? [{ rarity, factions }] : []));
  const sources = getFixedSources(data, mech.id);
  const produced = isProduced(mech, date);
  const hasSources = sources.quests.length + sources.markets.length + sources.uniques.length > 0;
  const isSold = produced && groups.some(({ rarity }) => rarity !== 'unavailable');

  return (
    <section className="starmap-panel is-pinned starmap-quest starmap-mech" aria-label={`${mech.name} ${mech.id}`}>
      <div className="starmap-panel-head">
        <span className="starmap-quest-mark starmap-mech-mark" aria-hidden="true">{mech.hero ? 'H' : 'M'}</span>
        <div>
          <h2>{mech.name}</h2>
          <p>{mech.id}{mech.hero && ' · Hero'}</p>
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
                {hasSources ? 'No faction market sells it on this date' : 'No faction market sells it, and the game gives it no fixed place'}
              </p>
            )}
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
