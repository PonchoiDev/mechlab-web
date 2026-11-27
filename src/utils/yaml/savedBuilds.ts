import { EXPORT_FORMAT, toEntry, type BuildEntry, type ImportResult, type SavedBuild } from '../savedBuildsCore';
import { decodeYamlBuild } from './buildCode';
import { findYamlMech } from './data';

// Las builds guardadas del MechLab de YAML (docs/specs/builds-guardadas-yaml.md) usan el formato común (nombre y
// código de enlace) en su propia clave del navegador (YAML_SAVED_BUILDS_KEY) y con game: mw5-yaml en el archivo
// exportado: no son builds de MW5 (otras piezas, otras reglas y otro código), así que un archivo de un MechLab no
// se importa en otro.
const EXPORT_VERSION = 1;
const GAME = 'mw5-yaml';

export const createYamlExportFile = (builds: SavedBuild[]): string => JSON.stringify({
  format: EXPORT_FORMAT,
  version: EXPORT_VERSION,
  game: GAME,
  exportedAt: new Date().toISOString(),
  builds: builds.map(({ name, code, savedAt }) => ({ name, code, savedAt }))
}, null, 2);

// Un archivo exportado: null si no es de builds de YAML; las que ya no se pueden abrir cuentan como no válidas.
export const parseYamlImportFile = (text: string): ImportResult | null => {
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
    const decoded = entry && decodeYamlBuild(entry.code);
    if (entry && decoded && findYamlMech(decoded.mechId)) entries.push(entry);
    else invalid += 1;
  }
  return { entries, invalid };
};
