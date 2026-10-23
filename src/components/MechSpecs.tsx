import type { Mech } from '../types/mech';
import { getMechSpecs } from '../utils/mechs';

const SPEC_TITLES: Record<string, string> = {
  xl: 'XL engine',
  dhs: 'Double heat sinks',
  endo: 'Endo-Steel structure',
  ferro: 'Ferro-Fibrous armor',
  ap: 'Active probe'
};

// Motor, disipadores, estructura y armadura del chasis, con los colores del mechlab del juego.
export function MechSpecs({ mech }: { mech: Mech }) {
  return (
    <span className="mech-specs">
      {getMechSpecs(mech).map(({ kind, label }) => (
        <span key={label} className={`mech-spec is-${kind}`} title={SPEC_TITLES[kind]}>{label}</span>
      ))}
    </span>
  );
}
