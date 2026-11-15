import { useState } from 'react';
import type { BtBuild } from '../../types/battletech-mechlab';
import { EMPTY_VALUE } from '../../utils/format';
import { ZONE_KEYS, ZONE_LABELS } from '../../utils/zones';
import { getZoneItems } from '../../utils/battletech/fitting';
import type { BtSummary } from '../../utils/battletech/stats';
import { getRangeRadar, type RangeProfileEntry } from '../../utils/battletech/rangeRadar';

const formatNumber = (value: number) => String(Number(value.toFixed(2)));

const RADAR_RADIUS = 300;
// Radios del radar cada 30°, como las líneas de un campo de tiro.
const RADAR_SPOKES = [30, 60, 90, 120, 150];

// El daño por alcance como un campo de tiro: el 'Mech abajo en el centro y un anillo cada 90 m, más
// intenso cuanto más daño llega a esa distancia. Lo de las armas por debajo de su alcance mínimo va rayado
// en ámbar. Los anillos y su intensidad salen de getRangeRadar.
function RangeRadar({ profile }: { profile: RangeProfileEntry[] }) {
  const { radius, bands } = getRangeRadar(profile, RADAR_RADIUS);
  const center = radius;
  const reach = bands.filter(band => band.damage + band.belowMin > 0).at(-1)?.distance ?? 0;
  return (
    <svg
      className="bt-range-radar"
      viewBox={`-16 -14 ${radius * 2 + 32} ${radius + 46}`}
      role="img"
      aria-label={`Damage by range: ${bands.map(band => `${band.distance} m ${formatNumber(band.damage)}${band.belowMin > 0 ? ` plus ${formatNumber(band.belowMin)} under minimum range` : ''}`).join(', ')}`}
    >
      <defs>
        <pattern id="bt-radar-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" className="bt-radar-hatch" />
        </pattern>
      </defs>
      {bands.map(band => (
        <g key={band.distance}>
          <path d={band.path} className="bt-radar-band" />
          {band.intensity > 0 && <path d={band.path} className="bt-radar-fill" style={{ fillOpacity: 0.1 + 0.75 * band.intensity }} />}
          {band.belowMinIntensity > 0 && <path d={band.path} fill="url(#bt-radar-hatch)" style={{ opacity: 0.35 + 0.65 * band.belowMinIntensity }} />}
          <title>{`${band.distance} m: ${formatNumber(band.damage)} damage${band.belowMin > 0 ? `, +${formatNumber(band.belowMin)} under minimum range` : ''}`}</title>
        </g>
      ))}
      {RADAR_SPOKES.map(angle => {
        const radians = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            className="bt-radar-spoke"
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(radians)}
            y2={center - radius * Math.sin(radians)}
          />
        );
      })}
      {bands.map(band => {
        const y = center - (band.inner + band.outer) / 2;
        if (band.damage + band.belowMin === 0) return null;
        return (
          <text key={band.distance} className="bt-radar-value" x={center} y={y + 4} textAnchor="middle">
            {formatNumber(band.damage)}
            {band.belowMin > 0 && <tspan className="bt-radar-min"> +{formatNumber(band.belowMin)}</tspan>}
          </text>
        );
      })}
      <line className="bt-radar-base" x1={0} y1={center} x2={radius * 2} y2={center} />
      {bands.map(band => (
        <text key={band.distance} className={band.distance <= reach ? 'bt-radar-distance is-in-reach' : 'bt-radar-distance'} x={center + band.outer} y={center + 16} textAnchor="middle">
          {band.distance}
        </text>
      ))}
      <text className="bt-radar-distance" x={center - radius} y={center + 16} textAnchor="start">m</text>
      <path className="bt-radar-mech" d={`M ${center} ${center - 12} L ${center + 8} ${center} L ${center - 8} ${center} Z`} />
    </svg>
  );
}

type Tab = 'weapons' | 'mech';

// Análisis con las pestañas y el marcado del LoadoutAnalysis de MW5: Weapons (tabla de armas, munición
// y, propio de BATTLETECH, el daño por distancia) y 'Mech (cifras agrupadas, con el equipo que da bonificaciones).
export function BtAnalysis({ build, summary }: { build: BtBuild; summary: BtSummary }) {
  const [tab, setTab] = useState<Tab>('weapons');
  return (
    <section className="loadout-analysis" aria-label="Loadout performance">
      <div className="analysis-tabs" role="group" aria-label="Statistics">
        <button type="button" className="analysis-tab" aria-pressed={tab === 'weapons'} onClick={() => setTab('weapons')}>Weapons</button>
        <button type="button" className="analysis-tab" aria-pressed={tab === 'mech'} onClick={() => setTab('mech')}>'Mech</button>
      </div>
      {tab === 'weapons' ? <WeaponsTab build={build} summary={summary} /> : <MechTab build={build} summary={summary} />}
    </section>
  );
}

