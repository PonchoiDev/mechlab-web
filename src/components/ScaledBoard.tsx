import { useEffect, useRef, useState, type ReactNode } from 'react';

// Ancho con el que se dibuja el tablero compacto antes de reducirlo: el de sus cinco columnas con las armas
// en una línea.
const BOARD_WIDTH = 1100;
// Desde aquí el tablero usa la rejilla compacta de cinco columnas (App.css); por debajo, la del móvil, y no se
// reduce.
const WIDE = '(min-width: 1001px)';

// El tablero de un lado de la comparación, solo para mirar (inert: sin clics, foco, menús ni arrastre). En
// pantalla ancha se dibuja con el ancho del tablero compacto y se reduce con zoom hasta caber en su columna,
// para que los dos tableros vayan lado a lado con la misma distribución que en el MechLab. Con zoom, y no con
// transform, la altura que ocupa también se reduce.
export function ScaledBoard({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const wide = window.matchMedia(WIDE);
    const update = () => setScale(wide.matches ? Math.min(1, element.clientWidth / BOARD_WIDTH) : 1);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    wide.addEventListener('change', update);
    update();
    return () => {
      observer.disconnect();
      wide.removeEventListener('change', update);
    };
  }, []);

  return (
    <div ref={container} className="compare-board" inert>
      <div style={scale < 1 ? { width: BOARD_WIDTH, zoom: scale } : undefined}>{children}</div>
    </div>
  );
}
