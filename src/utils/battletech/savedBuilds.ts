import { EXPORT_FORMAT, toEntry, type BuildEntry, type ImportResult, type SavedBuild } from '../savedBuildsCore';
import { decodeBtBuild } from './buildCode';

// Las builds guardadas de BATTLETECH usan el mismo formato que las de MW5 (nombre y código de enlace),
// pero en su propia clave del navegador y con game: battletech en el archivo exportado, para que un
// archivo de un juego no se importe en el otro.
export const BT_SAVED_BUILDS_KEY = 'mw-builder:battletech:saved-builds';
const EXPORT_VERSION = 1;
const GAME = 'battletech';

export const createBtExportFile = (builds: SavedBuild[]): string => JSON.stringify({
  format: EXPORT_FORMAT,
  version: EXPORT_VERSION,
  game: GAME,
  exportedAt: new Date().toISOString(),
  builds: builds.map(({ name, code, savedAt }) => ({ name, code, savedAt }))
}, null, 2);

// Un archivo exportado: null si no es de builds de BATTLETECH; las que ya no se pueden reconstruir
// se cuentan como no válidas.
export const parseBtImportFile = (text: string): ImportResult | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const file = parsed as { format?: unknown; game?: unknown; builds?: unknown };
  if (file.format !== EXPORT_FORMAT || file.game !== GAME || !Array.isArray(file.builds)) return null;

  const entries: BuildEntry[] = [];
  let invalid = 0;
  for (const value of file.builds) {
    const entry = toEntry(value);
    if (entry && decodeBtBuild(entry.code)) entries.push(entry);
    else invalid += 1;
  }
  return { entries, invalid };
};