function WeaponsTab({ build, summary }: { build: BtBuild; summary: BtSummary }) {
  const lines = new Map(summary.weapons.map(line => [line.item.id, line]));
  // Una fila por arma montada, como en MW5, con las cifras de su línea del resumen.
  const rows = ZONE_KEYS.flatMap(zone => getZoneItems(build.loadout, zone)
    .filter(item => item.weapon)
    .map(item => ({ item, zone, line: lines.get(item.id)! })));

  return (
    <div className="analysis-body">
      <div className="analysis-table-wrap">
        <header className="analysis-heading">
          <div>
            <p className="eyebrow">05 / COMBAT DATA</p>
            <h2>Weapon performance</h2>
          </div>
          <span className="analysis-note">DAMAGE AND HEAT PER ATTACK</span>
        </header>
        {rows.length > 0 ? (
          <div className="analysis-overflow">
            <table className="weapon-table">
              <thead>
                <tr>
                  <th>Weapon</th>
                  <th>Section</th>
                  <th>Damage</th>
                  <th>Stability</th>
                  <th>Heat</th>
                  <th>Min range</th>
                  <th>Max range</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, zone, line }, index) => (
                  <tr key={`${item.id}-${zone}-${index}`}>
                    <td>{item.name}</td>
                    <td>{ZONE_LABELS[zone]}</td>
                    <td>{formatNumber(line.damage)}</td>
                    <td>{formatNumber(line.instability)}</td>
                    <td>{formatNumber(line.heat)}</td>
                    <td>{item.weapon!.minRange > 0 ? `${item.weapon!.minRange} m` : EMPTY_VALUE}</td>
                    <td>{item.weapon!.maxRange} m</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>alpha strike</td>
                  <td>{formatNumber(summary.alphaDamage)}</td>
                  <td>{formatNumber(summary.instability)}</td>
                  <td>{formatNumber(summary.heat.alpha)}</td>
                  <td colSpan={2}>{summary.heat.dissipation} <small>heat sinking per turn</small></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="analysis-empty">No weapons installed.</p>
        )}

        <header className="analysis-heading bt-range-heading">
          <div>
            <p className="eyebrow">RANGE</p>
            <h2>Damage by range</h2>
          </div>
          <span className="analysis-note">AMBER STRIPES: UNDER MINIMUM RANGE, WITH AN ACCURACY PENALTY</span>
        </header>
        <RangeRadar profile={summary.rangeProfile} />
      </div>
      {summary.ammo.length > 0 && (
        <div className="ammunition-list">
          <header className="analysis-heading">
            <div>
              <p className="eyebrow">STORES</p>
              <h2>Installed ammunition</h2>
            </div>
          </header>
          {summary.ammo.map(line => (
            <div className="ammunition-row" key={line.category}>
              <span>{line.label}<small>{line.boxes} {line.boxes === 1 ? 'box' : 'boxes'}</small></span>
              <span className="ammunition-amount">
                <strong>{line.rounds} rounds</strong>
                <small>
                  {line.weapons === 0
                    ? 'no weapon uses it'
                    : line.rounds === 0
                      ? 'no ammo'
                      : `${line.attacks} ${line.attacks === 1 ? 'attack' : 'attacks'} · ${line.perAttack} per attack`}
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
  value: string;
  unit?: string;
}

function MechTab({ build, summary }: { build: BtBuild; summary: BtSummary }) {
  const { mech } = build;
  // Las cifras del 'Mech agrupadas como en la pestaña 'Mech de MW5, con las de BATTLETECH.
  const groups: { title: string; stats: MechStat[] }[] = [
    {
      title: 'DEFENSE',
      stats: [
        { label: 'Armor', value: `${summary.armorPoints} / ${summary.maxArmorPoints}` },
        { label: 'Structure', value: String(summary.structure) },
        { label: 'Stability', value: String(summary.stability) }
      ]
    },
    {
      title: 'FIREPOWER',
      stats: [
        { label: 'Alpha damage', value: formatNumber(summary.alphaDamage) },
        { label: 'Stability damage', value: formatNumber(summary.instability) },
        { label: 'Heat damage', value: formatNumber(summary.heatDamage) },
        { label: 'Melee damage', value: String(mech.melee.damage) },
        { label: 'Death from above', value: String(mech.dfa.damage) },
        { label: 'Max weapon range', value: summary.maxRange > 0 ? String(summary.maxRange) : EMPTY_VALUE, unit: 'm' }
      ]
    },
    {
      title: 'HEAT',
      stats: [
        { label: 'Heat sinking', value: String(summary.heat.dissipation), unit: 'per turn' },
        { label: 'Alpha heat', value: formatNumber(summary.heat.alpha) },
        { label: 'Max heat', value: String(summary.heat.maxHeat) },
        { label: 'Overheat at', value: String(summary.heat.overheat) },
        { label: 'Weapon heat', value: `× ${formatNumber(summary.heat.multiplier)}` }
      ]
    },
    {
      title: 'MOBILITY',
      stats: [
        { label: 'Walk', value: summary.walk === null ? EMPTY_VALUE : String(summary.walk), unit: 'm' },
        { label: 'Sprint', value: summary.sprint === null ? EMPTY_VALUE : String(summary.sprint), unit: 'm' },
        { label: 'Jump jets', value: `${summary.jumpJets} / ${summary.maxJumpJets}` }
      ]
    },
    {
      title: 'VALUE',
      stats: [{ label: 'Chassis, equipment and armor', value: summary.cost.toLocaleString('en'), unit: 'C-Bills' }]
    }
  ];

  return (
    <div className="analysis-table-wrap">
      <header className="analysis-heading">
        <div>
          <p className="eyebrow">05 / CHASSIS DATA</p>
          <h2>{mech.name} {mech.variant}</h2>
        </div>
      </header>
      <div className="mech-stats">
        {groups.map(group => (
          <section key={group.title} className="mech-stats-group">
            <h3>{group.title}</h3>
            <dl>
              {group.stats.map(stat => (
                <div key={stat.label} className="mech-stat">
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}{stat.unit && stat.value !== EMPTY_VALUE && <small> {stat.unit}</small>}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        {summary.bonuses.length > 0 && (
          <section className="mech-stats-group">
            <h3>EQUIPMENT</h3>
            <dl>
              {summary.bonuses.map(line => (
                <div key={line.item.id} className="mech-stat">
                  <dt>{line.count > 1 ? `${line.count}× ` : ''}{line.item.name}{line.fixed ? ' (built-in)' : ''}</dt>
                  <dd>{line.item.bonuses.join(' · ')}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
