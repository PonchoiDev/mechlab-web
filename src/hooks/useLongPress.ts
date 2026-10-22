import { useRef, type MouseEvent, type PointerEvent } from 'react';

const LONG_PRESS_MS = 500;

// Pulsación larga en pantallas táctiles: abre el mismo menú que el clic derecho
// y evita que el toque se interprete además como un clic normal.
export const useLongPress = (onLongPress: (x: number, y: number) => void) => {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  return {
    onPointerDown: (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      const { clientX, clientY } = event;
      fired.current = false;
      cancel();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress(clientX, clientY);
      }, LONG_PRESS_MS);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onPointerMove: (event: PointerEvent) => {
      if (event.pointerType === 'touch' && (Math.abs(event.movementX) > 4 || Math.abs(event.movementY) > 4)) cancel();
    },
    onClickCapture: (event: MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };
};
