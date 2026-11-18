import { useState } from 'react';
import { parseBuildSort, type BuildSort } from '../utils/savedBuildsList';

// El orden de la lista de builds guardadas se recuerda en el navegador, uno por juego. Si el navegador no
// deja guardar, se usa el de por defecto y la lista funciona igual.
export const MERCS_BUILD_SORT_KEY = 'mw-builder:mercs:builds-sort';
export const BT_BUILD_SORT_KEY = 'mw-builder:battletech:builds-sort';

export function useBuildSort(storageKey: string) {
  const [sort, setSort] = useState<BuildSort>(() => {
    try {
      return parseBuildSort(window.localStorage.getItem(storageKey));
    } catch {
      return parseBuildSort(null);
    }
  });

  const changeSort = (next: BuildSort) => {
    setSort(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // Sin almacenamiento, el orden dura lo que la ventana abierta.
    }
  };

  return [sort, changeSort] as const;
}
