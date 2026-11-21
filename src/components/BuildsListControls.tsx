import { useMemo, type ReactNode } from 'react';
import { CheckboxDropdown } from './CheckboxDropdown';
import { FilterStepper } from './FilterStepper';
import type { BuildListFiltersState } from '../hooks/useBuildListFilters';
import { describeSelection } from '../utils/mechs';
import {
  BUILD_SORTS,
  BUILD_WEIGHT_CLASSES,
  countBuildsByWeightClass,
  type BuildListConfig,
  type BuildListRow,
  type BuildMinimumsOf,
  type BuildSort,
  type BuildWeightClass
} from '../utils/savedBuildsList';

interface BuildsListControlsProps {
  state: BuildListFiltersState;
  config: BuildListConfig;
  // Todas las builds guardadas, para contar las de cada clase y ofrecer solo sus roles.
  rows: BuildListRow[];
  // En el selector del comparador, su propio campo ya es el buscador.
  showSearch?: boolean;
  // Lo que va a la izquierda del orden cuando no hay buscador: el recuento del selector.
  leading?: ReactNode;
}

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter(other => other !== value) : [...values, value];

const MINIMUMS_OF: { id: BuildMinimumsOf; label: string; title: string }[] = [
  { id: 'hardpoints', label: 'Hardpoints', title: "Hardpoints of the build's 'Mech: what it can mount" },
  { id: 'weapons', label: 'Weapons', title: 'Weapons the build carries' }
];

// Común a los dos juegos: en MW5 hay 'Mechs con más de diez anclajes de un tipo (el ADR-S tiene 16 balísticos).
const MAX_MINIMUM = 20;

// Buscador, orden y filtros de las listas de builds guardadas (la ventana My builds y el comparador),
// comunes a los dos MechLabs.
export function BuildsListControls({ state, config, rows, showSearch = true, leading }: BuildsListControlsProps) {
  const { filter, sort, setSort, setQuery, setWeightClasses, setMinHardpoints, setMinimumsOf, setTechBase, setRoles, setFeatures } = state;
  const { query, weightClasses, minimumsOf = 'hardpoints', techBase = null, roles = [], features = [] } = filter;
  const minHardpoints = filter.minHardpoints ?? {};
  const counts = useMemo(() => countBuildsByWeightClass(rows), [rows]);
  // Solo los roles de las builds guardadas, para no ofrecer filtros vacíos.
  const roleOptions = useMemo(() => config.orderRoles([...new Set(rows.flatMap(row => row.roles))]), [config, rows]);
  // Ningún arma es omni: con Weapons ese contador no sale.
  const hardpointTypes = minimumsOf === 'weapons' ? config.hardpointTypes.filter(type => type.id !== 'omni') : config.hardpointTypes;
  const noun = minimumsOf === 'weapons' ? 'weapons' : 'hardpoints';

  const toggle = (id: BuildWeightClass) =>
    setWeightClasses(weightClasses.includes(id) ? weightClasses.filter(other => other !== id) : [...weightClasses, id]);

  return (
    <div className="builds-controls">
      <div className="builds-controls-row">
        {leading}
        {showSearch && (
          <input
            className="builds-search"
            type="search"
            placeholder="Name, chassis or variant"
            aria-label="Search saved builds"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        )}
        <label className="builds-sort">
          <span>Sort</span>
          <select value={sort} onChange={event => setSort(event.target.value as BuildSort)}>
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
        {config.hasTechBase && (
          <>
            <span className="builds-filter-label">Tech</span>
            {(['InnerSphere', 'Clan'] as const).map(value => (
              <button
                key={value}
                type="button"
                className="mech-filter-chip"
                aria-pressed={techBase === value}
                onClick={() => setTechBase(techBase === value ? null : value)}
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
              onToggle={role => setRoles(toggleValue(roles, role))}
              onClear={() => setRoles([])}
            />
          </>
        )}
      </div>
      <div className="builds-classes" role="group" aria-label="Equipment">
        <span className="builds-filter-label">Equipment</span>
        {config.featureOptions.map(option => (
          <button
            key={option.id}
            type="button"
            className="mech-filter-chip"
            aria-pressed={features.includes(option.id)}
            title={option.title}
            onClick={() => setFeatures(toggleValue(features, option.id))}
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
              onClick={() => setMinimumsOf(option.id)}
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
            onChange={value => setMinHardpoints({ ...minHardpoints, [type.id]: value })}
          />
        ))}
      </div>
    </div>
  );
}
