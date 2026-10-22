import type { MouseEvent } from 'react';

// Con el teclado (tecla de menú o Shift+F10) no hay coordenadas: el menú se abre junto al elemento.
export const getMenuPosition = (event: MouseEvent): { x: number; y: number } => {
  if (event.clientX !== 0 || event.clientY !== 0) return { x: event.clientX, y: event.clientY };
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: rect.left, y: rect.bottom + 4 };
};
