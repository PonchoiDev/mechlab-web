import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameDate, StarmapData } from '../types/starmap';
import { StarmapRenderer, type View } from './renderer';

export interface FocusRequest {
  systemId: number;
  // Cambia en cada petición, para volver a centrar aunque sea el mismo sistema.
  sequence: number;
}

interface StarmapCanvasProps {
  data: StarmapData;
  date: GameDate;
  // true cuando la fecha cambia de golpe (un evento): el cambio se anima.
  animateDate: boolean;
  hoveredId: number | null;
  selectedId: number | null;
  focus: FocusRequest | null;
  onHover: (systemId: number | null) => void;
  onSelect: (systemId: number | null) => void;
}

const MAX_SCALE = 14;
const FOCUS_SCALE = 4;
const DRAG_THRESHOLD = 5;
const WHEEL_SPEED = 0.0015;

// Límites del mapa en años luz, para encuadrarlo y no perderlo al arrastrar.
const getBounds = (data: StarmapData) => {
  const xs = data.systems.map(system => system.x);
  const ys = data.systems.map(system => system.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function StarmapCanvas({ data, date, animateDate, hoveredId, selectedId, focus, onHover, onSelect }: StarmapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StarmapRenderer | null>(null);
  const fitScaleRef = useRef(1);
  const animationRef = useRef(0);
  const callbacksRef = useRef({ onHover, onSelect });
  // Facción de la zona bajo el ratón cuando no hay una estrella cerca: la ficha es del sistema
  // elegido, y sin esta etiqueta parecería que describe la zona.
  const [territoryHint, setTerritoryHint] = useState<{ faction: string; x: number; y: number } | null>(null);
  const boundsRef = useRef(getBounds(data));

  useEffect(() => {
    callbacksRef.current = { onHover, onSelect };
  }, [onHover, onSelect]);

  const setView = (view: View) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const bounds = boundsRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(fitScaleRef.current * 0.7, view.scale));
    renderer.view = {
      x: Math.min(bounds.maxX, Math.max(bounds.minX, view.x)),
      y: Math.min(bounds.maxY, Math.max(bounds.minY, view.y)),
      scale
    };
    renderer.requestDraw();
  };

  const zoomAt = (screenX: number, screenY: number, factor: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const [worldX, worldY] = renderer.toWorld(screenX, screenY);
    const scale = Math.min(MAX_SCALE, Math.max(fitScaleRef.current * 0.7, renderer.view.scale * factor));
    // El punto bajo el cursor se queda quieto al acercar o alejar.
    const rect = canvasRef.current!.getBoundingClientRect();
    setView({
      x: worldX - (screenX - rect.width / 2) / scale,
      y: worldY + (screenY - rect.height / 2) / scale,
      scale
    });
  };

  const animateTo = (target: View) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    cancelAnimationFrame(animationRef.current);
    if (prefersReducedMotion()) {
      setView(target);
      return;
    }
    const start = { ...renderer.view };
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / 450);
      const ease = 1 - (1 - t) ** 3;
      setView({
        x: start.x + (target.x - start.x) * ease,
        y: start.y + (target.y - start.y) * ease,
        scale: start.scale + (target.scale - start.scale) * ease
      });
      if (t < 1) animationRef.current = requestAnimationFrame(step);
    };
    animationRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const renderer = new StarmapRenderer(canvas, data);
    rendererRef.current = renderer;
    boundsRef.current = getBounds(data);
    let fitted = false;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      renderer.resize(width, height, window.devicePixelRatio || 1);
      const bounds = boundsRef.current;
      fitScaleRef.current = Math.min(width / (bounds.maxX - bounds.minX + 60), height / (bounds.maxY - bounds.minY + 60));
      if (!fitted) {
        fitted = true;
        renderer.view = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, scale: fitScaleRef.current };
      }
      setView(renderer.view);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationRef.current);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    rendererRef.current?.setDate(date, animateDate && !prefersReducedMotion());
  }, [date, data, animateDate]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.hoveredId = hoveredId;
    renderer.selectedId = selectedId;
    renderer.requestDraw();
  }, [hoveredId, selectedId]);

  useEffect(() => {
    if (!focus) return;
    const system = data.systems.find(candidate => candidate.id === focus.systemId);
    const renderer = rendererRef.current;
    if (!system || !renderer) return;
    animateTo({ x: system.x, y: system.y, scale: Math.max(renderer.view.scale, FOCUS_SCALE) });
  }, [focus, data]);

  // Arrastre con un dedo o el ratón, y zoom con dos dedos o la rueda.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = false;
    let pinchDistance = 0;

    const position = (event: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, position(event));
      moved = false;
      cancelAnimationFrame(animationRef.current);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const point = position(event);
      const previous = pointers.get(event.pointerId);
      if (!previous) {
        if (event.pointerType === 'mouse') {
          const system = renderer.systemAt(point.x, point.y);
          const owner = system ? null : renderer.ownerAt(point.x, point.y);
          callbacksRef.current.onHover(system?.id ?? null);
          setTerritoryHint(owner ? { faction: owner, ...point } : null);
        }
        return;
      }
      pointers.set(event.pointerId, point);
      setTerritoryHint(null);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDistance > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, distance / pinchDistance);
        pinchDistance = distance;
        moved = true;
        return;
      }
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        pointers.set(event.pointerId, previous);
        return;
      }
      moved = true;
      setView({ ...renderer.view, x: renderer.view.x - dx / renderer.view.scale, y: renderer.view.y + dy / renderer.view.scale });
    };

    const onPointerUp = (event: PointerEvent) => {
      const renderer = rendererRef.current;
      const wasTap = !moved && pointers.size === 1;
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchDistance = 0;
      if (!renderer || !wasTap) return;
      const point = position(event);
      // Con el dedo se acepta un toque algo más lejos de la estrella.
      const system = renderer.systemAt(point.x, point.y, event.pointerType === 'mouse' ? 14 : 24);
      callbacksRef.current.onSelect(system?.id ?? null);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = position(event);
      zoomAt(point.x, point.y, Math.exp(-event.deltaY * WHEEL_SPEED));
    };

    const onLeave = () => {
      callbacksRef.current.onHover(null);
      setTerritoryHint(null);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  const zoomFromCenter = (factor: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    zoomAt(rect.width / 2, rect.height / 2, factor);
  };

  const resetView = () => {
    const bounds = boundsRef.current;
    animateTo({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, scale: fitScaleRef.current });
  };

  return (
    <div className="starmap-canvas" ref={containerRef}>
      <canvas ref={canvasRef} role="img" aria-label="Star map of the Inner Sphere. Use the search box to find a system." />
      {territoryHint && (
        <p
          className="starmap-hint"
          style={{ left: territoryHint.x + 16, top: territoryHint.y + 14, '--faction': data.factions[territoryHint.faction].color } as CSSProperties}
        >
          {data.factions[territoryHint.faction].name}
        </p>
      )}
      <div className="starmap-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={() => zoomFromCenter(1.4)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomFromCenter(1 / 1.4)} aria-label="Zoom out">−</button>
        <button type="button" onClick={resetView} aria-label="Show the whole map">⤢</button>
      </div>
    </div>
  );
}
