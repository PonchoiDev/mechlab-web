// Builds publicadas: los jugadores publican una build desde el MechLab y las demás se ven en la página de
// builds de cada juego. Se guarda el código de la build, el mismo de los enlaces, y no la build decodificada:
// el navegador la reconstruye con los datos del juego del momento. Sin cuentas: quien publica recibe una
// clave de edición, y aquí solo se guarda su hash.
import { FROM_ADDRESS } from './feedback.ts';

export const BUILDS_PATH = '/mercs/api/builds';
const SITE_URL = 'https://mw-builder.com';

export const BUILD_GAMES = ['mercs', 'battletech'] as const;
export type BuildGame = typeof BUILD_GAMES[number];

const MAX_CODE_LENGTH = 4000;
const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_AUTHOR_LENGTH = 40;
const MAX_MECH_ID_LENGTH = 100;
// Los dos juegos codifican la build como [versión, mechId, armadura, zonas] (src/utils/buildCode.ts y
// src/utils/battletech/buildCode.ts); MW5 añade al final las mejoras de la cantina.
const BUILD_CODE_VERSION = 1;
const MECH_ID_PATTERN = /^[A-Za-z0-9_.-]+$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

// Alto a propósito: frena un script que publique sin parar, no a un jugador que publica varias builds.
export const PUBLISH_LIMIT = 100;
const PUBLISH_WINDOW_MS = 60 * 60 * 1000;
export const REPORTS_TO_HIDE = 3;
// La página filtra y ordena en el navegador, como My builds: carga las más recientes hasta este tope.
export const MAX_LISTED = 1000;

export interface PublishedBuild {
  id: string;
  game: BuildGame;
  mechId: string;
  code: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  votes: number;
}

export interface StoredBuild extends PublishedBuild {
  editKeyHash: string;
  ipHash: string;
}

export interface BuildTexts {
  name: string;
  description: string;
  author: string;
}

