import {
  BUILD_SORTS,
  BUILD_WEIGHT_CLASSES,
  type BuildMinimumsOf,
  type BuildSort,
  type BuildWeightClass
} from '../utils/savedBuildsList';

interface BuildsListControlsProps {
  query: string;
  onQueryChange: (query: string) => void;
  sort: BuildSort;
  onSortChange: (sort: BuildSort) => void;
  weightClasses: BuildWeightClass[];
  onWeightClassesChange: (weightClasses: BuildWeightClass[]) => void;
  counts: Record<BuildWeightClass, number>;
  // Tipos de anclaje de cada juego, con la abreviatura del selector de 'Mechs (E, B, M, Omni o S).
  hardpointTypes: { id: string; short: string; label: string }[];
  minHardpoints: Partial<Record<string, number>>;
  onMinHardpointsChange: (minHardpoints: Partial<Record<string, number>>) => void;
  minimumsOf: BuildMinimumsOf;
  onMinimumsOfChange: (minimumsOf: BuildMinimumsOf) => void;
}

const MINIMUMS_OF: { id: BuildMinimumsOf; label: string; title: string }[] = [
  { id: 'hardpoints', label: 'Hardpoints', title: "Hardpoints of the build's 'Mech: what it can mount" },
  { id: 'weapons', label: 'Weapons', title: 'Weapons the build carries' }
];

const MAX_MINIMUM = 9;

// Buscador, orden y filtro por clase de la ventana My builds, común a los dos MechLabs.
export function BuildsListControls({
  query,
  onQueryChange,
  sort,
  onSortChange,
  weightClasses,
  onWeightClassesChange,
  counts,
  hardpointTypes,
  minHardpoints,
  onMinHardpointsChange,
  minimumsOf,
  onMinimumsOfChange
}: BuildsListControlsProps) {
  const noun = minimumsOf === 'weapons' ? 'weapons' : 'hardpoints';
  const setMinimum = (type: string, value: number) =>
    onMinHardpointsChange({ ...minHardpoints, [type]: Math.min(MAX_MINIMUM, Math.max(0, value)) });
  const changeMinimum = (type: string, step: number) => setMinimum(type, (minHardpoints[type] ?? 0) + step);
  // El número se escribe a mano: vale la última cifra tecleada (de 0 a 9), y sin ninguna, 0.
  const typeMinimum = (type: string, text: string) => {
    const digits = text.replace(/\D/g, '');
    setMinimum(type, digits === '' ? 0 : Number(digits.slice(-1)));
  };

  const toggle = (id: BuildWeightClass) =>
    onWeightClassesChange(weightClasses.includes(id) ? weightClasses.filter(other => other !== id) : [...weightClasses, id]);

  return (
    <div className="builds-controls">
      <div className="builds-controls-row">
        <input
          className="builds-search"
          type="search"
          placeholder="Name, chassis or variant"
          aria-label="Search saved builds"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
        />
        <label className="builds-sort">
          <span>Sort</span>
          <select value={sort} onChange={event => onSortChange(event.target.value as BuildSort)}>
            {BUILD_SORTS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="builds-classes" role="group" aria-label="Weight class">
        {BUILD_WEIGHT_CLASSES.map(option => (
          <button
            key={option.id}
            type="button"
            className="mech-filter-chip"
            aria-pressed={weightClasses.includes(option.id)}
            disabled={counts[option.id] === 0 && !weightClasses.includes(option.id)}
            onClick={() => toggle(option.id)}
          >
            {option.label} <span className="utility-count">{counts[option.id]}</span>
          </button>
        ))}
      </div>
      <div className="builds-hardpoints" role="group" aria-label={`Minimum ${noun}`}>
        <span className="builds-filter-label">Min</span>
        <span className="builds-minimums-of" role="group" aria-label="Compare minimums with">
          {MINIMUMS_OF.map(option => (
            <button
              key={option.id}
              type="button"
              aria-pressed={minimumsOf === option.id}
              title={option.title}
              onClick={() => onMinimumsOfChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </span>
        {hardpointTypes.map(type => {
          const value = minHardpoints[type.id] ?? 0;
          return (
            <span key={type.id} className={value > 0 ? 'mech-filter-stepper is-active' : 'mech-filter-stepper'} data-weapon-type={type.id}>
              <button type="button" aria-label={`Fewer ${type.label} ${noun}`} disabled={value === 0} onClick={() => changeMinimum(type.id, -1)}>−</button>
              <label title={`Minimum ${type.label} ${noun}`}>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Minimum ${type.label} ${noun}`}
                  value={value}
                  onFocus={event => event.currentTarget.select()}
                  onChange={event => typeMinimum(type.id, event.target.value)}
                />
                {type.short}
              </label>
              <button type="button" aria-label={`More ${type.label} ${noun}`} disabled={value === MAX_MINIMUM} onClick={() => changeMinimum(type.id, 1)}>+</button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
