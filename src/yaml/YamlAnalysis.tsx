import { useMemo, useState } from 'react';
import { AmmunitionList } from '../components/AmmunitionList';
import { RangeRadar } from '../components/RangeRadar';
import { UpgradedValue } from '../components/UpgradedValue';
import type { YamlBuild, YamlMech } from '../types/yaml-mechlab';
import { COOLING_KEEPS_UP, EMPTY_VALUE, joinWithCounts } from '../utils/format';
import {
  formatYamlStat, getWeaponPerformance, getYamlAmmunition, getYamlChassisData, getYamlDamagePerTon, getYamlMechStats,
  getYamlRangeProfile, getYamlRangeState, type YamlWeaponPerformance
} from '../utils/yaml/combat';
import { getYamlMechDisplayName } from '../utils/yaml/mechList';
import { ZONE_LABELS } from '../utils/zones';

// El análisis del MechLab de MW5 (LoadoutAnalysis) con las cifras de YAML. Weapons: una fila por arma, el
// radar de daño por alcance y la munición instalada; las filas suman las cifras del panel de estadísticas.
// 'Mech: las cifras del panel agrupadas como en MW5, con los tiempos de calor.

const tierLabel = (tier: number) => tier === 5 ? 'Lost Tech' : `T${tier}`;
const metres = (value: number) => value > 0 ? `${Math.round(value)} m` : EMPTY_VALUE;
const seconds = (value: number) => value > 0 ? `${formatYamlStat(value)} s` : EMPTY_VALUE;

function weaponLabel(weapon: YamlWeaponPerformance): string {
  return `${weapon.name} ${tierLabel(weapon.tier)}`;
}

function WeaponRow({ weapon, rangeFocus }: { weapon: YamlWeaponPerformance; rangeFocus: number | null }) {
  const state = rangeFocus === null ? null : getYamlRangeState(weapon, rangeFocus);
  const isAms = weapon.family === 'ams';
  const isMelee = weapon.family === 'melee';
  return (
    <tr className={state ? `is-range-${state}` : undefined}>
      <td>
        {weapon.name} <small className="yaml-weapon-tier">{tierLabel(weapon.tier)}</small>
        {state === 'falloff' && <small className="range-tag">falloff</small>}
      </td>
      <td>{ZONE_LABELS[weapon.zone]}</td>
      <td>{isAms ? `${formatYamlStat(weapon.amsRate)}/s` : formatYamlStat(weapon.damage)}</td>
      <td>{weapon.damagePerTon === null ? EMPTY_VALUE : formatYamlStat(weapon.damagePerTon)}</td>
      <td>{isAms || isMelee ? EMPTY_VALUE : formatYamlStat(weapon.heat)}</td>
      <td>{seconds(weapon.cooldown)}</td>
      <td>{seconds(weapon.duration)}</td>
      <td>{isAms ? EMPTY_VALUE : formatYamlStat(weapon.dps)}</td>
      <td>{isAms || isMelee ? EMPTY_VALUE : formatYamlStat(weapon.heatPerSecond)}</td>
      <td>{isAms || isMelee ? EMPTY_VALUE : metres(weapon.optimalRange)}</td>
      <td>{isMelee ? EMPTY_VALUE : metres(weapon.maxRange)}</td>
      <td>{weapon.speed === null ? EMPTY_VALUE : `${Math.round(weapon.speed)} m/s`}</td>
    </tr>
  );
}

