import { REPORT_REASONS, type BuildGame, type PublishedBuild, type ReportReason } from '../../worker/builds';
import type { SavedBuild } from './savedBuildsCore';

// Builds publicadas, del lado del navegador: las llamadas a la API del Worker (worker/builds.ts) y lo que se
// guarda en el navegador. Sin cuentas: la clave de edición de cada build publicada se queda aquí, y también
// las builds votadas, para enseñar el voto pulsado.
export { REPORT_REASONS };
export type { BuildGame, PublishedBuild, ReportReason };
export const REPORT_MESSAGE_MAX = 500;

const ownedKey = (game: BuildGame) => `mw-builder:${game}:published-builds`;
const votedKey = (game: BuildGame) => `mw-builder:${game}:voted-builds`;
const reportedKey = (game: BuildGame) => `mw-builder:${game}:reported-builds`;
const AUTHOR_KEY = 'mw-builder:build-author';

export const BUILD_NAME_MAX = 80;
export const BUILD_DESCRIPTION_MAX = 500;
export const BUILD_AUTHOR_MAX = 40;

// Lo guardado puede venir dañado o de otra versión: se ignora lo que no encaje.
export const parseOwnedKeys = (raw: string | null): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(raw ?? '');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
};

// Una lista de ids guardada: las builds votadas o las denunciadas.
const parseIdList = (raw: string | null): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw ?? '');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: la build se publica igual, pero no se podrá editar desde este navegador.
  }
};

export const readOwnedKeys = (game: BuildGame) => parseOwnedKeys(read(ownedKey(game)));

export const saveOwnedKey = (game: BuildGame, id: string, editKey: string) =>
  write(ownedKey(game), JSON.stringify({ ...readOwnedKeys(game), [id]: editKey }));

export const forgetOwnedKey = (game: BuildGame, id: string) => {
  const { [id]: _removed, ...rest } = readOwnedKeys(game);
  write(ownedKey(game), JSON.stringify(rest));
};

export const parseVotedIds = parseIdList;

// Las denunciadas siguen ocultas para quien las denunció al recargar la página.
export const parseReportedIds = parseIdList;

export const readVotedIds = (game: BuildGame) => parseVotedIds(read(votedKey(game)));

export const saveVotedIds = (game: BuildGame, ids: string[]) => write(votedKey(game), JSON.stringify(ids));

export const readReportedIds = (game: BuildGame) => parseReportedIds(read(reportedKey(game)));

export const saveReportedIds = (game: BuildGame, ids: string[]) => write(reportedKey(game), JSON.stringify(ids));

export const readAuthor = () => read(AUTHOR_KEY) ?? '';

export const saveAuthor = (author: string) => write(AUTHOR_KEY, author.trim());

// Más votadas primero; con los mismos votos, la más reciente. No cambia la lista recibida.
export const sortByVotes = <T extends Pick<PublishedBuild, 'votes' | 'createdAt'>>(builds: T[]): T[] =>
  [...builds].sort((a, b) => b.votes - a.votes || b.createdAt.localeCompare(a.createdAt));

// Los códigos de las builds publicadas desde este navegador (las que tienen clave de edición aquí): sirven para
// marcar como ya publicadas las builds guardadas con el mismo código.
export const getOwnPublishedCodes = (builds: PublishedBuild[], ownedKeys: Record<string, string>): Set<string> =>
  new Set(builds.filter(build => Object.hasOwn(ownedKeys, build.id)).map(build => build.code));

// Una build publicada se resume como una guardada, para usar las filas y los filtros de My builds.
export const toSavedBuild = (build: PublishedBuild): SavedBuild => ({
  id: build.id,
  name: build.name,
  code: build.code,
  savedAt: build.createdAt
});

export const getBuildsPageUrl = (game: BuildGame, params: Record<string, string> = {}) => {
  const query = new URLSearchParams(params).toString();
  return `/${game}/builds/${query ? `?${query}` : ''}`;
};

const apiUrl = (game: BuildGame, path = '') => `/${game}/api/builds${path}`;

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const MESSAGES: Record<number, string> = {
  400: 'The build is not valid. Check the name.',
  403: 'This browser does not have the key to change this build.',
  404: 'That build is no longer published.',
  409: 'Already done from this connection.',
  429: 'Too many builds published from this connection. Try again in an hour.',
  503: 'Published builds are not available right now.'
};

const call = async <T>(url: string, init?: RequestInit): Promise<ApiResult<T>> => {
  try {
    const response = await fetch(url, init && { ...init, headers: { 'Content-Type': 'application/json' } });
    if (response.ok) return { ok: true, data: await response.json() as T };
    return { ok: false, status: response.status, message: MESSAGES[response.status] ?? 'Something went wrong. Try again in a moment.' };
  } catch {
    return { ok: false, status: 0, message: 'Could not reach the server. Check your connection.' };
  }
};

export interface BuildTextsInput {
  name: string;
  description: string;
  author: string;
}

export const fetchPublishedBuilds = (game: BuildGame) =>
  call<{ builds: PublishedBuild[] }>(`${apiUrl(game)}?game=${game}`);

export const publishBuild = (game: BuildGame, code: string, texts: BuildTextsInput) =>
  call<{ build: PublishedBuild; editKey: string }>(apiUrl(game), { method: 'POST', body: JSON.stringify({ game, code, ...texts }) });

export const updatePublishedBuild = (game: BuildGame, id: string, editKey: string, texts: BuildTextsInput) =>
  call<{ build: PublishedBuild }>(apiUrl(game, `/${id}`), { method: 'PATCH', body: JSON.stringify({ editKey, ...texts }) });

export const deletePublishedBuild = (game: BuildGame, id: string, editKey: string) =>
  call<{ ok: true }>(apiUrl(game, `/${id}`), { method: 'DELETE', body: JSON.stringify({ editKey }) });

export const voteBuild = (game: BuildGame, id: string, vote: boolean) =>
  call<{ votes: number }>(apiUrl(game, `/${id}/vote`), { method: vote ? 'POST' : 'DELETE' });

export const reportBuild = (game: BuildGame, id: string, reason: ReportReason, message: string) =>
  call<{ ok: true }>(apiUrl(game, `/${id}/report`), { method: 'POST', body: JSON.stringify({ reason, message }) });
