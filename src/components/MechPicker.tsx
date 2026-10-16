import { useMemo, useState, type KeyboardEvent } from 'react';
import type { Mech } from '../types/mech';
import { getMechDisplayName, matchesMechQuery } from '../utils/mechs';

interface MechPickerProps {
  mechs: Mech[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const filterMechs = (mechs: Mech[], query: string) =>
  mechs
    .map((mech, index) => ({ mech, index }))
    .filter(({ mech }) => matchesMechQuery(mech, query));

export function MechPicker({ mechs, selectedIndex, onSelect }: MechPickerProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(0);
  const currentMech = mechs[selectedIndex];
  const filteredMechs = useMemo(() => filterMechs(mechs, query), [mechs, query]);

  const close = () => {
    setQuery('');
    setIsOpen(false);
  };

  const open = () => {
    if (!isOpen) {
      const initialQuery = currentMech.name;
      const selectedOption = filterMechs(mechs, initialQuery).findIndex(({ index }) => index === selectedIndex);
      setQuery(initialQuery);
      setActiveOption(Math.max(selectedOption, 0));
    }
    setIsOpen(true);
  };

  const select = (index: number) => {
    onSelect(index);
    close();
  };

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
      <span>CHASSIS / VARIANT</span>
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
        placeholder="Search by name, variant or ID"
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
              {mech.id !== mech.variant && <small>{mech.id}</small>}
            </div>
          )) : (
            <p className="mech-no-results">No chassis found</p>
          )}
        </div>
      )}
    </div>
  );
}
