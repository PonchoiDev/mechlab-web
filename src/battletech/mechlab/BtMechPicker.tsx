import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { BtMech } from '../../types/battletech-mechlab';
import { FilterStepper } from '../../components/FilterStepper';
import { CheckboxDropdown } from '../../components/CheckboxDropdown';
import { getHardpointCount } from '../../utils/battletech/fitting';
import {
  countActiveMechFilters,
  DEFAULT_MECH_FILTERS,
  filterBtMechs,
  type BtMechFilters
} from '../../utils/battletech/filters';
import {
  HARDPOINT_LABELS,
  HARDPOINT_SHORT,
  HARDPOINTS,
  MECH_TAGS,
  SOURCE_LABELS,
  SOURCES,
  WEIGHT_CLASS_LABELS,
  WEIGHT_CLASSES
} from '../../utils/battletech/mechlabData';
import { MechIcon } from './MechIcon';

interface BtMechPickerProps {
  mechs: BtMech[];
  current: BtMech;
  onSelect: (mech: BtMech) => void;
  // El selector principal, más grande y en su propia fila, como en MW5.
  prominent?: boolean;
}

const MAX_MINIMUM = 6;
const MAX_JUMP_JETS = 8;

const toggle = <T,>(list: T[], value: T) => list.includes(value) ? list.filter(entry => entry !== value) : [...list, value];

const summarize = (labels: string[]) => labels.length === 0 ? 'All' : labels.length <= 2 ? labels.join(', ') : `${labels.length} selected`;

// Resumen de anclajes con el marcado del de MW5 (mech-option-hardpoints): en BATTLETECH los anclajes no
// tienen tamaño, todos los chasis admiten retrorreactores (se dice cuántos) y la fuente es el DLC.
export function HardpointSummary({ mech }: { mech: BtMech }) {
  return (
    <span className="mech-option-hardpoints">
      {HARDPOINTS.map(type => {
        const count = getHardpointCount(mech, type);
        return count > 0 ? (
          <span key={type} className="mech-hardpoint-tag" data-weapon-type={type} title={`${count} ${HARDPOINT_LABELS[type]} hardpoint${count > 1 ? 's' : ''}`}>
            {count}{HARDPOINT_SHORT[type]}
          </span>
        ) : null;
      })}
      <span className="mech-hardpoint-tag is-jump-jets" title={`Up to ${mech.maxJumpJets} jump jets`}>{mech.maxJumpJets}JJ</span>
      {mech.source !== 'base' && <span className="mech-hardpoint-tag is-dlc" title={`Comes with ${SOURCE_LABELS[mech.source]}`}>{SOURCE_LABELS[mech.source]}</span>}
    </span>
  );
}

