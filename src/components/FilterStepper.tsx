import { parseStepperInput } from '../utils/stepper';

interface FilterStepperProps {
  // Clase de la caja: la de los selectores y My builds (mech-filter-stepper) o la de las listas de chasis.
  className?: string;
  // Tipo de anclaje para el color (data-weapon-type y data-type).
  type?: string;
  // Lo que cuenta, para los textos de ayuda: «energy hardpoints», «jump jets».
  label: string;
  short: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}

// Un contador de mínimos con − y +, cuyo número también se escribe a mano.
export function FilterStepper({ className = 'mech-filter-stepper', type, label, short, value, max, onChange }: FilterStepperProps) {
  const set = (next: number) => onChange(Math.min(max, Math.max(0, next)));
  return (
    <span className={value > 0 ? `${className} is-active` : className} data-weapon-type={type} data-type={type}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value === 0} onClick={() => set(value - 1)}>−</button>
      <label title={`Minimum ${label}`}>
        <input
          type="text"
          inputMode="numeric"
          aria-label={`Minimum ${label}`}
          value={value}
          onFocus={event => event.currentTarget.select()}
          onChange={event => set(parseStepperInput(event.target.value, max))}
        />
        {short}
      </label>
      <button type="button" aria-label={`More ${label}`} disabled={value === max} onClick={() => set(value + 1)}>+</button>
    </span>
  );
}
