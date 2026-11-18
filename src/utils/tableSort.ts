// Orden por columnas de las tablas de las listas de chasis (MW5 y BATTLETECH), como el de la página de armas:
// pulsar una cabecera ordena por ella y volver a pulsarla invierte el orden.

export type SortDirection = 'asc' | 'desc';

export interface ColumnSort<K extends string> {
  key: K;
  dir: SortDirection;
}

// El nombre empieza de la A a la Z y las cifras, de mayor a menor.
export const defaultSortDirection = (key: string): SortDirection => key === 'name' ? 'asc' : 'desc';

export const toggleColumnSort = <K extends string>(current: ColumnSort<K>, key: K): ColumnSort<K> =>
  current.key === key
    ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: defaultSortDirection(key) };

// Las filas sin el dato van al final en los dos sentidos; a igualdad, por nombre.
export const sortByColumn = <T, K extends string>(
  rows: T[],
  { key, dir }: ColumnSort<K>,
  value: (row: T, key: Exclude<K, 'name'>) => number | null,
  byName: (a: T, b: T) => number
): T[] => {
  const sign = dir === 'asc' ? 1 : -1;
  if (key === 'name') return [...rows].sort((a, b) => byName(a, b) * sign);
  const column = key as Exclude<K, 'name'>;
  return [...rows].sort((a, b) => {
    const [first, second] = [value(a, column), value(b, column)];
    if (first === null || second === null) return first === second ? byName(a, b) : first === null ? 1 : -1;
    return (first - second) * sign || byName(a, b);
  });
};
