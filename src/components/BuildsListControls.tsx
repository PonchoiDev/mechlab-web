import { CheckboxDropdown } from './CheckboxDropdown';
import { FilterStepper } from './FilterStepper';
import { describeSelection } from '../utils/mechs';
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
  // Los filtros del selector de 'Mechs de cada juego: Tech solo en MW5.
  techBase?: { value: 'InnerSphere' | 'Clan' | null; onChange: (techBase: 'InnerSphere' | 'Clan' | null) => void };
  roleOptions: string[];
  roles: string[];
  onRolesChange: (roles: string[]) => void;
  featureOptions: { id: string; label: string; title: string }[];
  features: string[];
  onFeaturesChange: (features: string[]) => void;
}

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter(other => other !== value) : [...values, value];

const MINIMUMS_OF: { id: BuildMinimumsOf; label: string; title: string }[] = [
  { id: 'hardpoints', label: 'Hardpoints', title: "Hardpoints of the build's 'Mech: what it can mount" },
  { id: 'weapons', label: 'Weapons', title: 'Weapons the build carries' }
];

// Común a los dos juegos: en MW5 hay 'Mechs con más de diez anclajes de un tipo (el ADR-S tiene 16 balísticos).
const MAX_MINIMUM = 20;

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
  onMinimumsOfChange,
  techBase,
  roleOptions,
  roles,
  onRolesChange,
  featureOptions,
  features,
  onFeaturesChange
}: BuildsListControlsProps) {
  const noun = minimumsOf === 'weapons' ? 'weapons' : 'hardpoints';

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
      <div className="builds-classes" role="group" aria-label="Class, tech and role">
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
        {techBase && (
          <>
            <span className="builds-filter-label">Tech</span>
            {(['InnerSphere', 'Clan'] as const).map(value => (
              <button
                key={value}
                type="button"
                className="mech-filter-chip"
                aria-pressed={techBase.value === value}
                onClick={() => techBase.onChange(techBase.value === value ? null : value)}
              >
                {value === 'InnerSphere' ? 'IS' : 'Clan'}
              </button>
            ))}
          </>
        )}
        {roleOptions.length > 0 && (
          <>
            <span className="builds-filter-label">Role</span>
            <CheckboxDropdown
              label="Role"
              title="Role of the build's 'Mech"
              options={roleOptions.map(role => ({ value: role, label: role }))}
              selected={roles}
              summary={describeSelection(roles)}
              onToggle={role => onRolesChange(toggleValue(roles, role))}
              onClear={() => onRolesChange([])}
            />
          </>
        )}
      </div>
      <div className="builds-classes" role="group" aria-label="Equipment">
        <span className="builds-filter-label">Equipment</span>
        {featureOptions.map(option => (
          <button
            key={option.id}
            type="button"
            className="mech-filter-chip"
            aria-pressed={features.includes(option.id)}
            title={option.title}
            onClick={() => onFeaturesChange(toggleValue(features, option.id))}
          >
            {option.label}
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
        {hardpointTypes.map(type => (
          <FilterStepper
            key={type.id}
            type={type.id}
            label={`${type.label} ${noun}`}
            short={type.short}
            value={minHardpoints[type.id] ?? 0}
            max={MAX_MINIMUM}
            onChange={value => onMinHardpointsChange({ ...minHardpoints, [type.id]: value })}
          />
        ))}
      </div>
    </div>
  );
}
