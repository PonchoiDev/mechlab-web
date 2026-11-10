import { useRef, type MouseEvent, type PointerEvent } from 'react';

const LONG_PRESS_MS = 500;
// Lo que puede moverse el dedo sin que deje de ser una pulsación larga.
const MOVE_TOLERANCE_PX = 8;

// Pulsación larga en pantallas táctiles: abre el mismo menú que el clic derecho
// y evita que el toque se interprete además como un clic normal.
export const useLongPress = (onLongPress: (x: number, y: number) => void) => {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  return {
    onPointerDown: (event: PointerEvent) => {
      // Se reinicia con cualquier puntero: si tras una pulsación larga el navegador no llega a
      // generar el clic, el siguiente (también de ratón) no debe quedar cancelado.
      fired.current = false;
      cancel();
      if (event.pointerType !== 'touch') return;
      const { clientX, clientY } = event;
      start.current = { x: clientX, y: clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress(clientX, clientY);
      }, LONG_PRESS_MS);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // Se mide desde el punto inicial: movementX/Y es el salto entre eventos, y en táctil algunos
    // navegadores lo dan a 0, así que un arrastre lento no cancelaría el menú.
    onPointerMove: (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !start.current) return;
      if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onClickCapture: (event: MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };
};