// Selector de 'Mech: buscador con los filtros del MechLab de MW5 (clase, fuente, anclajes mínimos,
// retrorreactores y rol) y la lista de variantes con su icono.
export function BtMechPicker({ mechs, current, onSelect, prominent = false }: BtMechPickerProps) {
  const idPrefix = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<BtMechFilters>(DEFAULT_MECH_FILTERS);
  const [activeOption, setActiveOption] = useState(0);
  const filtered = useMemo(() => filterBtMechs(mechs, filters), [mechs, filters]);
  const activeFilters = countActiveMechFilters(filters);
  const update = (changes: Partial<BtMechFilters>) => {
    setFilters(currentFilters => ({ ...currentFilters, ...changes }));
    setActiveOption(0);
  };
  // Como en MW5: sin filtros se abre con las variantes del chasis actual; con filtros, toda la lista.
  const open = () => {
    if (!isOpen) {
      const query = activeFilters > 0 ? '' : current.name;
      setFilters(currentFilters => ({ ...currentFilters, query }));
      setActiveOption(Math.max(0, filterBtMechs(mechs, { ...filters, query }).findIndex(mech => mech.id === current.id)));
    }
    setIsOpen(true);
  };
  const close = () => {
    setIsOpen(false);
    update({ query: '' });
  };
  const select = (mech: BtMech) => {
    onSelect(mech);
    close();
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveOption(option => Math.min(option + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveOption(option => Math.max(option - 1, 0));
    } else if (event.key === 'Enter' && isOpen && filtered[activeOption]) {
      event.preventDefault();
      select(filtered[activeOption]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
      event.currentTarget.blur();
    }
  };

  return (
    <div
      className={prominent ? 'mech-picker bt-mech-picker is-prominent' : 'mech-picker bt-mech-picker'}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <span>
        CHASSIS / VARIANT
        {activeFilters > 0 && <span className="mech-picker-filter-count">{activeFilters} {activeFilters === 1 ? 'FILTER' : 'FILTERS'}</span>}
      </span>
      <input
        type="search"
        role="combobox"
        aria-label="Search 'Mechs by name, variant or role"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={`${idPrefix}-options`}
        autoComplete="off"
        className="mech-picker-input"
        placeholder="Name, variant, role or 3e 2m jj"
        value={isOpen ? filters.query : `${current.name} / ${current.variant}`}
        onFocus={open}
        onClick={open}
        onChange={(event) => {
          update({ query: event.target.value });
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        // Como en MW5: pulsar en el panel no se lleva el foco del buscador ni lo cierra, salvo en lo que se escribe.
        <div
          className="mech-options-panel bt-mech-options-panel"
          onMouseDown={(event) => {
            if (event.target instanceof Element && !event.target.closest('input, select, textarea')) event.preventDefault();
          }}
        >
          <div className="mech-filters">
            <div className="mech-filter-row">
              <span className="mech-filter-label">CLASS</span>
              {WEIGHT_CLASSES.map(weightClass => (
                <button
                  key={weightClass}
                  type="button"
                  className="mech-filter-chip"
                  aria-pressed={filters.weightClasses.includes(weightClass)}
                  title={WEIGHT_CLASS_LABELS[weightClass]}
                  onClick={() => update({ weightClasses: toggle(filters.weightClasses, weightClass) })}
                >
                  {WEIGHT_CLASS_LABELS[weightClass][0]}
                </button>
              ))}
              <span className="mech-filter-label">ROLE</span>
              <CheckboxDropdown
                label="Role"
                title="Role tags the game gives each variant"
                options={MECH_TAGS.map(tag => ({ value: tag, label: tag }))}
                selected={filters.tags}
                summary={summarize(filters.tags)}
                onToggle={(tag) => update({ tags: toggle(filters.tags, tag) })}
                onClear={() => update({ tags: [] })}
              />
            </div>
            <div className="mech-filter-row">
              <span className="mech-filter-label">MIN HARDPOINTS</span>
              {HARDPOINTS.map(type => (
                <FilterStepper
                  key={type}
                  type={type}
                  label={`${HARDPOINT_LABELS[type]} hardpoints`}
                  short={HARDPOINT_SHORT[type]}
                  value={filters.minHardpoints[type]}
                  max={MAX_MINIMUM}
                  onChange={value => update({ minHardpoints: { ...filters.minHardpoints, [type]: value } })}
                />
              ))}
              <FilterStepper
                label="jump jets"
                short="JJ"
                value={filters.minJumpJets}
                max={MAX_JUMP_JETS}
                onChange={value => update({ minJumpJets: value })}
              />
            </div>
            <div className="mech-filter-row">
              <span className="mech-filter-label">SOURCE</span>
              <CheckboxDropdown
                label="Source"
                title="Base game or the DLC that adds the 'Mech"
                options={SOURCES.map(source => ({ value: source, label: SOURCE_LABELS[source] }))}
                selected={filters.sources}
                summary={summarize(filters.sources.map(source => SOURCE_LABELS[source]))}
                onToggle={(source) => update({ sources: toggle(filters.sources, source) })}
                onClear={() => update({ sources: [] })}
              />
            </div>
            <div className="mech-filter-row mech-filter-summary">
              <span>{filtered.length} {filtered.length === 1 ? 'variant' : 'variants'}</span>
              {activeFilters > 0 && (
                <button type="button" className="mech-filter-clear" onClick={() => update({ ...DEFAULT_MECH_FILTERS, query: filters.query })}>
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="mech-options" id={`${idPrefix}-options`} role="listbox" aria-label="'Mech results">
            {filtered.length > 0 ? filtered.map((mech, index) => (
              <div
                key={mech.id}
                role="option"
                aria-selected={mech.id === current.id}
                className={index === activeOption ? 'mech-option bt-mech-option is-active' : 'mech-option bt-mech-option'}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveOption(index)}
                onClick={() => select(mech)}
              >
                <MechIcon mech={mech} size={40} />
                <span>{mech.name}</span>
                <strong>{mech.variant}</strong>
                <HardpointSummary mech={mech} />
                <small>
                  {[`${mech.tonnage} t`, WEIGHT_CLASS_LABELS[mech.weightClass], mech.role].filter(Boolean).join(' · ')}
                </small>
              </div>
            )) : (
              <p className="mech-no-results">No 'Mechs match these filters</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
