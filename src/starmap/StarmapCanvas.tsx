import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameDate, StarmapData } from '../types/starmap';
import { getClusterLevels } from '../utils/starmap';
import { ZoneLevelText } from './ZonePanels';
import { StarmapRenderer, type MercZoneLayer, type TerritoryColors, type View } from './renderer';

export interface FocusRequest {
  // Un sistema se centra; varios se encuadran.
  systemIds: number[];
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
  questRoute: number[] | null;
  territoryColors: TerritoryColors;
  mercZones: MercZoneLayer;
  focus: FocusRequest | null;
  onHover: (systemId: number | null) => void;
  onSelect: (systemId: number | null) => void;
  // Clic dentro de una zona de conflicto, sin una estrella debajo.
  onZone: (clusterId: string) => void;
  // Clic en una zona de mercenarios dibujada.
  onMercZone: (zoneId: string) => void;
}

const MAX_SCALE = 14;
const FOCUS_SCALE = 4;
// Margen al encuadrar varios sistemas, en años luz, y ancho que tapa la ficha a la izquierda.
const FIT_PADDING = 60;
const PANEL_INSET = 420;
const MOBILE_WIDTH = 760;
const DRAG_THRESHOLD = 5;
const WHEEL_SPEED = 0.0015;

// Límites del mapa en años luz, para encuadrarlo y no perderlo al arrastrar.
const getBounds = (data: StarmapData) => {
  const xs = data.systems.map(system => system.x);
  const ys = data.systems.map(system => system.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

// Lo que hay bajo el ratón sin una estrella: la facción y, si cae dentro, la zona de conflicto.
const hintAt = (renderer: StarmapRenderer, point: { x: number; y: number }) => {
  const faction = renderer.ownerAt(point.x, point.y);
  const cluster = renderer.clusterAt(point.x, point.y);
  const zone = renderer.mercZoneAt(point.x, point.y);
  const merc = zone ? { title: zone.title, note: zone.note } : null;
  return faction || cluster || merc ? { faction, cluster, merc, ...point } : null;
};

// Nombre de la zona y lo que pide en cada modo; al pulsar se abre su ficha.
function ZoneHint({ data, clusterId }: { data: StarmapData; clusterId: string }) {
  const levels = getClusterLevels(data, clusterId);
  return (
    <p className="starmap-hint-zone">
      <b>{data.clusters[clusterId].name}</b>
      {levels.map((level, index) => (
        // Dos niveles del mismo modo pueden coincidir en reputación y dificultad: la posición los distingue.
        <small key={index}>
          {level.mode && levels.length > 1 && `${level.mode === 'campaign' ? 'Campaign' : 'Career'}: `}
          <ZoneLevelText level={level} />
        </small>
      ))}
      <small className="starmap-hint-action">Click for zone details</small>
    </p>
  );
}

// En el móvil, la ficha abierta tapa la parte de arriba del mapa y los cajones y la fecha la de abajo:
// se encuadra en la franja que queda entre ellos, medida en el momento (la ficha cambia de alto).
const getVisibleBand = (container: HTMLElement): { top: number; bottom: number } => {
  const box = container.getBoundingClientRect();
  const panel = document.querySelector('.starmap-panel')?.getBoundingClientRect();
  const below = [...document.querySelectorAll('.starmap-drawers, .starmap-date')]
    .map(element => element.getBoundingClientRect())
    .filter(rect => rect.height > 0);
  const top = panel ? Math.max(0, panel.bottom - box.top) : 0;
  const bottom = below.length > 0 ? Math.min(...below.map(rect => rect.top - box.top)) : box.height;
  // Si casi no queda hueco, se usa la pantalla entera: mejor tapado que fuera de la vista.
  return bottom - top > 80 ? { top, bottom } : { top: 0, bottom: box.height };
};

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function StarmapCanvas({ data, date, animateDate, hoveredId, selectedId, questRoute, territoryColors, mercZones, focus, onHover, onSelect, onZone, onMercZone }: StarmapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StarmapRenderer | null>(null);
  const fitScaleRef = useRef(1);
  const animationRef = useRef(0);
  const callbacksRef = useRef({ onHover, onSelect, onZone, onMercZone });
  // Facción de la zona bajo el ratón cuando no hay una estrella cerca: la ficha es del sistema
  // elegido, y sin esta etiqueta parecería que describe la zona.
  // Facción y zona de conflicto bajo el ratón cuando no hay una estrella debajo.
  const [territoryHint, setTerritoryHint] = useState<{
    faction: string | null;
    cluster: string | null;
    merc: { title: string; note: string | null } | null;
    x: number;
    y: number;
  } | null>(null);
  // Última posición del ratón sobre el mapa: al cambiar la fecha con el teclado, la etiqueta se
  // vuelve a calcular ahí sin esperar a que se mueva.
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const boundsRef = useRef(getBounds(data));

  useEffect(() => {
    callbacksRef.current = { onHover, onSelect, onZone, onMercZone };
  }, [onHover, onSelect, onZone, onMercZone]);

  // minScale: al encuadrar en la franja del móvil puede hacer falta alejarse más que con el zoom a mano.
  const setView = (view: View, minScale = fitScaleRef.current * 0.7) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const bounds = boundsRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(minScale, view.scale));
    // El centro puede salir un cuarto de pantalla del mapa en vertical: en el móvil, lo elegido se
    // encuadra por encima o por debajo del centro, y un sistema del borde lo necesita.
    const marginY = (canvasRef.current?.clientHeight ?? 0) / 4 / scale;
    renderer.view = {
      x: Math.min(bounds.maxX, Math.max(bounds.minX, view.x)),
      y: Math.min(bounds.maxY + marginY, Math.max(bounds.minY - marginY, view.y)),
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
    const minScale = Math.min(fitScaleRef.current * 0.7, target.scale);
    if (prefersReducedMotion()) {
      setView(target, minScale);
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
      }, minScale);
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
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setDate(date, animateDate && !prefersReducedMotion());
    const mouse = mouseRef.current;
    if (!mouse) return;
    setTerritoryHint(renderer.systemAt(mouse.x, mouse.y) ? null : hintAt(renderer, mouse));
  }, [date, data, animateDate]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.hoveredId = hoveredId;
    renderer.selectedId = selectedId;
    renderer.questRoute = questRoute;
    renderer.requestDraw();
  }, [hoveredId, selectedId, questRoute]);

  useEffect(() => {
    rendererRef.current?.setTerritoryColors(territoryColors);
  }, [territoryColors]);

  useEffect(() => {
    rendererRef.current?.setMercZones(mercZones);
  }, [mercZones]);

  useEffect(() => {
    if (!focus) return;
    const systems = data.systems.filter(candidate => focus.systemIds.includes(candidate.id));
    const renderer = rendererRef.current;
    const container = containerRef.current;
    if (systems.length === 0 || !renderer || !container) return;
    const { width, height } = container.getBoundingClientRect();
    const isMobile = width <= MOBILE_WIDTH;
    // En el móvil, el centro de la franja visible queda por debajo o por encima del de la pantalla. La Y
    // del mapa crece hacia arriba y la de la pantalla hacia abajo: el desplazamiento se suma.
    const band = isMobile ? getVisibleBand(container) : { top: 0, bottom: height };
    const bandOffset = (band.top + band.bottom) / 2 - height / 2;
    if (systems.length === 1) {
      const scale = Math.max(renderer.view.scale, FOCUS_SCALE);
      animateTo({ x: systems[0].x, y: systems[0].y + bandOffset / scale, scale });
      return;
    }
    // En escritorio la ficha tapa la izquierda: se encuadra en el resto y se desplaza el centro.
    const inset = isMobile ? 0 : PANEL_INSET;
    const xs = systems.map(system => system.x);
    const ys = systems.map(system => system.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const fit = Math.min((width - inset) / (maxX - minX + FIT_PADDING), (band.bottom - band.top) / (maxY - minY + FIT_PADDING));
    // En la franja del móvil el mapa entero se ve más pequeño que en la pantalla: el mínimo es el que
    // lo deja caber en ella, para que nada de lo elegido quede debajo de la ficha.
    const bounds = boundsRef.current;
    const bandFit = Math.min(width / (bounds.maxX - bounds.minX + FIT_PADDING), (band.bottom - band.top) / (bounds.maxY - bounds.minY + FIT_PADDING));
    const scale = Math.min(FOCUS_SCALE, Math.max(isMobile ? bandFit : fitScaleRef.current, fit));
    animateTo({ x: (minX + maxX) / 2 - inset / 2 / scale, y: (minY + maxY) / 2 + bandOffset / scale, scale });
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
          mouseRef.current = point;
          // Sobre el logo de una zona de mercenarios manda la zona, aunque haya una estrella debajo.
          const logo = renderer.mercLogoAt(point.x, point.y);
          const system = logo ? null : renderer.systemAt(point.x, point.y);
          callbacksRef.current.onHover(system?.id ?? null);
          setTerritoryHint(system ? null : hintAt(renderer, point));
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
      // El logo de una zona de mercenarios manda; después la estrella, la zona de mercenarios dibujada
      // y por último la zona de conflicto.
      const logo = renderer.mercLogoAt(point.x, point.y);
      const system = logo ? null : renderer.systemAt(point.x, point.y, event.pointerType === 'mouse' ? 14 : 24);
      const merc = logo ?? (system ? null : renderer.mercZoneAt(point.x, point.y));
      const cluster = system || merc ? null : renderer.clusterAt(point.x, point.y);
      if (merc) callbacksRef.current.onMercZone(merc.zone.id);
      else if (cluster) callbacksRef.current.onZone(cluster);
      else callbacksRef.current.onSelect(system?.id ?? null);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = position(event);
      zoomAt(point.x, point.y, Math.exp(-event.deltaY * WHEEL_SPEED));
    };

    const onLeave = () => {
      mouseRef.current = null;
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
        <div
          className="starmap-hint"
          style={{ left: territoryHint.x + 16, top: territoryHint.y + 14, '--faction': territoryHint.faction ? data.factions[territoryHint.faction].color : data.colors.cluster } as CSSProperties}
        >
          {territoryHint.faction && <p>{data.factions[territoryHint.faction].name}</p>}
          {territoryHint.merc && (
            <p className="starmap-hint-merc">
              <b>{territoryHint.merc.title}</b>
              {territoryHint.merc.note && <small>{territoryHint.merc.note}</small>}
            </p>
          )}
          {/* Con una zona de mercenarios debajo, el clic abre la suya: la de conflicto se omite. */}
          {territoryHint.cluster && !territoryHint.merc && <ZoneHint data={data} clusterId={territoryHint.cluster} />}
        </div>
      )}
      <div className="starmap-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={() => zoomFromCenter(1.4)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomFromCenter(1 / 1.4)} aria-label="Zoom out">−</button>
        <button type="button" onClick={resetView} aria-label="Show the whole map">⤢</button>
      </div>
    </div>
  );
}
