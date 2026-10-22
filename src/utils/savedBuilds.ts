import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { decodeBuild } from './buildCode';

// Cada build guardada es su código de enlace con un nombre: así se reconstruye con las mismas
// reglas que un enlace compartido, y sigue funcionando cuando cambian los datos del juego.
export interface SavedBuild {
  id: string;
  name: string;
  code: string;
  savedAt: string;
}

export type BuildEntry = Omit<SavedBuild, 'id'>;

export const EXPORT_FORMAT = 'mw-builder-builds';
const EXPORT_VERSION = 1;
const GAME = 'mercs';
const MAX_NAME_LENGTH = 80;

export const normalizeBuildName = (name: string, fallback: string): string =>
  name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH) || fallback;

const toEntry = (value: unknown): BuildEntry | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { name, code, savedAt } = value as Record<string, unknown>;
  if (typeof code !== 'string' || code === '') return null;
  const date = typeof savedAt === 'string' && !Number.isNaN(Date.parse(savedAt)) ? savedAt : new Date().toISOString();
  return { name: normalizeBuildName(typeof name === 'string' ? name : '', 'Imported build'), code, savedAt: date };
};

// Lo guardado en el navegador puede venir de otra versión o estar dañado: se ignora lo que no encaje.
export const parseStoredBuilds = (raw: string | null): SavedBuild[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(value => {
      const entry = toEntry(value);
      const id = (value as { id?: unknown }).id;
      return entry && typeof id === 'string' ? [{ id, ...entry }] : [];
    });
  } catch {
    return [];
  }
};

export const createExportFile = (builds: SavedBuild[]): string => JSON.stringify({
  format: EXPORT_FORMAT,
  version: EXPORT_VERSION,
  game: GAME,
  exportedAt: new Date().toISOString(),
  builds: builds.map(({ name, code, savedAt }) => ({ name, code, savedAt }))
}, null, 2);

export interface ImportResult {
  entries: BuildEntry[];
  invalid: number;
}

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

// Añade las builds importadas al principio, saltándose las que ya están guardadas con el mismo nombre y código.
export const mergeBuilds = (
  existing: SavedBuild[],
  entries: BuildEntry[],
  createId: () => string
): { builds: SavedBuild[]; added: number; skipped: number } => {
  const known = new Set(existing.map(build => `${build.name}\n${build.code}`));
  const added: SavedBuild[] = [];
  for (const entry of entries) {
    const key = `${entry.name}\n${entry.code}`;
    if (known.has(key)) continue;
    known.add(key);
    added.push({ id: createId(), ...entry });
  }
  return { builds: [...added, ...existing], added: added.length, skipped: entries.length - added.length };
};
