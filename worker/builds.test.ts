import { describe, expect, it } from 'vitest';
import { BUILDS_PATH, handleBuilds, parseBuildCode, parsePublishInput, PUBLISH_LIMIT, type BuildsOptions, type PublishedBuild } from './builds';
import { createMemoryBuildStore } from './memoryBuildStore';

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Un código con la forma de los dos juegos: versión, 'Mech, armadura y zonas.
const codeFor = (mechId: string, version = 1) =>
  toBase64Url(JSON.stringify([version, mechId, [10, 4, 20, 6], [['MediumLaser'], [], [], [], [], [], [], []]]));

const OPTIONS: BuildsOptions = { salt: 'salt', adminKey: 'admin-secret' };

const request = (method: string, path: string, { body, ip = '203.0.113.1', headers = {} }: { body?: unknown; ip?: string; headers?: Record<string, string> } = {}) =>
  new Request(`https://mw-builder.com${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

const call = (store: ReturnType<typeof createMemoryBuildStore> | null, req: Request) =>
  handleBuilds(req, new URL(req.url).pathname, store, OPTIONS);

const publish = async (store: ReturnType<typeof createMemoryBuildStore>, overrides: Record<string, unknown> = {}, ip?: string) => {
  const response = await call(store, request('POST', BUILDS_PATH, {
    ip,
    body: { game: 'mercs', code: codeFor('AS7-D'), name: 'Brawler', description: 'Short range', author: 'Merc', ...overrides }
  }));
  return { response, data: await response.json() as { build: PublishedBuild; editKey: string } };
};

const list = async (store: ReturnType<typeof createMemoryBuildStore>, game = 'mercs') => {
  const response = await call(store, request('GET', `${BUILDS_PATH}?game=${game}`));
  return (await response.json() as { builds: PublishedBuild[] }).builds;
};

describe('código de build', () => {
  it('acepta la forma de MW5 y de BATTLETECH y rechaza lo demás', () => {
    expect(parseBuildCode(codeFor('AS7-D'))).toEqual({ mechId: 'AS7-D' });
    expect(parseBuildCode(codeFor('mechdef_atlas_AS7-D'))).toEqual({ mechId: 'mechdef_atlas_AS7-D' });
    expect(parseBuildCode(codeFor('AS7-D', 2))).toBeNull();
    expect(parseBuildCode(toBase64Url(JSON.stringify({ mech: 'AS7-D' })))).toBeNull();
    expect(parseBuildCode(toBase64Url(JSON.stringify([1, 'AS7 D<script>', [], []])))).toBeNull();
    expect(parseBuildCode('not base64!')).toBeNull();
    expect(parseBuildCode('A'.repeat(4001))).toBeNull();
    expect(parseBuildCode(42)).toBeNull();
  });
});

describe('publicación', () => {
  it('normaliza y limita los textos, y exige nombre, juego válido y el campo trampa vacío', () => {
    const parsed = parsePublishInput({
      game: 'battletech',
      code: codeFor('mechdef_atlas_AS7-D'),
      name: '  Big   Brawler\u0000 ',
      description: `Line one\r\nLine two ${'x'.repeat(600)}`,
      author: 'A'.repeat(60)
    });
    expect(parsed).toMatchObject({ game: 'battletech', mechId: 'mechdef_atlas_AS7-D', name: 'Big Brawler', author: 'A'.repeat(40) });
    expect(parsed?.description.startsWith('Line one\nLine two')).toBe(true);
    expect(parsed?.description.length).toBe(500);
    expect(parsePublishInput({ game: 'mercs', code: codeFor('AS7-D'), name: '   ' })).toBeNull();
    expect(parsePublishInput({ game: 'clans', code: codeFor('AS7-D'), name: 'Build' })).toBeNull();
    expect(parsePublishInput({ game: 'mercs', code: codeFor('AS7-D'), name: 'Build', website: 'spam' })).toBeNull();
    expect(parsePublishInput({ game: 'mercs', code: 'bad', name: 'Build' })).toBeNull();
    expect(parsePublishInput(null)).toBeNull();
  });

  it('guarda la build, devuelve su clave de edición y la lista solo en su juego', async () => {
    const store = createMemoryBuildStore();
    const { response, data } = await publish(store);
    expect(response.status).toBe(201);
    expect(data.editKey).toMatch(/^[0-9a-f]{32,}$/);
    expect(data.build).toMatchObject({ game: 'mercs', mechId: 'AS7-D', name: 'Brawler', description: 'Short range', author: 'Merc', votes: 0 });
    expect(JSON.stringify(data.build)).not.toContain(data.editKey);
    expect((await list(store)).map(build => build.id)).toEqual([data.build.id]);
    expect(await list(store, 'battletech')).toEqual([]);
  });

  it('rechaza una publicación no válida y un juego desconocido en la lista', async () => {
    const store = createMemoryBuildStore();
    expect((await publish(store, { name: '' })).response.status).toBe(400);
    expect((await call(store, request('GET', `${BUILDS_PATH}?game=clans`))).status).toBe(400);
  });

  it('limita a cien publicaciones por hora y por IP', async () => {
    expect(PUBLISH_LIMIT).toBe(100);
    const store = createMemoryBuildStore();
    for (let i = 0; i < PUBLISH_LIMIT; i += 1) expect((await publish(store)).response.status).toBe(201);
    expect((await publish(store)).response.status).toBe(429);
    expect((await publish(store, {}, '198.51.100.7')).response.status).toBe(201);
  });
});

describe('edición y borrado', () => {
  it('solo con la clave de la build', async () => {
    const store = createMemoryBuildStore();
    const { data } = await publish(store);
    const path = `${BUILDS_PATH}/${data.build.id}`;

    expect((await call(store, request('PATCH', path, { body: { editKey: 'wrong', name: 'Hacked' } }))).status).toBe(403);
    const edited = await call(store, request('PATCH', path, { body: { editKey: data.editKey, name: 'Renamed', description: '', author: '' } }));
    expect(edited.status).toBe(200);
    expect((await edited.json() as { build: PublishedBuild }).build).toMatchObject({ name: 'Renamed', description: '', author: '' });

    expect((await call(store, request('DELETE', path, { body: { editKey: 'wrong' } }))).status).toBe(403);
    expect((await call(store, request('DELETE', path, { body: { editKey: data.editKey } }))).status).toBe(200);
    expect(await list(store)).toEqual([]);
    expect((await call(store, request('DELETE', path, { body: { editKey: data.editKey } }))).status).toBe(404);
  });

  it('el administrador borra cualquier build con su clave', async () => {
    const store = createMemoryBuildStore();
    const { data } = await publish(store);
    const path = `${BUILDS_PATH}/${data.build.id}`;
    expect((await call(store, request('DELETE', path, { headers: { Authorization: 'Bearer nope' } }))).status).toBe(403);
    expect((await call(store, request('DELETE', path, { headers: { Authorization: 'Bearer admin-secret' } }))).status).toBe(200);
    expect(await list(store)).toEqual([]);
  });
});

describe('votos y denuncias', () => {
  it('un voto por IP, que se puede retirar', async () => {
    const store = createMemoryBuildStore();
    const { data } = await publish(store);
    const path = `${BUILDS_PATH}/${data.build.id}/vote`;

    const first = await call(store, request('POST', path));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ votes: 1 });
    expect((await call(store, request('POST', path))).status).toBe(409);
    expect((await list(store))[0].votes).toBe(1);

    expect(await (await call(store, request('POST', path, { ip: '198.51.100.7' }))).json()).toEqual({ votes: 2 });
    expect(await (await call(store, request('DELETE', path))).json()).toEqual({ votes: 1 });
    expect((await call(store, request('POST', `${BUILDS_PATH}/missing/vote`))).status).toBe(404);
  });

  it('con tres denuncias de IP distintas la build se oculta', async () => {
    const store = createMemoryBuildStore();
    const { data } = await publish(store);
    const path = `${BUILDS_PATH}/${data.build.id}/report`;

    expect((await call(store, request('POST', path, { ip: '192.0.2.1' }))).status).toBe(200);
    expect((await call(store, request('POST', path, { ip: '192.0.2.1' }))).status).toBe(409);
    expect((await call(store, request('POST', path, { ip: '192.0.2.2' }))).status).toBe(200);
    expect(await list(store)).toHaveLength(1);
    expect((await call(store, request('POST', path, { ip: '192.0.2.3' }))).status).toBe(200);
    expect(await list(store)).toEqual([]);
  });
});

describe('sin base de datos', () => {
  it('responde 503', async () => {
    expect((await call(null, request('GET', `${BUILDS_PATH}?game=mercs`))).status).toBe(503);
    expect((await call(null, request('POST', BUILDS_PATH, { body: {} }))).status).toBe(503);
  });
});
