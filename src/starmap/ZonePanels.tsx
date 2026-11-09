import type { StarmapData, ZoneLevel } from '../types/starmap';
import { describeMultiMission, describeRepair, getArena } from '../utils/clusters';
import { getClusterLevels } from '../utils/starmap';
import { MechLink } from './MarketPanels';

const MODE_NAMES = { campaign: 'Campaign', career: 'Career' } as const;
const numberFormat = new Intl.NumberFormat('en');

// Reputación recomendada (en amarillo, para encontrarla de un vistazo) y dificultad de un nivel.
export function ZoneLevelText({ level }: { level: ZoneLevel }) {
  return (
    <>
      {level.reputation && <span className="starmap-level-reputation">Recommended reputation {level.reputation}</span>}
      {level.reputation && level.difficulty !== null && ' · '}
      {level.difficulty !== null && `Difficulty ${level.difficulty}`}
    </>
  );
}

// Reputación recomendada y dificultad, una línea por modo (el modo solo si hay más de uno), con el
// recargo de reparación y los contratos de varias misiones debajo.
export function ZoneLevels({ levels }: { levels: ZoneLevel[] }) {
  if (levels.length === 0) return null;
  return (
    <ul className="starmap-zone-levels">
      {levels.map((level, index) => (
        // Dos niveles del mismo modo pueden coincidir en reputación y dificultad: la posición los distingue.
        <li key={index}>
          {level.mode && levels.length > 1 && <b>{MODE_NAMES[level.mode]}: </b>}
          <ZoneLevelText level={level} />
          {/* El recargo encarece y alarga las reparaciones: va en rojo, como penalización. */}
          {level.repair && <small className="starmap-level-penalty">{describeRepair(level.repair)}</small>}
          {level.multiMission && <small>{describeMultiMission(level.multiMission)}</small>}
        </li>
      ))}
    </ul>
  );
}

interface ZoneCardProps {
  data: StarmapData;
  clusterId: string;
  onSystem: (systemId: number) => void;
  onClose: () => void;
}

// Ficha de una zona de conflicto, al pulsar dentro de ella: descripción, capital y lo que pide.
export function ZoneCard({ data, clusterId, onSystem, onClose }: ZoneCardProps) {
  const zone = data.clusters[clusterId];
  if (!zone) return null;
  const systems = data.systems.filter(system => system.cluster === clusterId).length;
  const capital = zone.capital === undefined ? null : data.systems.find(system => system.id === zone.capital) ?? null;
  return (
    <section className="starmap-panel is-pinned starmap-zone" aria-label={`${zone.name} conflict zone`}>
      <div className="starmap-panel-head">
        <span className="starmap-zone-mark" aria-hidden="true" />
        <div>
          <h2>{zone.name}</h2>
          <p>Conflict zone · {systems === 1 ? '1 system' : `${systems} systems`}</p>
        </div>
        <button type="button" className="starmap-close" onClick={onClose} aria-label="Close zone details">✕</button>
      </div>
      <dl className="starmap-tags">
        <div>
          <dt>Recommended reputation</dt>
          <dd><ZoneLevels levels={getClusterLevels(data, clusterId)} /></dd>
        </div>
        {capital && (
          <div>
            <dt>Capital</dt>
            <dd><button type="button" className="starmap-system-link" onClick={() => onSystem(capital.id)}>{capital.name}</button></dd>
          </div>
        )}
      </dl>
      {zone.description && <p className="starmap-zone-description">{zone.description}</p>}
    </section>
  );
}

// Arena del sistema (DLC6), dentro de su ficha, con los rangos de fama desplegables.
export function SystemArena({ data, systemId }: { data: StarmapData; systemId: number }) {
  const arena = getArena(data, systemId);
  if (!arena) return null;
  const features = [
    arena.special && 'Special arena matches',
    arena.blackMarket && 'Black market',
    arena.mercEncounters && 'Mercenary encounters'
  ].filter(Boolean);
  return (
    <section className="starmap-market starmap-arena" aria-label="Arena">
      <h3>Arena <small>DLC 6</small></h3>
      {features.length > 0 && <p className="starmap-market-note">{features.join(' · ')}</p>}
      <details>
        <summary>Fame ranks ({data.arenas.ranks.length})</summary>
        <ol className="starmap-arena-ranks">
          {data.arenas.ranks.map(rank => (
            <li key={rank.level}>
              <b>{rank.name}</b> <small>{numberFormat.format(rank.points)} fame</small>
              <span>
                {[
                  rank.reward.cbills > 0 && `${numberFormat.format(rank.reward.cbills)} C-Bills`,
                  ...rank.reward.weapons.map(weapon => `${weapon.name}${weapon.tier ? ` (${weapon.tier})` : ''}`),
                  ...rank.reward.equipment.map(item => item.name)
                ].filter(Boolean).join(' · ')}
              </span>
              {rank.reward.mechs.map(mech => <MechLink key={mech.id} id={mech.id} name={mech.name} />)}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
