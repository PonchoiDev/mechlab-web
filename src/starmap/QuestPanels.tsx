import { useMemo, useState } from 'react';
import type { Quest, StarmapData } from '../types/starmap';
import { getQuestsForSystem, searchQuests } from '../utils/quests';

const MODE_NAMES = { campaign: 'Campaign', career: 'Career' } as const;

const describeOrigin = (quest: Quest) =>
  quest.dlc ? `DLC ${quest.dlc}` : quest.modes.map(mode => MODE_NAMES[mode]).join(' · ') || 'Base game';

interface QuestDrawerProps {
  data: StarmapData;
  selectedId: string | null;
  onPick: (quest: Quest) => void;
}

// Lista de HRQ con buscador, abajo a la izquierda junto a la leyenda de facciones.
export function QuestDrawer({ data, selectedId, onPick }: QuestDrawerProps) {
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
                <button type="button" aria-pressed={quest.id === selectedId} onClick={() => onPick(quest)}>
                  <span>{quest.name}</span>
                  <small>{systemName(quest.offer)} · {describeOrigin(quest)}</small>
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
  onSystem: (systemId: number) => void;
  onClose: () => void;
}

// Ficha de la HRQ elegida, en el mismo sitio que la del sistema.
export function QuestCard({ data, quest, onSystem, onClose }: QuestCardProps) {
  const systemName = (id: number) => data.systems.find(system => system.id === id)?.name ?? '';
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
        {quest.missionTypes.length > 0 && (
          <div>
            <dt>Missions</dt>
            <dd className="starmap-quest-types">{quest.missionTypes.join(' · ')}</dd>
          </div>
        )}
      </dl>
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
