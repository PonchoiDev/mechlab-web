import type { BtLoadout, BtMech } from '../../types/battletech-mechlab';
import { getHardpointSummary } from '../../utils/battletech/fitting';
import { HARDPOINT_LABELS, HARDPOINT_SHORT } from '../../utils/battletech/mechlabData';

// El resumen bajo el tonelaje de la pantalla de reequipar del juego («4/4 B 0/4 E 0/0 M 0/0 S 4/4 JJ»),
// con las etiquetas de color de anclaje de MW5 en lugar de los iconos del juego. El juego pone primero
// Ballistic.
const ORDER = ['ballistic', 'energy', 'missile', 'support'] as const;

export function HardpointUsage({ mech, loadout }: { mech: BtMech; loadout: BtLoadout }) {
  const summary = getHardpointSummary(mech, loadout);
  return (
    <span className="mech-option-hardpoints bt-hardpoint-usage" aria-label="Hardpoints used">
      {ORDER.map(type => (
        <span
          key={type}
          className={summary[type].capacity === 0 ? 'mech-hardpoint-tag is-dlc' : 'mech-hardpoint-tag'}
          data-weapon-type={summary[type].capacity > 0 ? type : undefined}
          title={`${HARDPOINT_LABELS[type]}: ${summary[type].used} of ${summary[type].capacity} hardpoints used`}
        >
          {summary[type].used}/{summary[type].capacity} {HARDPOINT_SHORT[type]}
        </span>
      ))}
      <span className="mech-hardpoint-tag is-jump-jets" title={`Jump jets: ${summary.jumpJets.used} of ${summary.jumpJets.capacity}`}>
        {summary.jumpJets.used}/{summary.jumpJets.capacity} JJ
      </span>
    </span>
  );
}
