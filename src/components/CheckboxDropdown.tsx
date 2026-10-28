import { useEffect, useRef, useState } from 'react';

interface CheckboxDropdownProps<T extends string | number> {
  // Nombre del grupo para los lectores de pantalla (DLC, Role).
  label: string;
  title: string;
  options: { value: T; label: string }[];
  selected: T[];
  // Texto del botón con la selección resumida: «All», «Base, DLC 7», «3 selected».
  summary: string;
  onToggle: (value: T) => void;
  onClear: () => void;
}

// Desplegable con casillas para marcar varias opciones de un filtro del selector. Las casillas son
// botones para que, como el resto de filtros, no quiten el foco al buscador.
export function CheckboxDropdown<T extends string | number>({
  label,
  title,
  options,
  selected,
  summary,
  onToggle,
  onClear
}: CheckboxDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

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
      className="checkbox-dropdown"
      ref={containerRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.stopPropagation();
          setIsOpen(false);
          // Las casillas desaparecen al cerrar: el foco vuelve al botón para no perderse.
          toggleRef.current?.focus();
        }
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        className="mech-filter-chip checkbox-dropdown-toggle"
        aria-expanded={isOpen}
        aria-pressed={selected.length > 0}
        aria-label={`${label}: ${summary}`}
        title={title}
        onClick={() => setIsOpen(open => !open)}
      >
        {summary} <span aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div className="checkbox-dropdown-menu" role="group" aria-label={label}>
          {options.map(option => {
            const checked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="checkbox"
                aria-checked={checked}
                className="checkbox-dropdown-option"
                onClick={() => onToggle(option.value)}
              >
                <span className="checkbox-dropdown-box" aria-hidden="true">{checked ? '✓' : ''}</span>
                {option.label}
              </button>
            );
          })}
          <button type="button" className="mech-filter-clear checkbox-dropdown-clear" disabled={selected.length === 0} onClick={onClear}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