// El almacén: D1 en producción (buildStore.ts) y uno en memoria en los tests y en desarrollo
// (memoryBuildStore.ts). Las builds ocultas por denuncias no salen en list ni en get.
export interface BuildStore {
  list: (game: BuildGame, limit: number) => Promise<PublishedBuild[]>;
  get: (id: string) => Promise<StoredBuild | null>;
  countPublishedSince: (ipHash: string, since: string) => Promise<number>;
  insert: (build: StoredBuild) => Promise<void>;
  update: (id: string, texts: BuildTexts, updatedAt: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  // Devuelven los votos de la build tras el cambio, o null si esa IP ya había votado (o no había votado).
  addVote: (id: string, ipHash: string) => Promise<number | null>;
  removeVote: (id: string, ipHash: string) => Promise<number | null>;
  // Devuelve las denuncias de la build tras la nueva, o null si esa IP ya la había denunciado.
  addReport: (id: string, ipHash: string) => Promise<number | null>;
  hide: (id: string) => Promise<void>;
}

// Una denuncia, para avisar al dueño de la web: la build, las denuncias que lleva y si ya se ha ocultado.
export interface BuildReport {
  build: PublishedBuild;
  reports: number;
  hidden: boolean;
  reason: ReportReason;
  message: string;
}

export const REPORT_REASONS = ['Spam', 'Offensive', 'Broken or misleading', 'Other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];
const MAX_REPORT_MESSAGE_LENGTH = 500;

export interface BuildsOptions {
  // Secreto con el que se hashean las IP: así no se guardan tal cual.
  salt: string;
  // Clave de administración para borrar cualquier build.
  adminKey?: string;
  now?: () => Date;
  // Aviso de cada denuncia (por correo en producción). Si falla, la denuncia cuenta igual.
  onReport?: (report: BuildReport) => Promise<void>;
}

const fromBase64Url = (code: string) => {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
};

// El código tiene que tener la forma de los dos juegos. La build no se decodifica entera: necesitaría los
// datos de los juegos, que no caben en el Worker; la página descarta las que no se pueden abrir.
export const parseBuildCode = (code: unknown): { mechId: string } | null => {
  if (typeof code !== 'string' || code.length === 0 || code.length > MAX_CODE_LENGTH || !BASE64URL_PATTERN.test(code)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed[0] !== BUILD_CODE_VERSION) return null;
  const [, mechId, armor, zones] = parsed;
  if (typeof mechId !== 'string' || mechId.length > MAX_MECH_ID_LENGTH || !MECH_ID_PATTERN.test(mechId)) return null;
  if (!Array.isArray(armor) || !Array.isArray(zones)) return null;
  return { mechId };
};

// Sin caracteres de control (salvo los saltos de línea de la descripción) y con los espacios normalizados.
const cleanLine = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';

const cleanText = (value: unknown, max: number) =>
  typeof value !== 'string' ? '' : value
    .replace(/\r\n?/g, '\n')
    .replace(/[^\P{Cc}\n]|\p{Cf}/gu, '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);

const parseTexts = (body: Record<string, unknown>): BuildTexts | null => {
  const name = cleanLine(body.name, MAX_NAME_LENGTH);
  if (!name) return null;
  return { name, description: cleanText(body.description, MAX_DESCRIPTION_LENGTH), author: cleanLine(body.author, MAX_AUTHOR_LENGTH) };
};

const isGame = (value: unknown): value is BuildGame => (BUILD_GAMES as readonly unknown[]).includes(value);

const asRecord = (body: unknown): Record<string, unknown> | null =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : null;

// El motivo de una denuncia y su mensaje opcional. La denuncia no se rechaza por ellos: un motivo desconocido
// pasa a Other.
export const parseReportInput = (body: unknown): { reason: ReportReason; message: string } => {
  const record = asRecord(body) ?? {};
  const reason = (REPORT_REASONS as readonly unknown[]).includes(record.reason) ? record.reason as ReportReason : 'Other';
  return { reason, message: cleanText(record.message, MAX_REPORT_MESSAGE_LENGTH) };
};

// Valida una publicación. null si no vale o si se rellenó el campo trampa (website), que solo ven los bots.
export const parsePublishInput = (body: unknown): (BuildTexts & { game: BuildGame; code: string; mechId: string }) | null => {
  const record = asRecord(body);
  if (!record) return null;
  if (typeof record.website === 'string' && record.website !== '') return null;
  if (!isGame(record.game)) return null;
  const code = parseBuildCode(record.code);
  const texts = parseTexts(record);
  if (!code || !texts) return null;
  return { game: record.game, code: record.code as string, mechId: code.mechId, ...texts };
};

const toHex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');

const sha256 = async (text: string) => toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

const randomHex = (bytes: number) => toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);

// Compara sin cortar en la primera diferencia, para no dar pistas por el tiempo de respuesta.
const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const toPublic = ({ editKeyHash: _key, ipHash: _ip, ...build }: StoredBuild): PublishedBuild => build;

const readBody = async (request: Request) => asRecord(await request.json().catch(() => null)) ?? {};

// Las rutas de /api/builds. `path` es la ruta ya normalizada a /mercs/api/ (toApiPath en index.ts).
export const handleBuilds = async (request: Request, path: string, store: BuildStore | null, options: BuildsOptions): Promise<Response> => {
  if (!store) return json({ error: 'Published builds are not configured', missing: 'BUILDS_DB binding' }, 503);
  const now = (options.now ?? (() => new Date()))();
  const ipHash = await sha256(`${options.salt}:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`);
  const [id, action, ...rest] = path.slice(BUILDS_PATH.length).split('/').filter(Boolean);
  if (rest.length > 0 || (action && action !== 'vote' && action !== 'report')) return json({ error: 'Not found' }, 404);

  if (!id) {
    if (request.method === 'GET') {
      const game = new URL(request.url).searchParams.get('game');
      if (!isGame(game)) return json({ error: 'Unknown game' }, 400);
      return json({ builds: await store.list(game, MAX_LISTED) });
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const input = parsePublishInput(await request.json().catch(() => null));
    if (!input) return json({ error: 'Invalid build' }, 400);
    const since = new Date(now.getTime() - PUBLISH_WINDOW_MS).toISOString();
    if (await store.countPublishedSince(ipHash, since) >= PUBLISH_LIMIT) {
      return json({ error: 'Too many builds published. Try again later.' }, 429);
    }
    const editKey = randomHex(24);
    const stored: StoredBuild = {
      id: randomHex(8),
      game: input.game,
      mechId: input.mechId,
      code: input.code,
      name: input.name,
      description: input.description,
      author: input.author,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      votes: 0,
      editKeyHash: await sha256(editKey),
      ipHash
    };
    await store.insert(stored);
    return json({ build: toPublic(stored), editKey }, 201);
  }

  const stored = await store.get(id);
  if (!stored) return json({ error: 'Build not found' }, 404);

  if (action === 'vote') {
    if (request.method !== 'POST' && request.method !== 'DELETE') return json({ error: 'Method not allowed' }, 405);
    const votes = request.method === 'POST' ? await store.addVote(id, ipHash) : await store.removeVote(id, ipHash);
    if (votes === null) {
      return request.method === 'POST' ? json({ error: 'Already voted' }, 409) : json({ votes: stored.votes });
    }
    return json({ votes });
  }

  if (action === 'report') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const input = parseReportInput(await request.json().catch(() => null));
    const reports = await store.addReport(id, ipHash);
    if (reports === null) return json({ error: 'Already reported' }, 409);
    const hidden = reports >= REPORTS_TO_HIDE;
    if (hidden) await store.hide(id);
    try {
      await options.onReport?.({ build: toPublic(stored), reports, hidden, ...input });
    } catch {
      // El aviso es un extra: la denuncia ya está guardada.
    }
    return json({ ok: true });
  }

  if (request.method === 'PATCH') {
    const body = await readBody(request);
    if (typeof body.editKey !== 'string' || !sameText(await sha256(body.editKey), stored.editKeyHash)) {
      return json({ error: 'Wrong edit key' }, 403);
    }
    const texts = parseTexts(body);
    if (!texts) return json({ error: 'Invalid build' }, 400);
    await store.update(id, texts, now.toISOString());
    return json({ build: { ...toPublic(stored), ...texts, updatedAt: now.toISOString() } });
  }

  if (request.method === 'DELETE') {
    const authorization = request.headers.get('Authorization') ?? '';
    const isAdmin = Boolean(options.adminKey) && sameText(authorization, `Bearer ${options.adminKey}`);
    const body = isAdmin ? {} : await readBody(request);
    const isOwner = typeof body.editKey === 'string' && sameText(await sha256(body.editKey), stored.editKeyHash);
    if (!isAdmin && !isOwner) return json({ error: 'Wrong edit key' }, 403);
    await store.remove(id);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
};

// El correo con el que se avisa de una denuncia: qué build es, cuántas denuncias lleva, dónde verla y cómo
// borrarla con la clave de administración. Los textos ya vienen limpios de saltos de línea (cleanLine).
export const buildReportEmail = ({ build, reports, hidden, reason, message }: BuildReport, to: string, date = new Date()): string => {
  const body = [
    `Build: ${build.name}`,
    `Game: ${build.game}`,
    `Author: ${build.author || '(none)'}`,
    `Reports: ${reports} of ${REPORTS_TO_HIDE}${hidden ? ', now hidden' : ''}`,
    `Reason: ${reason}`,
    message ? `Message:\n${message}` : 'No message.',
    '',
    `See it: ${SITE_URL}/${build.game}/builds/?build=${build.id}`,
    '',
    'Delete it:',
    `curl -X DELETE -H "Authorization: Bearer <BUILDS_ADMIN_KEY>" ${SITE_URL}/${build.game}/api/builds/${build.id}`,
    '',
    build.description ? `Description:\n${build.description}` : 'No description.'
  ].join('\n');

  return [
    `From: MW Builder <${FROM_ADDRESS}>`,
    `To: <${to}>`,
    `Subject: [MW Builder] Build reported: ${build.name}`,
    `Date: ${date.toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@mw-builder.com>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body.replace(/\r?\n/g, '\r\n')
  ].join('\r\n');
};
