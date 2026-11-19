import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW_PREFERENCES, parseViewPreferences } from './viewPreferences';

describe('preferencias de vista del MechLab', () => {
  it('sin nada guardado, las ranuras se ven como celdas y el tablero no es compacto', () => {
    expect(parseViewPreferences(null)).toEqual({ editorSide: 'right', expandedSlots: true, compactBoard: false, inventoryOpen: false });
    expect(DEFAULT_VIEW_PREFERENCES.expandedSlots).toBe(true);
  });

  it('respeta lo que eligió el usuario la última vez', () => {
    expect(parseViewPreferences('{"expandedSlots":false,"compactBoard":true,"editorSide":"left"}'))
      .toEqual({ editorSide: 'left', expandedSlots: false, compactBoard: true, inventoryOpen: false });
  });

  it('CA13: recuerda si el inventario estaba abierto', () => {
    expect(parseViewPreferences('{"inventoryOpen":true}').inventoryOpen).toBe(true);
    expect(parseViewPreferences('{"inventoryOpen":"sí"}').inventoryOpen).toBe(false);
  });

  it('lo que no se entiende vuelve a la vista por defecto', () => {
    expect(parseViewPreferences('no es json')).toEqual(DEFAULT_VIEW_PREFERENCES);
    expect(parseViewPreferences('{"expandedSlots":"sí","editorSide":"arriba"}')).toEqual(DEFAULT_VIEW_PREFERENCES);
  });
});
