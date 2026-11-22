import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { getMechSpecs } from '../utils/mechs';

const SPEC_TITLES: Record<string, string> = {
  xl: 'XL engine',
  dhs: 'Double heat sinks',
  endo: 'Endo-Steel structure',
  ferro: 'Ferro-Fibrous armor',
  ap: 'Active probe'
};

// Motor, disipadores, estructura y armadura del chasis, con los colores del mechlab del juego, y AP si el equipo
// de la build lleva una sonda.
export function MechSpecs({ mech, items = [] }: { mech: Mech; items?: Item[] }) {
  return (
    <span className="mech-specs">
      {getMechSpecs(mech, items).map(({ kind, label }) => (
        <span key={label} className={`mech-spec is-${kind}`} title={SPEC_TITLES[kind]}>{label}</span>
      ))}
    </span>
  );
}
