// Preferencias de vista de los MechLabs, guardadas en el navegador de cada visitante.

export interface ViewPreferences {
  // Lado de la pantalla en el que se abre el panel de componente.
  editorSide: 'left' | 'right';
  // Ranuras de las tarjetas como celdas, como la vista Detalles del mechlab del juego. Es la vista por
  // defecto: deja ver de un vistazo cuánto cabe en cada componente.
  expandedSlots: boolean;
  // Oculta la imagen de Sarna y pone el tablero en cinco columnas centradas.
  compactBoard: boolean;
  // El inventario con todo el arsenal, en la columna del lado contrario al panel de componente.
  inventoryOpen: boolean;
}

export const DEFAULT_VIEW_PREFERENCES: ViewPreferences = { editorSide: 'right', expandedSlots: true, compactBoard: false, inventoryOpen: false };

// Lo guardado manda; un valor que no se entiende vuelve al de por defecto.
export const parseViewPreferences = (raw: string | null): ViewPreferences => {
  try {
    const stored = JSON.parse(raw ?? '{}') as Partial<Record<keyof ViewPreferences, unknown>>;
    return {
      editorSide: stored.editorSide === 'left' ? 'left' : 'right',
      expandedSlots: typeof stored.expandedSlots === 'boolean' ? stored.expandedSlots : DEFAULT_VIEW_PREFERENCES.expandedSlots,
      compactBoard: stored.compactBoard === true,
      inventoryOpen: stored.inventoryOpen === true
    };
  } catch {
    return DEFAULT_VIEW_PREFERENCES;
  }
};
