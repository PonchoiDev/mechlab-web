import { useMemo, useState, type KeyboardEvent } from 'react';
import type { Mech } from '../types/mech';
import { CheckboxDropdown } from './CheckboxDropdown';
import { MechSpecs } from './MechSpecs';
import {
  BASE_GAME,
  CONTENT_SOURCES,
  countActiveFilters,
  describeContentSources,
  describeSelection,
  getMechRoles,
  EMPTY_MECH_FILTERS,
  GAME_START_YEAR,
  getAvailableYear,
  getContentSourceLabel,
  getHardpointGroups,
  getMechDisplayName,
  hasEcm,
  HARDPOINT_ABBREVIATIONS,
  hasJumpJets,
  matchesMechFilters,
  matchesMechQuery,
  mergeMechFilters,
  parseMechQuery,
  type HardpointFilterType,
  type MechFilters,
  type WeightClassName
} from '../utils/mechs';

interface MechPickerProps {
  mechs: Mech[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const WEIGHT_CLASSES: { value: WeightClassName; label: string }[] = [
  { value: 'light', label: 'L' },
  { value: 'medium', label: 'M' },
  { value: 'heavy', label: 'H' },
  { value: 'assault', label: 'A' }
];

// Los anclajes que se pueden pedir con un mínimo desde el panel; artillería y AMS se pueden
// pedir escribiéndolos en el buscador (1art, 1ams).
const MINIMUM_TYPES: HardpointFilterType[] = ['energy', 'ballistic', 'missile', 'omni'];
const MAX_MINIMUM = 9;


// Marca o desmarca un valor de un filtro de varias opciones.
const toggleValue = <T,>(values: T[], value: T): T[] =>
  values.includes(value) ? values.filter(current => current !== value) : [...values, value];

const filterMechs = (mechs: Mech[], query: string, filters: MechFilters) => {
  const parsed = parseMechQuery(query);
  const combined = mergeMechFilters(filters, parsed.filters);
  return mechs
    .map((mech, index) => ({ mech, index }))
    .filter(({ mech }) => matchesMechQuery(mech, parsed.text) && matchesMechFilters(mech, combined));
};

function HardpointSummary({ mech }: { mech: Mech }) {
  return (
    <span className="mech-option-hardpoints">
      {getHardpointGroups(mech).map(({ type, size, sizeLetter, count }) => (
        <span key={`${type}-${size}`} className="mech-hardpoint-tag" data-weapon-type={type} title={`${count} ${size} ${type} hardpoint${count > 1 ? 's' : ''}`}>
          {count}{HARDPOINT_ABBREVIATIONS[type]}<small>{sizeLetter}</small>
        </span>
      ))}
      {hasJumpJets(mech) && <span className="mech-hardpoint-tag is-jump-jets">JJ</span>}
      {hasEcm(mech) && <span className="mech-hardpoint-tag is-ecm">ECM</span>}
      {mech.dlc !== undefined && <span className="mech-hardpoint-tag is-dlc" title={`Comes with DLC ${mech.dlc}`}>{getContentSourceLabel(mech.dlc)}</span>}
    </span>
  );
}

export function MechPicker({ mechs, selectedIndex, onSelect }: MechPickerProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(0);
  const [filters, setFilters] = useState<MechFilters>(EMPTY_MECH_FILTERS);
  const currentMech = mechs[selectedIndex];
  const filteredMechs = useMemo(() => filterMechs(mechs, query, filters), [mechs, query, filters]);
  const activeFilterCount = countActiveFilters(filters);
  const roles = useMemo(() => getMechRoles(mechs), [mechs]);
  // Años de la campaña en los que aparece algún mech nuevo, desde su inicio.
  const years = useMemo(() => {
    const lastYear = Math.max(GAME_START_YEAR, ...mechs.map(getAvailableYear));
    return Array.from({ length: lastYear - GAME_START_YEAR + 1 }, (_, index) => GAME_START_YEAR + index);
  }, [mechs]);

  const close = () => {
    setQuery('');
    setIsOpen(false);
  };

  // Sin filtros se abre mostrando las variantes del chasis actual; con filtros, toda la lista filtrada.
  const open = () => {
    if (!isOpen) {
      const initialQuery = activeFilterCount > 0 ? '' : currentMech.name;
      const selectedOption = filterMechs(mechs, initialQuery, filters).findIndex(({ index }) => index === selectedIndex);
      setQuery(initialQuery);
      setActiveOption(Math.max(selectedOption, 0));
    }
    setIsOpen(true);
  };

  const select = (index: number) => {
    onSelect(index);
    close();
  };

  // Cada cambio parte del estado más reciente, para no perder clics seguidos.
  const updateFilters = (change: (current: MechFilters) => Partial<MechFilters>) => {
    setFilters(current => ({ ...current, ...change(current) }));
    setActiveOption(0);
  };

  const toggleWeightClass = (value: WeightClassName) => updateFilters(current => ({
    weightClasses: current.weightClasses.includes(value)
      ? current.weightClasses.filter(weightClass => weightClass !== value)
      : [...current.weightClasses, value]
  }));

  const changeMinimum = (type: HardpointFilterType, step: number) => updateFilters(current => ({
    minHardpoints: {
      ...current.minHardpoints,
      [type]: Math.min(MAX_MINIMUM, Math.max(0, (current.minHardpoints[type] ?? 0) + step))
    }
  }));

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveOption(current => Math.min(current + 1, Math.max(filteredMechs.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveOption(current => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && isOpen && filteredMechs.length > 0) {
      event.preventDefault();
      select(filteredMechs[Math.min(activeOption, filteredMechs.length - 1)].index);
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      close();
    }
  };

  return (
    <div
      className="mech-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <span>
        CHASSIS / VARIANT
        {activeFilterCount > 0 && <span className="mech-picker-filter-count">{activeFilterCount} {activeFilterCount === 1 ? 'FILTER' : 'FILTERS'}</span>}
      </span>
      <input
        type="search"
        role="combobox"
        aria-label="Search chassis by name, variant or ID"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls="mech-options"
        aria-activedescendant={isOpen && filteredMechs[activeOption]
          ? `mech-option-${filteredMechs[activeOption].index}`
          : undefined}
        autoComplete="off"
        className="mech-picker-input"
        placeholder="Name, variant, ID or 3e 2m jj"
        value={isOpen ? query : `${getMechDisplayName(currentMech)} / ${currentMech.variant}`}
        onFocus={open}
        onClick={open}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveOption(0);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <div className="mech-options-panel">
          {/* Los botones no se llevan el foco del buscador, para seguir navegando con el teclado. */}
          <div
            className="mech-filters"
            onMouseDown={(event) => {
              if (event.target instanceof Element && event.target.closest('button')) event.preventDefault();
            }}
          >
            <div className="mech-filter-row">
              <span className="mech-filter-label">CLASS</span>
              {WEIGHT_CLASSES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                 
                  className="mech-filter-chip"
                  aria-pressed={filters.weightClasses.includes(value)}
                  title={value[0].toUpperCase() + value.slice(1)}
                  onClick={() => toggleWeightClass(value)}
                >
                  {label}
                </button>
              ))}
              <span className="mech-filter-label">TECH</span>
              {(['InnerSphere', 'Clan'] as const).map(techBase => (
                <button
                  key={techBase}
                  type="button"
                 
                  className="mech-filter-chip"
                  aria-pressed={filters.techBase === techBase}
                  onClick={() => updateFilters(current => ({ techBase: current.techBase === techBase ? null : techBase }))}
                >
                  {techBase === 'InnerSphere' ? 'IS' : 'Clan'}
                </button>
              ))}
              <span className="mech-filter-label">ROLE</span>
              <CheckboxDropdown
                label="Role"
                title="Combat role from the in-game unit card"
                options={roles.map(role => ({ value: role, label: role }))}
                selected={filters.roles}
                summary={describeSelection(filters.roles)}
                onToggle={(role) => updateFilters(current => ({ roles: toggleValue(current.roles, role) }))}
                onClear={() => updateFilters(() => ({ roles: [] }))}
              />
            </div>

            <div className="mech-filter-row">
              <span className="mech-filter-label">EQUIPMENT</span>
              <button
                type="button"
                className="mech-filter-chip"
                aria-pressed={filters.jumpJets}
                title="Only 'Mechs that can mount jump jets"
                onClick={() => updateFilters(current => ({ jumpJets: !current.jumpJets }))}
              >
                Jump jets
              </button>
              <button
                type="button"
                className="mech-filter-chip"
                aria-pressed={filters.ecm}
                title="Only 'Mechs with an ECM slot"
                onClick={() => updateFilters(current => ({ ecm: !current.ecm }))}
              >
                ECM
              </button>
              <button
                type="button"
                className="mech-filter-chip"
                aria-pressed={(filters.minHardpoints.ams ?? 0) > 0}
                title="Only 'Mechs with an AMS hardpoint"
                onClick={() => updateFilters(current => ({
                  minHardpoints: { ...current.minHardpoints, ams: (current.minHardpoints.ams ?? 0) > 0 ? 0 : 1 }
                }))}
              >
                AMS
              </button>
            </div>

            <div className="mech-filter-row">
              <span className="mech-filter-label" title="Omni hardpoints count as energy, ballistic or missile">MIN HARDPOINTS</span>
              {MINIMUM_TYPES.map(type => {
                const value = filters.minHardpoints[type] ?? 0;
                return (
                  <span key={type} className={value > 0 ? 'mech-filter-stepper is-active' : 'mech-filter-stepper'} data-weapon-type={type}>
                    <button type="button" aria-label={`Fewer ${type} hardpoints`} disabled={value === 0} onClick={() => changeMinimum(type, -1)}>−</button>
                    <span><b>{value}</b>{HARDPOINT_ABBREVIATIONS[type].trim()}</span>
                    <button type="button" aria-label={`More ${type} hardpoints`} disabled={value === MAX_MINIMUM} onClick={() => changeMinimum(type, 1)}>+</button>
                  </span>
                );
              })}
            </div>

            <div className="mech-filter-row">
              <label className="mech-filter-label" htmlFor="mech-filter-year">AVAILABLE BY</label>
              <select
                id="mech-filter-year"
                className="mech-filter-year"
                value={filters.maxYear ?? ''}
                onChange={(event) => {
                  const year = Number.parseInt(event.target.value, 10);
                  updateFilters(() => ({ maxYear: Number.isFinite(year) ? year : null }));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') close();
                }}
              >
                <option value="">Any year</option>
                {years.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
              <span className="mech-filter-label">DLC</span>
              <CheckboxDropdown
                label="DLC"
                title="Show only the 'Mechs from the base game and DLC you own"
                options={CONTENT_SOURCES.map(source => ({ value: source, label: source === BASE_GAME ? 'Base game' : `DLC ${source}` }))}
                selected={filters.dlcs}
                summary={describeContentSources(filters.dlcs)}
                onToggle={(source) => updateFilters(current => ({ dlcs: toggleValue(current.dlcs, source) }))}
                onClear={() => updateFilters(() => ({ dlcs: [] }))}
              />
              <button
                type="button"
                className="mech-filter-chip"
                aria-pressed={filters.hero}
                title="Only hero 'Mechs"
                onClick={() => updateFilters(current => ({ hero: !current.hero }))}
              >
                Hero
              </button>
            </div>

            <div className="mech-filter-row mech-filter-summary">
              <span>{filteredMechs.length} {filteredMechs.length === 1 ? 'variant' : 'variants'}</span>
              {activeFilterCount > 0 && (
                <button type="button" className="mech-filter-clear" onClick={() => updateFilters(() => EMPTY_MECH_FILTERS)}>
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="mech-options" id="mech-options" role="listbox" aria-label="Chassis results">
            {filteredMechs.length > 0 ? filteredMechs.map(({ mech, index }, optionIndex) => (
              <div
                key={mech.id}
                id={`mech-option-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                className={optionIndex === activeOption ? 'mech-option is-active' : 'mech-option'}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveOption(optionIndex)}
                onClick={() => select(index)}
              >
                <span>{getMechDisplayName(mech)}</span>
                <strong>
                  {mech.hero && <span className="mech-hero-tag" title="Hero 'Mech">HERO</span>}
                  {mech.variant}
                </strong>
                <HardpointSummary mech={mech} />
                <MechSpecs mech={mech} />
                <small>
                  {[`${mech.tonnageMax} t`, mech.introYear ? getAvailableYear(mech) : null, mech.role, mech.id !== mech.variant ? mech.id : null].filter(Boolean).join(' · ')}
                </small>
              </div>
            )) : (
              <p className="mech-no-results">No chassis match these filters</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
