import type { Mech } from '../types/mech';
import { truncateTo, type BuildSummary } from '../utils/calculators';

interface StatsReadoutProps {
  mech: Mech;
  summary: BuildSummary;
}

export function StatsReadout({ mech, summary }: StatsReadoutProps) {
  const {
    totalWeight,
    armorPoints,
    maxArmorPoints,
    armorWeight,
    topSpeed,
    boostedSpeed,
    jumpJetCount,
    firepower,
    meleeDamage,
    heatSpike,
    coolingRate,
    maxWeaponRange
  } = summary;

  return (
    <section className="readout-strip" aria-label="Mech statistics">
      <div className="readout-cell">
        <span className="readout-label">TONNAGE</span>
        <strong className={totalWeight > mech.tonnageMax ? 'readout-warning' : ''}>
          {truncateTo(totalWeight, 2).toFixed(2)} <small>/ {mech.tonnageMax} t</small>
        </strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">ARMOR POINTS</span>
        <strong>{armorPoints.toFixed(0)} <small>/ {maxArmorPoints.toFixed(0)}</small></strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">ARMOR MASS</span>
        <strong>{truncateTo(armorWeight, 2).toFixed(2)} <small>t</small></strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">TOP SPEED</span>
        <strong>
          {topSpeed.toFixed(1)} <small>km/h{boostedSpeed !== null && ` · ${boostedSpeed.toFixed(1)} boost`}</small>
        </strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">JUMP JETS</span>
        <strong>{jumpJetCount}</strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">VOLLEY DAMAGE</span>
        <strong>{firepower}</strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label" title="Melee weapons and punches from empty hands, lower arms and fists">MELEE DAMAGE</span>
        <strong>{meleeDamage}</strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">HEAT SPIKE</span>
        <strong>{heatSpike}</strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">TOTAL COOLING RATE</span>
        <strong>{coolingRate === null ? 'N/A' : <>{coolingRate.toFixed(1)} <small>heat/s</small></>}</strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">MAX WEAPON RANGE</span>
        <strong>{maxWeaponRange > 0 ? `${maxWeaponRange.toFixed(0)} m` : '—'}</strong>
      </div>
    </section>
  );
}
