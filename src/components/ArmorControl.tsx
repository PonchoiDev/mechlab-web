import type { MouseEvent } from 'react';

interface ArmorControlProps {
  label: string;
  shortLabel: string;
  value: number;
  onChange: (value: number) => void;
}

const stopPropagation = (event: MouseEvent) => event.stopPropagation();

export function ArmorControl({ label, shortLabel, value, onChange }: ArmorControlProps) {
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
        value={value}
        onChange={(event) => onChange(parseInt(event.target.value, 10) || 0)}
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
