// Proxy de las imágenes de Sarna. Su servidor de imágenes no envía cabeceras CORS, así que el
// navegador no deja dibujarlas en un canvas; servidas desde nuestro dominio, sí.
export const SARNA_IMAGE_PATH = '/mercs/api/sarna-image';

const SARNA_HOSTS = new Set(['cfw.sarna.net', 'www.sarna.net', 'sarna.net']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Solo se aceptan imágenes de la wiki de Sarna, para que nadie use el proxy con otras webs.
export const getSarnaImageTarget = (requestUrl: URL): URL | null => {
  const raw = requestUrl.searchParams.get('url');
  if (!raw) return null;

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return null;
  }
  const isSarnaImage = target.protocol === 'https:' &&
    SARNA_HOSTS.has(target.hostname) &&
    target.pathname.startsWith('/wiki/images/');
  return isSarnaImage ? target : null;
};

export const fetchSarnaImage = async (target: URL): Promise<Response> => {
  const upstream = await fetch(target, { headers: { 'User-Agent': 'MW Builder (https://mw-builder.com)' } });
  const contentType = upstream.headers.get('Content-Type') ?? '';
  const size = Number(upstream.headers.get('Content-Length') ?? 0);
  if (!upstream.ok || !contentType.startsWith('image/') || size > MAX_IMAGE_BYTES) {
    return new Response('Image not available', { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};
