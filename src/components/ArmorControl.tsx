import type { MouseEvent } from 'react';
import { scaleArmorPoints, unscaleArmorPoints } from '../utils/calculators';

interface ArmorControlProps {
  label: string;
  shortLabel: string;
  // Puntos base; con Refined Armor se muestran multiplicados por scale y los botones mueven un punto base.
  value: number;
  scale?: number;
  onChange: (value: number) => void;
}

const stopPropagation = (event: MouseEvent) => event.stopPropagation();

export function ArmorControl({ label, shortLabel, value, scale = 1, onChange }: ArmorControlProps) {
  return (
    <div className="armor-control">
      <span className="armor-control-label" aria-hidden="true">{shortLabel}:</span>
      <button
        type="button"
        className="armor-step"
        aria-label={`Decrease ${label}`}
        onClick={(event) => { event.stopPropagation(); onChange(value - 1); }}
      >-</button>
      <input
        type="number"
        className="armor-input"
        aria-label={label}
        value={scaleArmorPoints(value, scale)}
        onChange={(event) => onChange(unscaleArmorPoints(parseInt(event.target.value, 10) || 0, scale))}
        onClick={stopPropagation}
      />
      <button
        type="button"
        className="armor-step"
        aria-label={`Increase ${label}`}
        onClick={(event) => { event.stopPropagation(); onChange(value + 1); }}
      >+</button>
    </div>
  );
}
