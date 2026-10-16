import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSarnaAsset, getCachedSarnaAsset, getSarnaTitle } from './sarna';
import { getMech } from '../test/fixtures';
import type { Mech } from '../types/mech';

const makeMech = (overrides: Partial<Mech>): Mech => ({ ...getMech('AS7-D'), ...overrides });

const respondWith = (...pages: object[]) => {
  const fetchMock = vi.fn();
  for (const page of pages) {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ query: { pages: { 1: page } } }) });
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSarnaTitle', () => {
  it('usa el nombre de Sarna del mech', () => {
    expect(getSarnaTitle(makeMech({ name: 'PUMA', sarnaName: 'Adder' }))).toBe('Adder');
  });

  it('aplica los alias de títulos conocidos', () => {
    expect(getSarnaTitle(makeMech({ name: 'Loaderking', sarnaName: 'Loaderking' }))).toBe('Loader King');
  });

  it('usa el nombre del chasis si no hay nombre de Sarna', () => {
    expect(getSarnaTitle(makeMech({ name: 'Atlas', sarnaName: undefined }))).toBe('Atlas');
  });
});

describe('fetchSarnaAsset', () => {
  it('devuelve la miniatura de la página y su URL', async () => {
    const mech = makeMech({ id: 'TEST-THUMB', sarnaName: 'Atlas' });
    respondWith({ title: 'Atlas', thumbnail: { source: 'https://img/atlas.png' } });

    const asset = await fetchSarnaAsset(mech, new AbortController().signal);

    expect(asset).toEqual({ imageUrl: 'https://img/atlas.png', pageUrl: 'https://www.sarna.net/wiki/Atlas' });
  });

  it('sigue el enlace a la página del BattleMech si no hay miniatura', async () => {
    const mech = makeMech({ id: 'TEST-LINK', sarnaName: 'Shadow Hawk' });
    respondWith(
      { title: 'Shadow Hawk', links: [{ title: 'Shadow Hawk (BattleMech)' }] },
      { title: 'Shadow Hawk (BattleMech)', thumbnail: { source: 'https://img/shd.png' } }
    );

    const asset = await fetchSarnaAsset(mech, new AbortController().signal);

    expect(asset).toEqual({
      imageUrl: 'https://img/shd.png',
      pageUrl: 'https://www.sarna.net/wiki/Shadow_Hawk_(BattleMech)'
    });
  });

  it('guarda el resultado en caché para no volver a consultarlo', async () => {
    const mech = makeMech({ id: 'TEST-CACHE', sarnaName: 'Atlas' });
    respondWith({ title: 'Atlas', thumbnail: { source: 'https://img/atlas.png' } });

    expect(getCachedSarnaAsset(mech)).toBeUndefined();
    const asset = await fetchSarnaAsset(mech, new AbortController().signal);

    expect(getCachedSarnaAsset(mech)).toEqual(asset);
  });

  it('devuelve solo el enlace si Sarna falla, sin guardarlo en caché', async () => {
    const mech = makeMech({ id: 'TEST-ERROR', sarnaName: 'Loader King' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const asset = await fetchSarnaAsset(mech, new AbortController().signal);

    expect(asset).toEqual({ imageUrl: null, pageUrl: 'https://www.sarna.net/wiki/Loader_King' });
    expect(getCachedSarnaAsset(mech)).toBeUndefined();
  });

  it('propaga la cancelación', async () => {
    const mech = makeMech({ id: 'TEST-ABORT', sarnaName: 'Atlas' });
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    }));

    await expect(fetchSarnaAsset(mech, controller.signal)).rejects.toThrow('Aborted');
    expect(getCachedSarnaAsset(mech)).toBeUndefined();
  });
});