function WeaponsTab({ mech, build }: { mech: YamlMech; build: YamlBuild }) {
  const weapons = useMemo(() => getWeaponPerformance(mech, build), [mech, build]);
  const stats = useMemo(() => getYamlMechStats(mech, build), [mech, build]);
  const profile = useMemo(() => getYamlRangeProfile(weapons), [weapons]);
  const ammunition = useMemo(() => getYamlAmmunition(mech, build), [mech, build]);
  const damagePerTon = getYamlDamagePerTon(weapons);
  // Anillo del radar señalado: la tabla resalta las armas que llegan y apaga las demás.
  const [rangeFocus, setRangeFocus] = useState<number | null>(null);
  const describeWeapons = (distance: number) => {
    const names = (state: string) => weapons.filter(weapon => getYamlRangeState(weapon, distance) === state).map(weaponLabel);
    const [full, falloff] = [names('full'), names('falloff')];
    const parts = [full.length > 0 ? joinWithCounts(full) : '', falloff.length > 0 ? `falling off: ${joinWithCounts(falloff)}` : ''].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'no weapon reaches it';
  };

  return (
    <div className={ammunition.length > 0 ? 'analysis-body' : 'analysis-body is-single'}>
      <div className="analysis-table-wrap">
        <header className="analysis-heading">
          <div>
            <p className="eyebrow">05 / COMBAT DATA</p>
            <h2>Weapon performance</h2>
          </div>
          <span className="analysis-note">YET ANOTHER WEAPON RULES · DPS = DAMAGE / (COOLDOWN + DURATION)</span>
        </header>
        {weapons.length > 0 ? (
          <div className="analysis-overflow">
            <table className="weapon-table yaml-weapon-table">
              <thead>
                <tr>
                  <th>Weapon</th>
                  <th>Section</th>
                  <th>Damage</th>
                  <th title="Damage per ton of the weapon itself, without its ammo">Damage / ton</th>
                  <th>Heat</th>
                  <th>Cooldown</th>
                  <th title="Beam time of lasers, swing time of melee weapons">Duration</th>
                  <th>DPS</th>
                  <th>Heat/s</th>
                  <th>Optimal range</th>
                  <th>Max range</th>
                  <th>Velocity</th>
                </tr>
              </thead>
              <tbody>
                {weapons.map(weapon => <WeaponRow key={weapon.hardpoint} weapon={weapon} rangeFocus={rangeFocus} />)}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>ranged weapons</td>
                  <td>{formatYamlStat(stats.alphaDamage)}</td>
                  <td>{damagePerTon === null ? EMPTY_VALUE : formatYamlStat(damagePerTon)}</td>
                  <td>{formatYamlStat(stats.alphaHeat)}</td>
                  <td>{EMPTY_VALUE}</td>
                  <td>{EMPTY_VALUE}</td>
                  <td>{formatYamlStat(stats.dps)}</td>
                  <td>{formatYamlStat(stats.heatPerSecond)}</td>
                  <td>{EMPTY_VALUE}</td>
                  <td>{metres(stats.weaponRange)}</td>
                  <td>{EMPTY_VALUE}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="analysis-empty">No weapons installed.</p>
        )}
        {profile.length > 0 && (
          <>
            <header className="analysis-heading range-heading">
              <div>
                <p className="eyebrow">RANGE</p>
                <h2>Damage by range</h2>
              </div>
              <span className="analysis-note">FULL DAMAGE UP TO OPTIMAL RANGE, FALLING TO ZERO AT MAX RANGE</span>
            </header>
            <RangeRadar profile={profile} onActiveChange={setRangeFocus} describeWeapons={describeWeapons} />
          </>
        )}
      </div>
      {ammunition.length > 0 && <AmmunitionList ammunition={ammunition} />}
    </div>
);
}

function MechTab({ mech, build }: { mech: YamlMech; build: YamlBuild }) {
  const groups = useMemo(() => getYamlChassisData(mech, build), [mech, build]);
  return (
    <div className="analysis-table-wrap">
      <header className="analysis-heading">
        <div>
          <p className="eyebrow">05 / CHASSIS DATA</p>
          <h2>{getYamlMechDisplayName(mech)} {mech.variant}</h2>
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
                  <dd><UpgradedValue value={stat.value} base={stat.base} />{stat.unit && ![EMPTY_VALUE, COOLING_KEEPS_UP].includes(stat.value) && <small> {stat.unit}</small>}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

export function YamlAnalysis({ mech, build }: { mech: YamlMech; build: YamlBuild }) {
  const [tab, setTab] = useState<'weapons' | 'mech'>('weapons');
  return (
    <section className="loadout-analysis" aria-label="Loadout performance">
      <div className="analysis-tabs" role="group" aria-label="Statistics">
        <button type="button" className="analysis-tab" aria-pressed={tab === 'weapons'} onClick={() => setTab('weapons')}>
          Weapons
        </button>
        <button type="button" className="analysis-tab" aria-pressed={tab === 'mech'} onClick={() => setTab('mech')}>
          'Mech
        </button>
        {(build.traits?.length ?? 0) > 0 && <span className="analysis-note">GREEN ▲ VALUES INCLUDE CANTINA UPGRADES</span>}
      </div>
      {tab === 'weapons' ? <WeaponsTab mech={mech} build={build} /> : <MechTab mech={mech} build={build} />}
    </section>
  );
}
