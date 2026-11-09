import type { ArenaSystem, MultiMission, RepairMarkup, StarmapData } from '../types/starmap';
import { getClusterOutline } from './starmap';

type Point = [number, number];

// Contorno de cada zona de conflicto, el mismo que dibuja el mapa, para saber qué zona hay bajo el ratón.
export const getClusterOutlines = (data: StarmapData, padding: number): Map<string, Point[]> => {
  const byCluster = new Map<string, Point[]>();
  for (const system of data.systems) {
    if (system.cluster) byCluster.set(system.cluster, [...(byCluster.get(system.cluster) ?? []), [system.x, system.y]]);
  }
  return new Map([...byCluster].map(([id, points]) => [id, getClusterOutline(points, padding)]));
};

// Regla par-impar: un rayo hacia la derecha cruza el contorno un número impar de veces si el punto está dentro.
const isInside = (polygon: Point[], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export const findClusterAt = (outlines: Map<string, Point[]>, x: number, y: number): string | null => {
  for (const [id, outline] of outlines) {
    if (isInside(outline, x, y)) return id;
  }
  return null;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

// El juego lo llama markup: un recargo sobre la reparación, que crece con la dificultad de la zona.
export const describeRepair = ({ cost, time }: RepairMarkup): string => `Repair markup: ${percent(cost)} cost · ${percent(time)} time`;

export const describeMultiMission = ({ min, max, odds }: MultiMission): string =>
  `Multi-mission contracts: ${min === max ? min : `${min} to ${max}`} missions (${percent(odds)})`;

export const getArena = (data: StarmapData, systemId: number): ArenaSystem | null =>
  data.arenas.systems.find(arena => arena.system === systemId) ?? null;
