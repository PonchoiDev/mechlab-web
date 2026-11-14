import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { decodeBuild } from './buildCode';
import { EXPORT_FORMAT, toEntry, type BuildEntry, type ImportResult, type SavedBuild } from './savedBuildsCore';

export {
  EXPORT_FORMAT,
  mergeBuilds,
  normalizeBuildName,
  parseStoredBuilds,
  type BuildEntry,
  type ImportResult,
  type SavedBuild
} from './savedBuildsCore';

const EXPORT_VERSION = 1;
const GAME = 'mercs';

export const createExportFile = (builds: SavedBuild[]): string => JSON.stringify({
  format: EXPORT_FORMAT,
  version: EXPORT_VERSION,
  game: GAME,
  exportedAt: new Date().toISOString(),
  builds: builds.map(({ name, code, savedAt }) => ({ name, code, savedAt }))
}, null, 2);

// Lee un archivo exportado. Devuelve null si no es un archivo de builds; las builds cuyo código ya
// no se puede reconstruir (por ejemplo, de un mech que ya no existe) se cuentan como no válidas.
export const parseImportFile = (text: string, mechs: Mech[], catalog: Item[]): ImportResult | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const file = parsed as { format?: unknown; game?: unknown; builds?: unknown };
  if (typeof parsed !== 'object' || parsed === null || file.format !== EXPORT_FORMAT || !Array.isArray(file.builds)) return null;
  if (file.game !== undefined && file.game !== GAME) return null;

  const entries: BuildEntry[] = [];
  let invalid = 0;
  for (const value of file.builds) {
    const entry = toEntry(value);
    if (entry && decodeBuild(entry.code, mechs, catalog)) entries.push(entry);
    else invalid += 1;
  }
  return { entries, invalid };
};
