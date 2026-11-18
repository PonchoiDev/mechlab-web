import { useState } from 'react';
import { DEFAULT_VIEW_PREFERENCES, parseViewPreferences, type ViewPreferences } from '../utils/viewPreferences';

export type { ViewPreferences };

// Cada MechLab guarda su vista en su propia clave (BATTLETECH usa mw-builder:battletech:view).
const MERCS_STORAGE_KEY = 'mw-builder:mercs:view';

const read = (storageKey: string): ViewPreferences => {
  try {
    return parseViewPreferences(window.localStorage.getItem(storageKey));
  } catch {
    return DEFAULT_VIEW_PREFERENCES;
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
