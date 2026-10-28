import { useEffect, useRef, useState } from 'react';
import { CONTENT_SOURCES, BASE_GAME, describeContentSources } from '../utils/mechs';

interface DlcFilterProps {
  selected: number[];
  onToggle: (source: number) => void;
  onClear: () => void;
}

// Desplegable con una casilla por fuente de contenido (juego base y DLC 1 a 9). Las casillas son
// botones para que, como el resto de filtros, no quiten el foco al buscador del selector.
export function DlcFilter({ selected, onToggle, onClear }: DlcFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Se cierra al pulsar fuera del desplegable.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  return (
    <div
      className="dlc-filter"
      ref={containerRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.stopPropagation();
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="mech-filter-chip dlc-filter-toggle"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-pressed={selected.length > 0}
        title="Show only the 'Mechs from the base game and DLC you own"
        onClick={() => setIsOpen(open => !open)}
      >
        {describeContentSources(selected)} <span aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div className="dlc-filter-menu" role="group" aria-label="DLC">
          {CONTENT_SOURCES.map(source => {
            const checked = selected.includes(source);
            return (
              <button
                key={source}
                type="button"
                role="checkbox"
                aria-checked={checked}
                className="dlc-filter-option"
                onClick={() => onToggle(source)}
              >
                <span className="dlc-filter-box" aria-hidden="true">{checked ? '✓' : ''}</span>
                {source === BASE_GAME ? 'Base game' : `DLC ${source}`}
              </button>
            );
          })}
          <button type="button" className="mech-filter-clear dlc-filter-clear" disabled={selected.length === 0} onClick={onClear}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
