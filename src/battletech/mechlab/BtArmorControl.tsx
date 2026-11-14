import type { MouseEvent } from 'react';

interface BtArmorControlProps {
  label: string;
  shortLabel: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  onStep: (steps: number) => void;
}

const stopPropagation = (event: MouseEvent) => event.stopPropagation();

// El ArmorControl de MW5 con el paso de BATTLETECH: los botones mueven 5 puntos (ARMOR_PER_STEP) y el
// campo admite cualquier valor hasta el máximo de ese lado. No se reutiliza el de MW5 porque su escala
// (Refined Armor) carga la lógica y los datos de las mejoras de MW5.
export function BtArmorControl({ label, shortLabel, value, max, onChange, onStep }: BtArmorControlProps) {
  return (
    <div className="armor-control" title={`${label}: ${value} / ${max}`}>
      <span className="armor-control-label" aria-hidden="true">{shortLabel}:</span>
      <button type="button" className="armor-step" aria-label={`Decrease ${label} by 5`} disabled={value <= 0} onClick={(event) => { event.stopPropagation(); onStep(-1); }}>-</button>
      <input
        type="number"
        className="armor-input"
        aria-label={label}
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10) || 0)}
        onClick={stopPropagation}
      />
      <button type="button" className="armor-step" aria-label={`Increase ${label} by 5`} disabled={value >= max} onClick={(event) => { event.stopPropagation(); onStep(1); }}>+</button>
    </div>
  );
}
