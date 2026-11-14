import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { BtHardpoint, BtMech } from '../../types/battletech-mechlab';
import { CheckboxDropdown } from '../../components/CheckboxDropdown';
import { getHardpointCount } from '../../utils/battletech/fitting';
import {
  countActiveMechFilters,
  DEFAULT_MECH_FILTERS,
  filterBtMechs,
  type BtMechFilters
} from '../../utils/battletech/filters';
import {
  getMechDisplayName,
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
}

const MAX_MINIMUM = 6;
const MAX_JUMP_JETS = 8;

const toggle = <T,>(list: T[], value: T) => list.includes(value) ? list.filter(entry => entry !== value) : [...list, value];

const summarize = (labels: string[]) => labels.length === 0 ? 'All' : labels.length <= 2 ? labels.join(', ') : `${labels.length} selected`;

export function HardpointSummary({ mech }: { mech: BtMech }) {
  return (
    <span className="bt-hardpoint-summary">
      {HARDPOINTS.map(type => {
        const count = getHardpointCount(mech, type);
        return count > 0 ? (
          <span key={type} className="bt-hardpoint-tag" data-weapon-type={type} title={`${count} ${HARDPOINT_LABELS[type]}`}>
            {count}{HARDPOINT_SHORT[type]}
          </span>
        ) : null;
      })}
      <span className="bt-hardpoint-tag is-jump" title={`Up to ${mech.maxJumpJets} jump jets`}>{mech.maxJumpJets}JJ</span>
    </span>
  );
}

// Selector de 'Mech: buscador con los filtros del MechLab de MW5 (clase, fuente, anclajes mínimos,
// retrorreactores y rol) y la lista de variantes con su icono.
export function BtMechPicker({ mechs, current, onSelect }: BtMechPickerProps) {
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
  const close = () => {
    setIsOpen(false);
    update({ query: '' });
  };
  const select = (mech: BtMech) => {
    onSelect(mech);
    close();
    (document.activeElement as HTMLElement | null)?.blur();
  };
  const changeMinimum = (type: BtHardpoint, delta: number) => update({
    minHardpoints: { ...filters.minHardpoints, [type]: Math.min(MAX_MINIMUM, Math.max(0, filters.minHardpoints[type] + delta)) }
  });

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
      close();
      event.currentTarget.blur();
    }
  };

  return (
    <div
      className="mech-picker bt-mech-picker"
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
        placeholder="Name, variant or role"
        value={isOpen ? filters.query : `${getMechDisplayName(current)} · ${current.tonnage} t`}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onChange={(event) => {
          update({ query: event.target.value });
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <div className="mech-options-panel bt-mech-options-panel">
          <div
            className="mech-filters"
            onMouseDown={(event) => {
              if (event.target instanceof Element && event.target.closest('button')) event.preventDefault();
            }}
          >
            <div className="mech-filter-row">
              <span className="mech-filter-label">CLASS</span>
              {WEIGHT_CLASSES.map(weightClass => (
                <button
                  key={weightClass}
                  type="button"
                  className="mech-filter-chip"
                  aria-pressed={filters.weightClasses.includes(weightClass)}
                  onClick={() => update({ weightClasses: toggle(filters.weightClasses, weightClass) })}
                >
                  {WEIGHT_CLASS_LABELS[weightClass]}
                </button>
              ))}
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
              {HARDPOINTS.map(type => {
                const value = filters.minHardpoints[type];
                return (
                  <span key={type} className={value > 0 ? 'mech-filter-stepper is-active' : 'mech-filter-stepper'} data-weapon-type={type}>
                    <button type="button" aria-label={`Fewer ${HARDPOINT_LABELS[type]} hardpoints`} disabled={value === 0} onClick={() => changeMinimum(type, -1)}>−</button>
                    <span title={HARDPOINT_LABELS[type]}><b>{value}</b>{HARDPOINT_SHORT[type]}</span>
                    <button type="button" aria-label={`More ${HARDPOINT_LABELS[type]} hardpoints`} disabled={value === MAX_MINIMUM} onClick={() => changeMinimum(type, 1)}>+</button>
                  </span>
                );
              })}
              <span className={filters.minJumpJets > 0 ? 'mech-filter-stepper is-active' : 'mech-filter-stepper'} title="Jump jets the chassis can mount">
                <button type="button" aria-label="Fewer jump jets" disabled={filters.minJumpJets === 0} onClick={() => update({ minJumpJets: filters.minJumpJets - 1 })}>−</button>
                <span><b>{filters.minJumpJets}</b>JJ</span>
                <button type="button" aria-label="More jump jets" disabled={filters.minJumpJets === MAX_JUMP_JETS} onClick={() => update({ minJumpJets: filters.minJumpJets + 1 })}>+</button>
              </span>
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
                <span className="bt-mech-option-name">
                  {mech.name} <strong>{mech.variant}</strong>
                </span>
                <HardpointSummary mech={mech} />
                <small>
                  {[`${mech.tonnage} t`, WEIGHT_CLASS_LABELS[mech.weightClass], mech.role, mech.source !== 'base' ? SOURCE_LABELS[mech.source] : null].filter(Boolean).join(' · ')}
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
