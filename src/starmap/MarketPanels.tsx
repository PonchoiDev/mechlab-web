import { useMemo, useState } from 'react';
import type { GameDate, Market, StarmapData } from '../types/starmap';
import { getMarketsForSystem, getMechLabUrl, searchMarkets } from '../utils/markets';
import { formatGameDate } from '../utils/starmap';

const describeMarket = (market: Market) => `DLC ${market.dlc} · ${market.stage}`;

function MechLink({ id, name }: { id: string; name: string }) {
  return (
    <a className="starmap-mech-link" href={getMechLabUrl(id)} target="_blank" rel="noreferrer" title="Open in the MechLab with its stock build">
      {name} <small>{id}</small>
    </a>
  );
}

// Mercados especiales y 'Mechs únicos de un sistema, dentro de su ficha.
export function SystemMarkets({ data, systemId, date }: { data: StarmapData; systemId: number; date: GameDate }) {
  const markets = getMarketsForSystem(data, systemId);
  const uniques = data.uniqueMechs.filter(unique => unique.system === systemId);
  if (markets.length === 0 && uniques.length === 0) return null;

  return (
    <div className="starmap-markets">
      {uniques.map(unique => (
        <section key={unique.mech} className="starmap-market is-unique" aria-label={`Unique 'Mech ${unique.name}`}>
          <h3>Unique &rsquo;Mech <small>DLC {unique.dlc}</small></h3>
          <MechLink id={unique.mech} name={unique.name} />
          <p>{unique.from <= date ? `Here since ${formatGameDate(unique.from)}` : `Arrives on ${formatGameDate(unique.from)}`}</p>
        </section>
      ))}
      {markets.map(market => (
        <section key={market.id} className={`starmap-market${market.blackMarket ? ' is-black' : ''}`} aria-label={`${describeMarket(market)} market`}>
          <h3>{market.blackMarket ? 'Special black market' : 'Special market'} <small>{market.blackMarket ? `DLC ${market.dlc}` : describeMarket(market)}</small></h3>
          <p className="starmap-market-note">Fixed stock during the DLC {market.dlc} campaign</p>
          {market.mechs.length > 0 && (
            <ul className="starmap-market-mechs">
              {market.mechs.map(mech => <li key={mech.id}><MechLink id={mech.id} name={mech.name} /></li>)}
            </ul>
          )}
          {market.weapons.length > 0 && (
            <details>
              <summary>Weapons ({market.weapons.length})</summary>
              <ul>
                {market.weapons.map((weapon, index) => (
                  <li key={`${weapon.name}-${weapon.tier}-${index}`}>
                    {weapon.name}{weapon.tier && <small> · {weapon.tier}</small>} <b>×{weapon.count}</b>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {market.equipment.length > 0 && (
            <details>
              <summary>Equipment ({market.equipment.length})</summary>
              <ul>
                {market.equipment.map((item, index) => <li key={`${item.name}-${index}`}>{item.name} <b>×{item.count}</b></li>)}
              </ul>
            </details>
          )}
          {market.pilots && (
            <p>
              {market.pilots.count} pilots for hire, skill {market.pilots.minSkill}
              {market.pilots.maxSkill && market.pilots.maxSkill !== market.pilots.minSkill ? ` to ${market.pilots.maxSkill}` : '+'}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

// Lista de los mercados especiales y los 'Mechs únicos. El buscador filtra dónde se vende un 'Mech
// o un arma, o qué hay en un sistema.
export function MarketDrawer({ data, onPick }: { data: StarmapData; onPick: (systemId: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchMarkets(data, query), [data, query]);
  const systemName = (id: number) => data.systems.find(system => system.id === id)?.name ?? '';

  return (
    <section className={`starmap-legend starmap-quests starmap-markets-drawer${isOpen ? ' is-open' : ''}`} aria-label="Special markets">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>
        Special markets <b>{data.markets.length + data.uniqueMechs.length}</b>
      </button>
      {isOpen && (
        <div className="starmap-quests-body">
          <input
            type="search"
            placeholder="'Mech, weapon or system"
            aria-label="Search markets"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <ul>
            {results.map((result, index) => (
              <li key={`${result.market?.id ?? result.unique?.mech}-${index}`}>
                <button type="button" onClick={() => onPick(result.system)}>
                  <span>{systemName(result.system)}</span>
                  <small>
                    {result.unique
                      ? `Unique 'Mech · DLC ${result.unique.dlc} · ${result.unique.name}`
                      : `${describeMarket(result.market!)}${result.market!.blackMarket ? ' · Black market' : ''}`}
                    {result.matches.length > 0 && ` · ${result.matches.slice(0, 2).join(', ')}${result.matches.length > 2 ? '…' : ''}`}
                  </small>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="starmap-quests-empty">Nothing found</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
