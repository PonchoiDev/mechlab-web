import type { Mech } from '../types/mech';
import { formatArmorPoints, formatCoolingRate, truncateTo, type BuildSummary } from '../utils/calculators';

interface StatsReadoutProps {
  mech: Mech;
  summary: BuildSummary;
  // Resumen sin las mejoras de la cantina, si hay alguna instalada.
  base?: BuildSummary;
}

// Con mejoras, el valor sin ellas y, en verde, el mejorado (como el mechlab del juego: 76,6 ▲ 78,2).
function Upgraded({ value, base }: { value: string; base?: string }) {
  if (base === undefined || base === value) return <>{value}</>;
  return <>{base} <span className="readout-upgraded">▲ {value}</span></>;
}

export function StatsReadout({ mech, summary, base }: StatsReadoutProps) {
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
  const formatArmor = formatArmorPoints;
  const formatCooling = (rate: number | null) => rate === null ? 'N/A' : formatCoolingRate(rate);
  const formatRange = (range: number) => range > 0 ? `${Math.floor(range)} m` : '—';

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
        <strong>
          <Upgraded value={formatArmor(armorPoints)} base={base && formatArmor(base.armorPoints)} />
          {' '}<small>/ {formatArmor(maxArmorPoints)}</small>
        </strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">ARMOR MASS</span>
        <strong>{truncateTo(armorWeight, 2).toFixed(2)} <small>t</small></strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">TOP SPEED</span>
        <strong>
          <Upgraded value={topSpeed.toFixed(1)} base={base?.topSpeed.toFixed(1)} />
          {' '}<small>km/h{boostedSpeed !== null && ` · ${boostedSpeed.toFixed(1)} boost`}</small>
        </strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">JUMP JETS</span>
        <strong>{jumpJetCount}</strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">VOLLEY DAMAGE</span>
        <strong><Upgraded value={String(firepower)} base={base && String(base.firepower)} /></strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label" title="Melee weapons and punches from empty hands, lower arms and fists">MELEE DAMAGE</span>
        <strong><Upgraded value={String(meleeDamage)} base={base && String(base.meleeDamage)} /></strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">HEAT SPIKE</span>
        <strong>{heatSpike}</strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">TOTAL COOLING RATE</span>
        <strong>
          <Upgraded value={formatCooling(coolingRate)} base={base && formatCooling(base.coolingRate)} />
          {coolingRate !== null && <> <small>heat/s</small></>}
        </strong>
      </div>
      <div className="readout-cell">
        <span className="readout-label">MAX WEAPON RANGE</span>
        <strong><Upgraded value={formatRange(maxWeaponRange)} base={base && formatRange(base.maxWeaponRange)} /></strong>
      </div>
    </section>
  );
}
