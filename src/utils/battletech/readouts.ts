import type { BtBuild } from '../../types/battletech-mechlab';
import { EMPTY_VALUE } from '../format';
import { getBuildSummary } from './stats';

// Las diez cifras del StatsReadout de MW5, en su orden, con las equivalentes de BATTLETECH: andar y correr
// en lugar de la velocidad, y el calor por turno en lugar de por segundo. Las usan la lectura de la página
// y la imagen para compartir, así que dicen siempre lo mismo.
export interface BtReadout {
  label: string;
  value: string;
  unit?: string;
  title?: string;
  // En rojo: sobrepeso, más retrorreactores de los que admite o un alfa que calienta más de lo que disipa.
  warn?: boolean;
}

const formatNumber = (value: number) => String(Number(value.toFixed(2)));

export const getBtReadouts = (build: BtBuild): BtReadout[] => {
  const { mech } = build;
  const summary = getBuildSummary(build);
  return [
    { label: 'TONNAGE', value: summary.tonnage.toFixed(2), unit: `/ ${mech.tonnage} t`, warn: summary.freeTonnage < 0 },
    { label: 'ARMOR POINTS', value: String(summary.armorPoints), unit: `/ ${summary.maxArmorPoints}` },
    { label: 'ARMOR MASS', value: summary.armorTonnage.toFixed(2), unit: 't' },
    {
      label: 'WALK / SPRINT',
      value: String(summary.walk ?? EMPTY_VALUE),
      unit: `/ ${summary.sprint ?? EMPTY_VALUE} m`,
      title: 'Walk and sprint distance per turn'
    },
    { label: 'JUMP JETS', value: String(summary.jumpJets), unit: `/ ${summary.maxJumpJets}`, warn: summary.jumpJets > summary.maxJumpJets },
    { label: 'ALPHA DAMAGE', value: formatNumber(summary.alphaDamage), title: 'Damage of an alpha strike with every weapon' },
    {
      label: 'MELEE DAMAGE',
      value: String(mech.melee.damage),
      title: 'Melee attack damage of the chassis, with its equipment bonuses not included'
    },
    { label: 'ALPHA HEAT', value: formatNumber(summary.heat.alpha), title: 'Heat of an alpha strike', warn: summary.heat.net > 0 },
    {
      label: 'HEAT SINKING',
      value: String(summary.heat.dissipation),
      unit: 'per turn',
      title: "Heat the 'Mech sinks each turn: 30 from the engine plus its heat sinks"
    },
    summary.maxRange > 0 ? { label: 'MAX WEAPON RANGE', value: String(summary.maxRange), unit: 'm' } : { label: 'MAX WEAPON RANGE', value: EMPTY_VALUE }
  ];
};
