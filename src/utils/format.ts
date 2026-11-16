// Lo que se enseña en una celda sin dato. Es un guion corto: la interfaz no usa guiones largos.
export const EMPTY_VALUE = '-';

// Nombres repetidos agrupados, en el orden en que aparecen: «M Laser ×4, LRM15 ×2».
export const joinWithCounts = (names: string[]): string => {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(', ');
};

