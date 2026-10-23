import { useMemo, useState, type KeyboardEvent } from 'react';
import type { Mech } from '../types/mech';
import {
  countActiveFilters,
  EMPTY_MECH_FILTERS,
  getHardpointCounts,
  getMechDisplayName,
  HARDPOINT_ABBREVIATIONS,
  HARDPOINT_FILTER_TYPES,
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

const filterMechs = (mechs: Mech[], query: string, filters: MechFilters) => {
  const parsed = parseMechQuery(query);
  const combined = mergeMechFilters(filters, parsed.filters);
  return mechs
    .map((mech, index) => ({ mech, index }))
    .filter(({ mech }) => matchesMechQuery(mech, parsed.text) && matchesMechFilters(mech, combined));
};

function HardpointSummary({ mech }: { mech: Mech }) {
  const counts = getHardpointCounts(mech);
  return (
    <span className="mech-option-hardpoints">
      {HARDPOINT_FILTER_TYPES.filter(type => counts[type] > 0).map(type => (
        <span key={type} className="mech-hardpoint-tag" data-weapon-type={type}>
          {counts[type]}{HARDPOINT_ABBREVIATIONS[type]}
        </span>
      ))}
      {hasJumpJets(mech) && <span className="mech-hardpoint-tag is-jump-jets">JJ</span>}
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
          <div className="mech-filters" onMouseDown={(event) => event.preventDefault()}>
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
              <button
                type="button"
               
                className="mech-filter-chip"
                aria-pressed={filters.jumpJets}
                title="Only 'Mechs that can mount jump jets"
                onClick={() => updateFilters(current => ({ jumpJets: !current.jumpJets }))}
              >
                Jump jets
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
                <strong>{mech.variant}</strong>
                <HardpointSummary mech={mech} />
                <small>{mech.tonnageMax} t{mech.id !== mech.variant ? ` · ${mech.id}` : ''}</small>
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
