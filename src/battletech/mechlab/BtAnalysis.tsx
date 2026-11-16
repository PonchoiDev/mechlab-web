import { useState } from 'react';
import type { BtBuild } from '../../types/battletech-mechlab';
import { EMPTY_VALUE, joinWithCounts } from '../../utils/format';
import { ZONE_KEYS, ZONE_LABELS } from '../../utils/zones';
import { getZoneItems } from '../../utils/battletech/fitting';
import { getBtWeaponRangeState, type BtSummary } from '../../utils/battletech/stats';
import { RangeRadar } from '../../components/RangeRadar';

const formatNumber = (value: number) => String(Number(value.toFixed(2)));

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
  // Anillo del radar señalado: la tabla resalta las armas que llegan y apaga las demás.
  const [rangeFocus, setRangeFocus] = useState<number | null>(null);
  const describeWeapons = (distance: number) => {
    const names = (state: string) => rows.filter(({ item }) => getBtWeaponRangeState(item, distance) === state).map(({ item }) => item.name);
    const [full, belowMin] = [names('full'), names('belowMin')];
    const parts = [full.length > 0 ? joinWithCounts(full) : '', belowMin.length > 0 ? `under minimum range: ${joinWithCounts(belowMin)}` : ''].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'no weapon reaches it';
  };

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
                  <tr key={`${item.id}-${zone}-${index}`} className={rangeFocus === null ? undefined : `is-range-${getBtWeaponRangeState(item, rangeFocus)}`}>
                    <td>
                      {item.name}
                      {rangeFocus !== null && getBtWeaponRangeState(item, rangeFocus) === 'belowMin' && <small className="range-tag is-below-min">under min</small>}
                    </td>
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

        <header className="analysis-heading range-heading">
          <div>
            <p className="eyebrow">RANGE</p>
            <h2>Damage by range</h2>
          </div>
          <span className="analysis-note">AMBER STRIPES: UNDER MINIMUM RANGE, WITH AN ACCURACY PENALTY</span>
        </header>
        <RangeRadar profile={summary.rangeProfile} onActiveChange={setRangeFocus} describeWeapons={describeWeapons} />
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
