import type { BtMech } from '../../types/battletech-mechlab';

// El icono del chasis del mechlab del juego (uixTxrIcon_*), que extraer_mechlab_battletech.py deja en
// battletech/public/mechlab/icons/. Varias variantes comparten el de su chasis.
export function MechIcon({ mech, size }: { mech: BtMech; size: number }) {
  if (!mech.icon) return <span className="bt-mech-icon is-empty" style={{ width: size, height: size }} aria-hidden="true" />;
  return (
    <img
      className="bt-mech-icon"
      src={`${import.meta.env.BASE_URL}mechlab/icons/${mech.icon}.png`}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}
