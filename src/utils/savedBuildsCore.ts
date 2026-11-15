// Lo común de las builds guardadas de los dos juegos, sin sus datos: MW5 (savedBuilds.ts) y BATTLETECH
// (battletech/savedBuilds.ts) lo comparten sin cargar el catálogo del otro.

// Cada build guardada es su código de enlace con un nombre: así se reconstruye con las mismas
// reglas que un enlace compartido, y sigue funcionando cuando cambian los datos del juego.
export interface SavedBuild {
  id: string;
  name: string;
  code: string;
  savedAt: string;
}

export type BuildEntry = Omit<SavedBuild, 'id'>;

export interface ImportResult {
  entries: BuildEntry[];
  invalid: number;
}

export const EXPORT_FORMAT = 'mw-builder-builds';
const MAX_NAME_LENGTH = 80;

export const normalizeBuildName = (name: string, fallback: string): string =>
  name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH) || fallback;

export const toEntry = (value: unknown): BuildEntry | null => {
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
      // El id se lee después de validar la entrada: un null en la lista no puede tirar las demás.
      const entry = toEntry(value);
      if (!entry) return [];
      const id = (value as { id?: unknown }).id;
      return typeof id === 'string' ? [{ id, ...entry }] : [];
    });
  } catch {
    return [];
  }
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
