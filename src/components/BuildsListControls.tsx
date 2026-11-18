import {
  BUILD_SORTS,
  BUILD_WEIGHT_CLASSES,
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
}

// Buscador, orden y filtro por clase de la ventana My builds, común a los dos MechLabs.
export function BuildsListControls({
  query,
  onQueryChange,
  sort,
  onSortChange,
  weightClasses,
  onWeightClassesChange,
  counts
}: BuildsListControlsProps) {
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
    </div>
  );
}
