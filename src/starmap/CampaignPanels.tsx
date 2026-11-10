import { useMemo, useState } from 'react';
import type { Campaign, CampaignMission, GameDate, StarmapData } from '../types/starmap';
import { getCampaignAvailability, getCampaignsForSystem, searchCampaigns } from '../utils/campaigns';
import { formatGameDate } from '../utils/starmap';
import { MechLink } from './MarketPanels';

const numberFormat = new Intl.NumberFormat('en');
const PILOTS_URL = `${import.meta.env.BASE_URL}pilots/`;

const describeAvailability = (campaign: Campaign, date: GameDate): string | null => {
  const availability = getCampaignAvailability(campaign, date);
  return availability.state === 'upcoming' ? `Not offered until ${formatGameDate(availability.date)}` : null;
};

// Banderín de la ficha, como el del mapa.
function CampaignFlag() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <rect x="5" y="3" width="2.4" height="18" fill="currentColor" />
      <path d="M7.4 3.5 19 7.5 7.4 11.5Z" fill="currentColor" />
    </svg>
  );
}

interface CampaignDrawerProps {
  data: StarmapData;
  date: GameDate;
  selectedId: string | null;
  onPick: (campaign: Campaign) => void;
}

// Lista de campañas con buscador, junto a la de las HRQ.
export function CampaignDrawer({ data, date, selectedId, onPick }: CampaignDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCampaigns(data, query), [data, query]);
  const systemName = (id: number) => data.systems.find(system => system.id === id)?.name ?? '';

  return (
    <section className={`starmap-legend starmap-quests starmap-campaigns${isOpen ? ' is-open' : ''}`} aria-label="DLC campaigns">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>
        Campaigns <b>{data.campaigns.length}</b>
      </button>
      {isOpen && (
        <div className="starmap-quests-body">
          <input
            type="search"
            placeholder="Campaign, system, mission or reward"
            aria-label="Search campaigns"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <ul>
            {results.map(campaign => {
              const status = describeAvailability(campaign, date);
              return (
                <li key={campaign.id}>
                  <button
                    type="button"
                    className={status ? 'is-unavailable' : undefined}
                    aria-pressed={campaign.id === selectedId}
                    onClick={() => onPick(campaign)}
                  >
                    <span>{campaign.name}</span>
                    <small>DLC {campaign.dlc} · {systemName(campaign.start)} · {campaign.missions.length} missions</small>
                    {status && <small className="starmap-quest-status">{status}</small>}
                  </button>
                </li>
              );
            })}
            {results.length === 0 && <li className="starmap-quests-empty">No campaigns found</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

// Piloto que da una misión o una HRQ; los hero, enlazados a la página de pilotos.
export function PilotReward({ pilot }: { pilot: { name: string; hero: boolean } }) {
  if (!pilot.hero) return <><b className="starmap-campaign-pilot">{pilot.name}</b><small> pilot</small></>;
  return (
    <>
      <a className="starmap-campaign-pilot" href={PILOTS_URL} title="Hero pilot: open the Pilots page">{pilot.name}</a>
      <small> hero pilot</small>
    </>
  );
}

// Lo que paga una misión: C-Bills y reputación, 'Mechs, pilotos hero, armas y equipo.
function MissionReward({ mission }: { mission: CampaignMission }) {
  const money = [
    mission.cbills > 0 && `${numberFormat.format(mission.cbills)} C-Bills`,
    mission.reputation > 0 && `+${numberFormat.format(mission.reputation)} reputation`
  ].filter(Boolean).join(' · ');
  const hasItems = mission.weapons.length > 0 || mission.equipment.length > 0;
  return (
    <div className="starmap-campaign-reward">
      {money && <p className="starmap-campaign-money">{money}</p>}
      {(mission.mechs.length > 0 || mission.pilots.length > 0) && (
        <ul className="starmap-campaign-prizes">
          {mission.mechs.map((mech, index) => <li key={`${mech.id}-${index}`}><MechLink id={mech.id} name={mech.name} /></li>)}
          {mission.pilots.map(pilot => <li key={pilot.id}><PilotReward pilot={pilot} /></li>)}
        </ul>
      )}
      {hasItems && (
        <details>
          <summary>Weapons and equipment ({mission.weapons.length + mission.equipment.length})</summary>
          <ul>
            {mission.weapons.map(weapon => (
              <li key={`${weapon.name}-${weapon.tier}`}>{weapon.name}{weapon.tier && <small> · {weapon.tier}</small>} <b>×{weapon.count}</b></li>
            ))}
            {mission.equipment.map(item => <li key={item.name}>{item.name} <b>×{item.count}</b></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

interface CampaignCardProps {
  data: StarmapData;
  campaign: Campaign;
  date: GameDate;
  onSystem: (systemId: number) => void;
  onClose: () => void;
}

export function CampaignCard({ data, campaign, date, onSystem, onClose }: CampaignCardProps) {
  const systemName = (id: number) => data.systems.find(system => system.id === id)?.name ?? '';
  const status = describeAvailability(campaign, date);
  return (
    <section className="starmap-panel is-pinned starmap-quest starmap-campaign" aria-label={`${campaign.name} campaign`}>
      <div className="starmap-panel-head">
        <span className="starmap-quest-mark starmap-campaign-mark"><CampaignFlag /></span>
        <div>
          <h2>{campaign.name}</h2>
          <p>DLC {campaign.dlc} campaign · {campaign.missions.length} missions</p>
        </div>
        <button type="button" className="starmap-close" onClick={onClose} aria-label="Close campaign details">✕</button>
      </div>
      <dl className="starmap-tags">
        <div className="is-quest">
          <dt>Starts at</dt>
          <dd>
            <button type="button" className="starmap-system-link" onClick={() => onSystem(campaign.start)}>{systemName(campaign.start)}</button>
            {campaign.from && <span className="starmap-campaign-from"> from {formatGameDate(campaign.from)}</span>}
            {status && <p className="starmap-quest-status">{status}</p>}
          </dd>
        </div>
      </dl>
      <ol className="starmap-quest-missions" aria-label="Missions">
        {campaign.missions.map((mission, index) => (
          <li key={`${mission.title}-${index}`}>
            <span className="starmap-quest-step" aria-hidden="true">{index + 1}</span>
            <div>
              <h3>{mission.title}</h3>
              {mission.summary && <p>{mission.summary}</p>}
              <button type="button" className="starmap-system-link" onClick={() => onSystem(mission.system)}>{systemName(mission.system)}</button>
              {mission.employer && <small className="starmap-campaign-employer"> · {mission.employer}</small>}
              <MissionReward mission={mission} />
            </div>
          </li>
        ))}
      </ol>
      {campaign.completion && (
        <section className="starmap-quest-rewards starmap-market starmap-campaign-completion" aria-label="Campaign complete">
          <h3>Campaign complete</h3>
          <p className="starmap-quest-reward-money">{campaign.completion.title}</p>
          <ul className="starmap-market-mechs">
            {campaign.completion.mechs.map(mech => <li key={mech.id}><MechLink id={mech.id} name={mech.name} /></li>)}
          </ul>
        </section>
      )}
    </section>
  );
}

// Campañas que empiezan o pasan por un sistema, dentro de su ficha.
export function SystemCampaigns({ data, systemId, onPick }: { data: StarmapData; systemId: number; onPick: (campaign: Campaign) => void }) {
  const { starting, played } = getCampaignsForSystem(data, systemId);
  const playedOnly = played.filter(campaign => !starting.includes(campaign));
  if (starting.length === 0 && playedOnly.length === 0) return null;
  const link = (campaign: Campaign) => (
    <button key={campaign.id} type="button" className="starmap-system-link" onClick={() => onPick(campaign)}>{campaign.name}</button>
  );
  return (
    <dl className="starmap-tags starmap-system-quests starmap-system-campaigns">
      {starting.length > 0 && (
        <div className="is-quest">
          <dt>Campaign starts</dt>
          <dd>{starting.map(link)}</dd>
        </div>
      )}
      {playedOnly.length > 0 && (
        <div className="is-quest">
          <dt>Campaign missions</dt>
          <dd>{playedOnly.map(link)}</dd>
        </div>
      )}
    </dl>
  );
}
