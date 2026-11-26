import { useMemo, useState } from 'react';
import type { BuildListFilter, BuildMinimumsOf, BuildWeightClass } from '../utils/savedBuildsList';
import { useBuildSort } from './useBuildSort';

// Buscador, filtros y orden de una lista de builds guardadas. El orden se recuerda en el navegador con la
// clave de cada juego, compartido por la ventana My builds y el comparador; los filtros duran lo que dure
// el componente que los tiene.
export function useBuildListFilters(sortKey: string) {
  const [query, setQuery] = useState('');
  const [weightClasses, setWeightClasses] = useState<BuildWeightClass[]>([]);
  const [minHardpoints, setMinHardpoints] = useState<Partial<Record<string, number>>>({});
  const [minimumsOf, setMinimumsOf] = useState<BuildMinimumsOf>('hardpoints');
  const [techBase, setTechBase] = useState<'InnerSphere' | 'Clan' | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [parts, setParts] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useBuildSort(sortKey);

  const filter = useMemo<BuildListFilter>(
    () => ({ query, weightClasses, minHardpoints, minimumsOf, techBase, roles, features, parts }),
    [query, weightClasses, minHardpoints, minimumsOf, techBase, roles, features, parts]
  );
  const clear = () => {
    setQuery('');
    setWeightClasses([]);
    setMinHardpoints({});
    setTechBase(null);
    setRoles([]);
    setFeatures([]);
    setParts({});
  };

  return { filter, sort, setSort, setQuery, setWeightClasses, setMinHardpoints, setMinimumsOf, setTechBase, setRoles, setFeatures, setParts, clear };
}

export type BuildListFiltersState = ReturnType<typeof useBuildListFilters>;
