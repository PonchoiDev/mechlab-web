import { fetchSarnaImage, getSarnaImageTarget, SARNA_IMAGE_PATH } from './sarnaImage';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

interface ExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

const CACHE_NAME = 'sarna-images';

// El Worker solo se ejecuta en las rutas de run_worker_first (wrangler.jsonc); el resto de la web
// la sirven directamente los assets estáticos.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== SARNA_IMAGE_PATH) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

    const target = getSarnaImageTarget(url);
    if (!target) return new Response('Invalid image URL', { status: 400 });

    // Cada imagen se pide a Sarna una sola vez; después sale de la caché de Cloudflare.
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetchSarnaImage(target);
    if (response.ok) ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  }
};
