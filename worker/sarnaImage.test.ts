import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSarnaImage, getSarnaImageTarget, SARNA_IMAGE_PATH } from './sarnaImage';

const proxyUrl = (target: string) => new URL(`https://mw-builder.com${SARNA_IMAGE_PATH}?url=${encodeURIComponent(target)}`);

// El proxy solo debe servir imágenes de la wiki de Sarna: si aceptara otras direcciones, cualquiera
// podría usar el Worker para descargar contenido de otras webs desde nuestro dominio.
describe('getSarnaImageTarget', () => {
  it('acepta imágenes de la wiki de Sarna por HTTPS', () => {
    const target = getSarnaImageTarget(proxyUrl('https://cfw.sarna.net/wiki/images/a/ab/Atlas.png'));
    expect(target?.href).toBe('https://cfw.sarna.net/wiki/images/a/ab/Atlas.png');
    expect(getSarnaImageTarget(proxyUrl('https://www.sarna.net/wiki/images/x/y/Loki.jpg'))).not.toBeNull();
  });

  it('rechaza otros dominios, aunque se parezcan', () => {
    expect(getSarnaImageTarget(proxyUrl('https://example.com/wiki/images/a/ab/Atlas.png'))).toBeNull();
    expect(getSarnaImageTarget(proxyUrl('https://sarna.net.example.com/wiki/images/a.png'))).toBeNull();
    expect(getSarnaImageTarget(proxyUrl('https://evilsarna.net/wiki/images/a.png'))).toBeNull();
  });

  it('rechaza HTTP y rutas que no son imágenes de la wiki', () => {
    expect(getSarnaImageTarget(proxyUrl('http://cfw.sarna.net/wiki/images/a/ab/Atlas.png'))).toBeNull();
    expect(getSarnaImageTarget(proxyUrl('https://www.sarna.net/wiki/Atlas'))).toBeNull();
    expect(getSarnaImageTarget(proxyUrl('https://www.sarna.net/wiki/api.php?action=query'))).toBeNull();
  });

  it('rechaza peticiones sin url o con una url que no se puede leer', () => {
    expect(getSarnaImageTarget(new URL(`https://mw-builder.com${SARNA_IMAGE_PATH}`))).toBeNull();
    expect(getSarnaImageTarget(proxyUrl('no es una url'))).toBeNull();
    expect(getSarnaImageTarget(proxyUrl('javascript:alert(1)'))).toBeNull();
  });
});

describe('fetchSarnaImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respondWith = (body: string, headers: Record<string, string>, status = 200) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status, headers })));
  const target = new URL('https://cfw.sarna.net/wiki/images/a/ab/Atlas.png');

  it('devuelve la imagen con caché y nosniff', async () => {
    respondWith('png', { 'Content-Type': 'image/png', 'Content-Length': '3' });
    const response = await fetchSarnaImage(target);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Cache-Control')).toContain('max-age');
  });

  it('no reenvía lo que no es una imagen, como una página HTML', async () => {
    respondWith('<script>', { 'Content-Type': 'text/html' });
    expect((await fetchSarnaImage(target)).status).toBe(502);
  });

  it('no reenvía imágenes de más de 10 MB ni errores de Sarna', async () => {
    respondWith('big', { 'Content-Type': 'image/png', 'Content-Length': String(11 * 1024 * 1024) });
    expect((await fetchSarnaImage(target)).status).toBe(502);
    respondWith('missing', { 'Content-Type': 'image/png' }, 404);
    expect((await fetchSarnaImage(target)).status).toBe(502);
  });
});
