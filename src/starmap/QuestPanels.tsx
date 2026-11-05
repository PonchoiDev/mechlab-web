import { Fragment, useMemo, useState, type ReactNode } from 'react';
import type { GameDate, Quest, QuestRequirement, QuestReward, StarmapData } from '../types/starmap';
import { getQuestAvailability, getQuestsForSystem, searchQuests } from '../utils/quests';
import { formatGameDate } from '../utils/starmap';
import { MechLink } from './MarketPanels';

const MODE_NAMES = { campaign: 'Campaign', career: 'Career' } as const;

// Aviso de disponibilidad en la fecha del mapa; nada si se ofrece.
const describeAvailability = (quest: Quest, date: GameDate): string | null => {
  const availability = getQuestAvailability(quest, date);
  if (availability.state === 'upcoming') return `Not offered until ${formatGameDate(availability.date)}`;
  if (availability.state === 'expired') return `No longer offered since ${formatGameDate(availability.date)}`;
  return null;
};

const describeOrigin = (quest: Quest) =>
  quest.dlc ? `DLC ${quest.dlc}` : quest.modes.map(mode => MODE_NAMES[mode]).join(' · ') || 'Base game';

interface QuestDrawerProps {
  data: StarmapData;
  date: GameDate;
  selectedId: string | null;
  onPick: (quest: Quest) => void;
}

