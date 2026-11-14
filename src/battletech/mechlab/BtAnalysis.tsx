import type { BtSummary } from '../../utils/battletech/stats';
import { ZONE_LABELS } from '../../utils/zones';
import { HARDPOINT_LABELS } from '../../utils/battletech/mechlabData';

const formatNumber = (value: number) => String(Number(value.toFixed(2)));

// Análisis del equipo: armas, daño por distancia, munición y bonificaciones del equipo.
export function BtAnalysis({ summary }: { summary: BtSummary }) {
  const peak = Math.max(1, ...summary.rangeProfile.map(entry => entry.damage + entry.belowMin));

  return (
    <section className="loadout-analysis bt-analysis" aria-label="Loadout analysis">
      <div className="bt-analysis-block bt-analysis-weapons">
        <div className="analysis-heading"><h2>Weapons</h2></div>
        {summary.weapons.length === 0 ? (
          <p className="analysis-note">No weapons mounted.</p>
        ) : (
          <div className="bt-table-scroll">
            <table className="weapon-table bt-weapon-table">
              <thead>
                <tr>
                  <th scope="col">Weapon</th>
                  <th scope="col">Where</th>
                  <th scope="col" title="Damage per attack, for all of them">Damage</th>
                  <th scope="col" title="Heat per attack, for all of them">Heat</th>
                  <th scope="col" title="Stability damage per attack, for all of them">Stab</th>
                  <th scope="col">Range</th>
                </tr>
              </thead>
              <tbody>
                {summary.weapons.map(line => (
                  <tr key={line.item.id} data-hardpoint={line.item.hardpoint}>
                    <td>
                      {line.count > 1 && <span className="bt-count">{line.count}×</span>}
                      {line.item.name}
                      <small>{HARDPOINT_LABELS[line.item.hardpoint!]}</small>
                    </td>
                    <td>{line.zones.map(zone => ZONE_LABELS[zone]).join(', ')}</td>
                    <td>{formatNumber(line.damage * line.count)}</td>
                    <td>{formatNumber(line.heat * line.count)}</td>
                    <td>{formatNumber(line.instability * line.count)}</td>
                    <td>{line.item.weapon!.minRange > 0 ? `${line.item.weapon!.minRange}-` : ''}{line.item.weapon!.maxRange} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bt-analysis-block">
        <div className="analysis-heading"><h2>Damage by range</h2></div>
        <ul className="bt-range-profile">
          {summary.rangeProfile.map(entry => (
            <li key={entry.distance}>
              <span className="bt-range-distance">{entry.distance} m</span>
              <span className="bt-range-bar" aria-hidden="true">
                <span className="bt-range-fill" style={{ width: `${(entry.damage / peak) * 100}%` }} />
                <span className="bt-range-fill is-below-min" style={{ width: `${(entry.belowMin / peak) * 100}%` }} />
              </span>
              <span className="bt-range-value">
                {formatNumber(entry.damage)}
                {entry.belowMin > 0 && <small title="Weapons under their minimum range fire with an accuracy penalty"> +{formatNumber(entry.belowMin)} min</small>}
              </span>
            </li>
          ))}
        </ul>
        <p className="analysis-note">Damage of the weapons that reach each distance. Amber is damage from weapons under their minimum range, which fire with an accuracy penalty.</p>
      </div>

      <div className="bt-analysis-block">
        <div className="analysis-heading"><h2>Ammo</h2></div>
        {summary.ammo.length === 0 ? (
          <p className="analysis-note">No weapons use ammo.</p>
        ) : (
          <ul className="bt-ammo-list">
            {summary.ammo.map(line => (
              <li key={line.category} className={line.weapons > 0 && line.rounds === 0 ? 'ammunition-row is-missing' : 'ammunition-row'}>
                <strong>{line.label}</strong>
                <span>
                  {line.weapons > 0
                    ? `${line.attacks} ${line.attacks === 1 ? 'attack' : 'attacks'}`
                    : 'No weapon uses it'}
                </span>
                <small>
                  {line.rounds} rounds · {line.boxes} {line.boxes === 1 ? 'box' : 'boxes'}{line.perAttack > 0 ? ` · ${line.perAttack} per attack` : ''}
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bt-analysis-block">
        <div className="analysis-heading"><h2>Equipment bonuses</h2></div>
        {summary.bonuses.length === 0 ? (
          <p className="analysis-note">No equipment with bonuses.</p>
        ) : (
          <ul className="bt-bonus-list">
            {summary.bonuses.map(line => (
              <li key={line.item.id}>
                <strong>{line.count > 1 ? `${line.count}× ` : ''}{line.item.name}{line.fixed ? ' (built-in)' : ''}</strong>
                <span>{line.item.bonuses.join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
