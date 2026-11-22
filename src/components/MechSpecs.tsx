import type { Mech } from '../types/mech';
import { getMechSpecs, type SpecBuild } from '../utils/mechs';

const SPEC_TITLES: Record<string, string> = {
  xl: 'XL engine',
  dhs: 'Double heat sinks',
  endo: 'Endo-Steel structure',
  ferro: 'Ferro-Fibrous armor',
  ecm: 'Carries an ECM',
  ap: 'Carries an active probe',
  motive: 'Carries a MASC or a Supercharger',
  jj: 'Carries jump jets',
  slots: 'Upgrade slots used'
};

// Motor, disipadores, estructura y armadura del chasis, con los colores del mechlab del juego, y con build, su
// equipo especial y sus ranuras de mejoras.
export function MechSpecs({ mech, build }: { mech: Mech; build?: SpecBuild }) {
  return (
    <span className="mech-specs">
      {getMechSpecs(mech, build).map(({ kind, label }) => (
        <span key={label} className={`mech-spec is-${kind}`} title={SPEC_TITLES[kind]}>{label}</span>
      ))}
    </span>
  );
}
