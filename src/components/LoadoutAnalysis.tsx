import { useState } from 'react';
import type { Mech } from '../types/mech';
import { formatArmorPoints, formatCoolingRate, formatTurnRate, type BuildSummary } from '../utils/calculators';
import { ZONE_LABELS } from '../utils/zones';
import { UpgradedValue } from './UpgradedValue';

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`;
};

// Número con hasta dos decimales, sin ceros de más (8.97, 18.5, 66).
const formatNumber = (value: number, decimals = 2) => String(Number(value.toFixed(decimals)));

type Tab = 'weapons' | 'mech';

interface LoadoutAnalysisProps {
  mech: Mech;
  summary: BuildSummary;
  // Resumen sin las mejoras de la cantina, si hay alguna instalada.
  base?: BuildSummary;
}

export function LoadoutAnalysis({ mech, summary, base }: LoadoutAnalysisProps) {
  const [tab, setTab] = useState<Tab>('weapons');

  return (
    <section className="loadout-analysis" aria-label="Loadout performance">
      <div className="analysis-tabs" role="tablist" aria-label="Statistics">
        <button type="button" role="tab" className="analysis-tab" aria-selected={tab === 'weapons'} onClick={() => setTab('weapons')}>
          Weapons
        </button>
        <button type="button" role="tab" className="analysis-tab" aria-selected={tab === 'mech'} onClick={() => setTab('mech')}>
          'Mech
        </button>
        {base && <span className="analysis-note">GREEN ▲ VALUES INCLUDE CANTINA UPGRADES</span>}
      </div>
      {tab === 'weapons'
        ? <WeaponsTab summary={summary} base={base} />
        : <MechTab mech={mech} summary={summary} base={base} />}
    </section>
  );
}

function WeaponsTab({ summary, base }: { summary: BuildSummary; base?: BuildSummary }) {
  const { weapons, ammunition } = summary;
  // Mismo loadout con y sin mejoras: las armas van en el mismo orden.
  const cell = (index: number, format: (weapon: BuildSummary['weapons'][number]) => string) => (
    <UpgradedValue value={format(weapons[index])} base={base && format(base.weapons[index])} />
  );
  const total = (format: (values: BuildSummary) => string) => <UpgradedValue value={format(summary)} base={base && format(base)} />;

  return (
    <div className="analysis-body">
      <div className="analysis-table-wrap">
        <header className="analysis-heading">
          <div>
            <p className="eyebrow">05 / COMBAT DATA</p>
            <h2>Weapon performance</h2>
          </div>
          <span className="analysis-note">NOMINAL DPS = DAMAGE × RPM / 60</span>
        </header>
        {weapons.length > 0 ? (
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
                  <th>Max range</th>
                  <th>Velocity</th>
                </tr>
              </thead>
              <tbody>
                {weapons.map(({ item, zone }, index) => (
                  <tr key={`${item.id}-${zone}-${index}`}>
                    <td>{item.name}</td>
                    <td>{ZONE_LABELS[zone]}</td>
                    <td>{cell(index, weapon => formatNumber(weapon.damage))}</td>
                    <td>{cell(index, weapon => formatNumber(weapon.heat))}</td>
                    <td>{cell(index, weapon => weapon.rpm > 0 ? weapon.rpm.toFixed(1) : '—')}</td>
                    <td>{cell(index, weapon => weapon.dps > 0 ? weapon.dps.toFixed(1) : '—')}</td>
                    <td>{cell(index, weapon => weapon.range !== null ? `${weapon.range.toFixed(0)} m` : '—')}</td>
                    <td>{cell(index, weapon => weapon.maxRange !== null ? `${weapon.maxRange.toFixed(0)} m` : '—')}</td>
                    <td>{cell(index, weapon => weapon.speed !== null ? `${weapon.speed.toFixed(0)} m/s` : '—')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>ranged weapons</td>
                  <td>{total(values => values.firepower.toFixed(1))}</td>
                  <td>{total(values => values.heatSpike.toFixed(1))}</td>
                  <td>—</td>
                  <td>{total(values => values.dps.toFixed(1))}</td>
                  <td colSpan={3}>{total(values => formatNumber(values.heatPerSecond, 1))} <small>heat/s while firing</small></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="analysis-empty">No weapons installed.</p>
        )}
      </div>
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
    </div>
  );
}

interface MechStat {
  label: string;
  format: (values: BuildSummary) => string;
  unit?: string;
}

const optional = (value: number | null, format: (value: number) => string) => value === null ? '—' : format(value);

// Resumen como el de la pantalla Mejoras del juego, agrupado con las mismas categorías que las mejoras.
const MECH_STATS: { title: string; stats: MechStat[] }[] = [
  {
    title: 'DEFENSE',
    stats: [
      { label: 'Armor', format: values => `${formatArmorPoints(values.armorPoints)} / ${formatArmorPoints(values.maxArmorPoints)}` },
      { label: 'Structure', format: values => formatArmorPoints(values.structurePoints) }
    ]
  },
  {
    title: 'FIREPOWER',
    stats: [
      { label: 'Volley damage', format: values => String(values.firepower) },
      { label: 'Melee damage', format: values => String(values.meleeDamage) },
      { label: 'Nominal DPS', format: values => values.dps.toFixed(1) },
      { label: 'Max weapon range', format: values => values.maxWeaponRange > 0 ? String(Math.floor(values.maxWeaponRange)) : '—', unit: 'm' }
    ]
  },
  {
    title: 'HEAT',
    stats: [
      { label: 'Cooling rate', format: values => optional(values.coolingRate, formatCoolingRate), unit: 'heat/s' },
      { label: 'Heat capacity', format: values => optional(values.heatCapacity, value => formatNumber(value)) },
      { label: 'Heat spike', format: values => String(values.heatSpike) },
      { label: 'Heat while firing', format: values => formatNumber(values.heatPerSecond, 1), unit: 'heat/s' },
      { label: 'Heat generation', format: values => `× ${formatNumber(values.heatGeneration)}` }
    ]
  },
  {
    title: 'MOBILITY',
    stats: [
      { label: 'Top speed', format: values => values.topSpeed.toFixed(1), unit: 'km/h' },
      { label: 'Boosted speed', format: values => optional(values.boostedSpeed, value => value.toFixed(1)), unit: 'km/h' },
      { label: 'Turn speed', format: values => optional(values.turnSpeed, formatTurnRate), unit: '°/s' },
      { label: 'Torso twist, yaw', format: values => optional(values.torsoYaw, formatTurnRate), unit: '°/s' },
      { label: 'Torso twist, pitch', format: values => optional(values.torsoPitch, formatTurnRate), unit: '°/s' },
      { label: 'Jump jets', format: values => String(values.jumpJetCount) }
    ]
  },
  {
    title: 'TARGETING',
    stats: [
      { label: 'Sensor range', format: values => formatNumber(values.sensorRange, 0), unit: 'm' },
      { label: 'Lock retention time', format: values => formatNumber(values.lockRetentionTime), unit: 's' },
      { label: 'Lose lock time', format: values => formatNumber(values.loseLockTime), unit: 's' }
    ]
  }
];

function MechTab({ mech, summary, base }: { mech: Mech; summary: BuildSummary; base?: BuildSummary }) {
  return (
    <div className="analysis-table-wrap">
      <header className="analysis-heading">
        <div>
          <p className="eyebrow">05 / CHASSIS DATA</p>
          <h2>{mech.name} {mech.variant}</h2>
        </div>
      </header>
      <div className="mech-stats">
        {MECH_STATS.map(group => (
          <section key={group.title} className="mech-stats-group">
            <h3>{group.title}</h3>
            <dl>
              {group.stats.map(stat => (
                <div key={stat.label} className="mech-stat">
                  <dt>{stat.label}</dt>
                  <dd>
                    <UpgradedValue value={stat.format(summary)} base={base && stat.format(base)} />
                    {stat.unit && stat.format(summary) !== '—' && <small> {stat.unit}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
