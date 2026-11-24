import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { YamlMech } from '../types/yaml-mechlab';
import { filterYamlMechs, WEIGHT_CLASSES, type YamlWeightClass } from '../utils/yaml/mechList';

// Selector de 'Mech del MechLab de YAML con el marcado de los de MW5 y BATTLETECH (MechPicker y
// BtMechPicker): el buscador, la clase y la lista de variantes.

interface YamlMechPickerProps {
  mechs: YamlMech[];
  current: YamlMech;
  onSelect: (mech: YamlMech) => void;
}

const CLASS_LABELS: Record<YamlWeightClass, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy', assault: 'Assault' };

export function YamlMechPicker({ mechs, current, onSelect }: YamlMechPickerProps) {
  const idPrefix = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [classes, setClasses] = useState<YamlWeightClass[]>([]);
  const [activeOption, setActiveOption] = useState(0);
  const filtered = useMemo(() => filterYamlMechs(mechs, query, classes), [mechs, query, classes]);

  // Como en MW5: se abre con las variantes del chasis actual.
  const open = () => {
    if (!isOpen) {
      setQuery(current.chassis);
      setActiveOption(Math.max(0, filterYamlMechs(mechs, current.chassis, classes).findIndex(mech => mech.id === current.id)));
    }
    setIsOpen(true);
  };
  const close = () => {
    setIsOpen(false);
    setQuery('');
  };
  const select = (mech: YamlMech) => {
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
    <div className="mech-picker is-prominent" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
      <span>CHASSIS / VARIANT</span>
      <input
        type="search"
        role="combobox"
        aria-label="Search 'Mechs by name or variant"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={`${idPrefix}-options`}
        autoComplete="off"
        className="mech-picker-input"
        placeholder="Name or variant"
        value={isOpen ? query : `${current.chassis} / ${current.variant}`}
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
        <div className="mech-options-panel" onMouseDown={(event) => { if (event.target instanceof Element && !event.target.closest('input')) event.preventDefault(); }}>
          <div className="mech-filters">
            <div className="mech-filter-row">
              <span className="mech-filter-label">CLASS</span>
              {WEIGHT_CLASSES.map(weightClass => (
                <button
                  key={weightClass}
                  type="button"
                  className="mech-filter-chip"
                  aria-pressed={classes.includes(weightClass)}
                  title={CLASS_LABELS[weightClass]}
                  onClick={() => {
                    setClasses(current => current.includes(weightClass) ? current.filter(value => value !== weightClass) : [...current, weightClass]);
                    setActiveOption(0);
                  }}
                >
                  {CLASS_LABELS[weightClass][0]}
                </button>
              ))}
            </div>
            <div className="mech-filter-row mech-filter-summary">
              <span>{filtered.length} {filtered.length === 1 ? 'variant' : 'variants'}</span>
            </div>
          </div>
          <div className="mech-options" id={`${idPrefix}-options`} role="listbox" aria-label="'Mech results">
            {filtered.length > 0 ? filtered.map((mech, index) => (
              <div
                key={mech.id}
                role="option"
                aria-selected={mech.id === current.id}
                className={index === activeOption ? 'mech-option is-active' : 'mech-option'}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveOption(index)}
                onClick={() => select(mech)}
              >
                <span>{mech.chassis}</span>
                <strong>{mech.variant}</strong>
                <small>{mech.tonnage} t</small>
              </div>
            )) : <p className="mech-no-results">No 'Mechs match these filters</p>}
          </div>
        </div>
      )}
    </div>
  );
}
