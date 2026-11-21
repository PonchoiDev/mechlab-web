import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { BuildListFiltersState } from '../hooks/useBuildListFilters';
import { countBuildListFilters, showBuildEntries, type BuildListConfig, type BuildListRow, type BuildTag } from '../utils/savedBuildsList';
import { BuildsListControls } from './BuildsListControls';
import { BuildTagList } from './BuildTagList';
import { WeaponTypeCounts } from './WeaponTypeCounts';

// Una build guardada ya resumida por su juego (utils/savedBuildRows.ts y utils/battletech/savedBuildRows.ts).
export interface PickerBuildEntry {
  listRow: BuildListRow;
  meta: string;
  weaponCounts: { type: string; count: number }[];
  tags: BuildTag[];
}

interface SavedBuildPickerProps {
  entries: PickerBuildEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  config: BuildListConfig;
  // Los filtros viven en el comparador, para que sigan al cerrar y volver a abrir el selector.
  filters: BuildListFiltersState;
}

// Sin 'Mech, la build ya no se puede abrir: sale en la lista, pero no se puede elegir.
const canOpen = (entry: PickerBuildEntry) => entry.listRow.chassis !== null;

// Selector de una build guardada para el comparador, como el de chasis: el campo es el buscador y el panel
// tiene los filtros de la ventana My builds. Común a los dos MechLabs.
export function SavedBuildPicker({ entries, selectedId, onSelect, config, filters }: SavedBuildPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(0);
  const idPrefix = useId();
  const { filter, sort, setQuery, clear } = filters;
  const shown = useMemo(() => showBuildEntries(entries, filter, sort), [entries, filter, sort]);
  const listRows = useMemo(() => entries.map(entry => entry.listRow), [entries]);
  const activeFilterCount = countBuildListFilters(filter);
  const selected = entries.find(entry => entry.listRow.id === selectedId) ?? null;

  const open = () => {
    if (!isOpen) setActiveOption(Math.max(shown.findIndex(entry => entry.listRow.id === selectedId), 0));
    setIsOpen(true);
  };

  const select = (entry: PickerBuildEntry) => {
    if (!canOpen(entry)) return;
    onSelect(entry.listRow.id);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveOption(current => Math.min(current + 1, Math.max(shown.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveOption(current => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && isOpen && shown.length > 0) {
      event.preventDefault();
      select(shown[Math.min(activeOption, shown.length - 1)]);
    } else if (event.key === 'Escape' && isOpen) {
      // Solo cierra el selector, no el comparador.
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
    }
  };

  return (
    <div
      className="mech-picker build-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
      }}
    >
      <span>SAVED BUILD</span>
      <input
        type="search"
        role="combobox"
        aria-label="Search saved builds by name, chassis or variant"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={`${idPrefix}-options`}
        aria-activedescendant={isOpen && shown[activeOption] ? `${idPrefix}-option-${shown[activeOption].listRow.id}` : undefined}
        autoComplete="off"
        className="mech-picker-input"
        placeholder="Name, chassis or variant"
        value={isOpen ? filter.query : selected?.listRow.name ?? ''}
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
        // Como en el selector de chasis: pulsar en el panel no se lleva el foco del buscador, salvo lo que se
        // escribe o se elige (el orden y los números de los contadores).
        <div
          className="mech-options-panel build-picker-panel"
          onMouseDown={(event) => {
            if (event.target instanceof Element && !event.target.closest('input, select, textarea')) event.preventDefault();
          }}
        >
          <BuildsListControls
            state={filters}
            config={config}
            rows={listRows}
            showSearch={false}
            leading={(
              <span className="mech-filter-summary">
                {shown.length === entries.length ? entries.length : `${shown.length} of ${entries.length}`} {entries.length === 1 ? 'build' : 'builds'}
                {activeFilterCount > 0 && ` · ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
                {(activeFilterCount > 0 || filter.query) && (
                  <button type="button" className="mech-filter-clear" onClick={clear}>Clear filters</button>
                )}
              </span>
            )}
          />
          <div className="mech-options" id={`${idPrefix}-options`} role="listbox" aria-label="Saved builds">
            {shown.length > 0 ? shown.map((entry, optionIndex) => (
              <div
                key={entry.listRow.id}
                id={`${idPrefix}-option-${entry.listRow.id}`}
                role="option"
                aria-selected={entry.listRow.id === selectedId}
                aria-disabled={!canOpen(entry)}
                className={optionIndex === activeOption ? 'build-option is-active' : 'build-option'}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveOption(optionIndex)}
                onClick={() => select(entry)}
              >
                <strong>{entry.listRow.name}</strong>
                <small>{entry.meta}</small>
                {canOpen(entry) && (
                  <span className="builds-item-loadout">
                    <WeaponTypeCounts counts={entry.weaponCounts} short={config.weaponShort} labels={config.weaponLabels} />
                    <BuildTagList tags={entry.tags} />
                  </span>
                )}
              </div>
            )) : (
              <p className="mech-no-results">No saved builds match these filters</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