// Lista de HRQ con buscador, abajo a la izquierda junto a la leyenda de facciones.
export function QuestDrawer({ data, date, selectedId, onPick }: QuestDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchQuests(data, query), [data, query]);
  const systemName = (id: number) => data.systems.find(system => system.id === id)?.name ?? '';

  return (
    <section className={`starmap-legend starmap-quests${isOpen ? ' is-open' : ''}`} aria-label="High reward quests">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>
        Quests <b>{data.quests.length}</b>
      </button>
      {isOpen && (
        <div className="starmap-quests-body">
          <input
            type="search"
            placeholder="Quest, system or employer"
            aria-label="Search quests"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <ul>
            {results.map(quest => (
              <li key={quest.id}>
                <button
                  type="button"
                  className={describeAvailability(quest, date) ? 'is-unavailable' : undefined}
                  aria-pressed={quest.id === selectedId}
                  onClick={() => onPick(quest)}
                >
                  <span>{quest.name}</span>
                  <small>{systemName(quest.offer)} · {describeOrigin(quest)}</small>
                  {describeAvailability(quest, date) && <small className="starmap-quest-status">{describeAvailability(quest, date)}</small>}
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="starmap-quests-empty">No quests found</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

interface QuestCardProps {
  data: StarmapData;
  quest: Quest;
  date: GameDate;
  onSystem: (systemId: number) => void;
  onQuest: (quest: Quest) => void;
  onClose: () => void;
}

// Una línea por modo: Reputation 10+, From 20 DEC 3023, After Destabilization, Not with…
function Requirement({ requirement, showMode, onQuestName }: { requirement: QuestRequirement; showMode: boolean; onQuestName: (name: string) => void }) {
  const questLink = (name: string) => (
    <button type="button" className="starmap-system-link" onClick={() => onQuestName(name)}>{name}</button>
  );
  const parts: ReactNode[] = [
    requirement.reputation !== null && `Reputation ${requirement.reputation}+`,
    requirement.from && `From ${formatGameDate(requirement.from)}`,
    requirement.until && `Until ${formatGameDate(requirement.until)}`,
    requirement.after && <>After {questLink(requirement.after)}</>,
    ...requirement.excludes.map(name => <>Not with {questLink(name)}</>)
  ].filter(Boolean);
  return (
    <li>
      {showMode && requirement.mode && <b>{MODE_NAMES[requirement.mode]}: </b>}
      {parts.length === 0 ? 'No conditions' : parts.map((part, index) => <Fragment key={index}>{index > 0 && ' · '}{part}</Fragment>)}
    </li>
  );
}

const numberFormat = new Intl.NumberFormat('en');

// Lo que paga la HRQ: C-Bills, reputación, 'Mechs enlazados al MechLab, armas, equipo y texto final.
function Reward({ reward, showMode }: { reward: QuestReward; showMode: boolean }) {
  return (
    <div className="starmap-quest-reward">
      {(showMode || reward.cbills > 0 || reward.reputation > 0) && (
        <p className="starmap-quest-reward-money">
          {showMode && reward.mode && <b>{MODE_NAMES[reward.mode]}: </b>}
          {[
            reward.cbills > 0 && `${numberFormat.format(reward.cbills)} C-Bills`,
            reward.reputation > 0 && `+${numberFormat.format(reward.reputation)} reputation`
          ].filter(Boolean).join(' · ')}
        </p>
      )}
      {reward.mechs.length > 0 && (
        <ul className="starmap-market-mechs">
          {reward.mechs.map((mech, index) => <li key={`${mech.id}-${index}`}><MechLink id={mech.id} name={mech.name} /></li>)}
        </ul>
      )}
      {reward.weapons.length > 0 && (
        <details>
          <summary>Weapons ({reward.weapons.length})</summary>
          <ul>
            {reward.weapons.map(weapon => (
              <li key={`${weapon.name}-${weapon.tier}`}>{weapon.name}{weapon.tier && <small> · {weapon.tier}</small>} <b>×{weapon.count}</b></li>
            ))}
          </ul>
        </details>
      )}
      {reward.equipment.length > 0 && (
        <details>
          <summary>Equipment ({reward.equipment.length})</summary>
          <ul>{reward.equipment.map(item => <li key={item.name}>{item.name} <b>×{item.count}</b></li>)}</ul>
        </details>
      )}
      {reward.debrief && (
        <details>
          <summary>Debrief</summary>
          <p className="starmap-quest-debrief">{reward.debrief}</p>
        </details>
      )}
    </div>
  );
}

export function QuestCard({ data, quest, date, onSystem, onQuest, onClose }: QuestCardProps) {
  const systemName = (id: number) => data.systems.find(system => system.id === id)?.name ?? '';
  const status = describeAvailability(quest, date);
  // Si los modos piden lo mismo, una sola línea sin el modo.
  const sameForAllModes = quest.requirements.every(requirement => JSON.stringify({ ...requirement, mode: null }) === JSON.stringify({ ...quest.requirements[0], mode: null }));
  const requirements = sameForAllModes ? quest.requirements.slice(0, 1) : quest.requirements;
  const openQuest = (name: string) => {
    const found = data.quests.find(candidate => candidate.name === name);
    if (found) onQuest(found);
  };
  return (
    <section className="starmap-panel is-pinned starmap-quest" aria-label={`${quest.name} quest`}>
      <div className="starmap-panel-head">
        <span className="starmap-quest-mark" aria-hidden="true">!</span>
        <div>
          <h2>{quest.name}</h2>
          <p>{describeOrigin(quest)}{quest.employer && ` · ${quest.employer}`}</p>
        </div>
        <button type="button" className="starmap-close" onClick={onClose} aria-label="Close quest details">✕</button>
      </div>
      <dl className="starmap-tags">
        <div className="is-quest">
          <dt>Offered at</dt>
          <dd><button type="button" className="starmap-system-link" onClick={() => onSystem(quest.offer)}>{systemName(quest.offer)}</button></dd>
        </div>
        <div className="is-quest">
          <dt>Requirements</dt>
          <dd>
            <ul className="starmap-quest-requirements">
              {requirements.map(requirement => (
                <Requirement key={requirement.mode ?? 'all'} requirement={requirement} showMode={!sameForAllModes} onQuestName={openQuest} />
              ))}
            </ul>
            {status && <p className="starmap-quest-status">{status}</p>}
          </dd>
        </div>
        {quest.missionTypes.length > 0 && (
          <div>
            <dt>Missions</dt>
            <dd className="starmap-quest-types">{quest.missionTypes.join(' · ')}</dd>
          </div>
        )}
      </dl>
      {quest.rewards.length > 0 && (
        <section className="starmap-quest-rewards starmap-market" aria-label="Rewards">
          <h3>Rewards</h3>
          {quest.rewards.map(reward => <Reward key={reward.mode ?? 'all'} reward={reward} showMode={quest.rewards.length > 1} />)}
        </section>
      )}
      <ol className="starmap-quest-missions" aria-label="Missions">
        {quest.missions.map((mission, index) => (
          <li key={`${mission.title}-${index}`}>
            <span className="starmap-quest-step" aria-hidden="true">{index + 1}</span>
            <div>
              <h3>{mission.title}</h3>
              {mission.summary && <p>{mission.summary}</p>}
              <button type="button" className="starmap-system-link" onClick={() => onSystem(mission.system)}>{systemName(mission.system)}</button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// HRQ que se ofrecen o se juegan en un sistema, dentro de su ficha.
export function SystemQuests({ data, systemId, onPick }: { data: StarmapData; systemId: number; onPick: (quest: Quest) => void }) {
  const { offered, played } = getQuestsForSystem(data, systemId);
  const playedOnly = played.filter(quest => !offered.includes(quest));
  if (offered.length === 0 && playedOnly.length === 0) return null;
  return (
    <dl className="starmap-tags starmap-system-quests">
      {offered.length > 0 && (
        <div className="is-quest">
          <dt>Quests offered</dt>
          <dd>{offered.map(quest => <button key={quest.id} type="button" className="starmap-system-link" onClick={() => onPick(quest)}>{quest.name}</button>)}</dd>
        </div>
      )}
      {playedOnly.length > 0 && (
        <div className="is-quest">
          <dt>Quest missions</dt>
          <dd>{playedOnly.map(quest => <button key={quest.id} type="button" className="starmap-system-link" onClick={() => onPick(quest)}>{quest.name}</button>)}</dd>
        </div>
      )}
    </dl>
  );
}
