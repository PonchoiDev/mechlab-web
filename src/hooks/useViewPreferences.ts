import { useState } from 'react';

// Cada MechLab guarda su vista en su propia clave (BATTLETECH usa mw-builder:battletech:view).
const MERCS_STORAGE_KEY = 'mw-builder:mercs:view';

export interface ViewPreferences {
  // Lado de la pantalla en el que se abre el panel de componente.
  editorSide: 'left' | 'right';
  // Ranuras de las tarjetas como celdas, como la vista Detalles del mechlab del juego.
  expandedSlots: boolean;
  // Oculta la imagen de Sarna y pone el tablero en cinco columnas centradas.
  compactBoard: boolean;
}

const DEFAULTS: ViewPreferences = { editorSide: 'right', expandedSlots: false, compactBoard: false };

const read = (storageKey: string): ViewPreferences => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Partial<ViewPreferences>;
    return {
      editorSide: stored.editorSide === 'left' ? 'left' : 'right',
      expandedSlots: stored.expandedSlots === true,
      compactBoard: stored.compactBoard === true
    };
  } catch {
    return DEFAULTS;
  }
};

// Preferencias de vista de cada visitante, guardadas en su navegador.
export const useViewPreferences = (storageKey = MERCS_STORAGE_KEY) => {
  const [preferences, setPreferences] = useState<ViewPreferences>(() => read(storageKey));

  const update = (changes: Partial<ViewPreferences>) => {
    setPreferences(current => {
      const next = { ...current, ...changes };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Sin almacenamiento, la preferencia dura hasta recargar la página.
      }
      return next;
    });
  };

  return {
    ...preferences,
    toggleEditorSide: () => update({ editorSide: preferences.editorSide === 'left' ? 'right' : 'left' }),
    toggleExpandedSlots: () => update({ expandedSlots: !preferences.expandedSlots }),
    toggleCompactBoard: () => update({ compactBoard: !preferences.compactBoard })
  };
};
