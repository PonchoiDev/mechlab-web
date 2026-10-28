import { useEffect } from 'react';
import { parseStoredContentSources } from '../utils/mechs';

// Los DLC marcados en el selector son los que tiene el jugador: se recuerdan en este navegador.
const STORAGE_KEY = 'mw-builder:mercs:owned-dlc';

export const readOwnedDlcs = (): number[] => {
  try {
    return parseStoredContentSources(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
};

// Guarda la selección cada vez que cambia. Sin almacenamiento (modo privado, cookies bloqueadas) el
// filtro funciona igual, solo no se recuerda.
export const useRememberOwnedDlcs = (dlcs: number[]) => {
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dlcs));
    } catch {
      // Sin almacenamiento disponible.
    }
  }, [dlcs]);
};
