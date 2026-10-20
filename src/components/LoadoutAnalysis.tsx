import type { AmmunitionGroup, WeaponPerformance } from '../utils/calculators';
import { ZONE_LABELS } from '../utils/zones';

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`;
};

interface LoadoutAnalysisProps {
  weapons: WeaponPerformance[];
  ammunition: AmmunitionGroup[];
}

export function LoadoutAnalysis({ weapons, ammunition }: LoadoutAnalysisProps) {
  if (weapons.length === 0 && ammunition.length === 0) return null;

  return (
    <section className="loadout-analysis" aria-label="Loadout performance">
      {weapons.length > 0 && (
        <div className="analysis-table-wrap">
          <header className="analysis-heading">
            <div>
              <p className="eyebrow">05 / COMBAT DATA</p>
              <h2>Weapon performance</h2>
            </div>
            <span className="analysis-note">NOMINAL DPS = DAMAGE × RPM / 60</span>
          </header>
          <div className="analysis-overflow">
            <table className="weapon-table">
              <thead>
                <tr>
                  <th>Weapon</th>
                  <th>Section</th>
                  <th>Volley damage</th>
                  <th>Heat</th>
                  <th>RPM</th>
                  <th>Nominal DPS</th>
                  <th>Range</th>
                </tr>
              </thead>
              <tbody>
                {weapons.map(({ item, zone, damage, heat, rpm, dps, range }, index) => (
                  <tr key={`${item.id}-${zone}-${index}`}>
                    <td>{item.name}</td>
                    <td>{ZONE_LABELS[zone]}</td>
                    <td>{damage.toFixed(1)}</td>
                    <td>{heat.toFixed(1)}</td>
                    <td>{rpm > 0 ? rpm.toFixed(1) : '—'}</td>
                    <td>{dps > 0 ? dps.toFixed(1) : '—'}</td>
                    <td>{range !== null ? `${range.toFixed(0)} m` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {ammunition.length > 0 && (
        <div className="ammunition-list">
          <header className="analysis-heading">
            <div>
              <p className="eyebrow">STORES</p>
              <h2>Installed ammunition</h2>
            </div>
          </header>
          {ammunition.map(({ ammoType, label, capacity, bins, volleys, seconds }) => (
            <div className="ammunition-row" key={ammoType}>
              <span>{label}<small>{bins} {bins === 1 ? 'bin' : 'bins'}</small></span>
              <span className="ammunition-amount">
                <strong>{capacity} rounds</strong>
                <small>
                  {volleys === null
                    ? 'no weapon uses it'
                    : `${volleys} ${volleys === 1 ? 'volley' : 'volleys'}${seconds !== null ? ` · ${formatDuration(seconds)} of fire` : ''}`}
                </small>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
