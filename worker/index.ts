import { EmailMessage } from 'cloudflare:email';
import { buildFeedbackEmail, FEEDBACK_PATH, FROM_ADDRESS, parseFeedback } from './feedback';
import { fetchSarnaImage, getSarnaImageTarget, SARNA_IMAGE_PATH } from './sarnaImage';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  // Configurados en Cloudflare: el envío de correo (Email Routing) y la dirección de destino (secreto).
  FEEDBACK_EMAIL?: { send: (message: EmailMessage) => Promise<void> };
  FEEDBACK_TO?: string;
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
    if (url.pathname === FEEDBACK_PATH) return handleFeedback(request, env);
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const handleFeedback = async (request: Request, env: Env): Promise<Response> => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.FEEDBACK_EMAIL || !env.FEEDBACK_TO) return json({ error: 'Feedback is not configured' }, 503);

  const feedback = parseFeedback(await request.json().catch(() => null));
  if (!feedback) return json({ error: 'Invalid message' }, 400);

  const raw = buildFeedbackEmail(feedback, env.FEEDBACK_TO, request.headers.get('User-Agent') ?? '');
  try {
    await env.FEEDBACK_EMAIL.send(new EmailMessage(FROM_ADDRESS, env.FEEDBACK_TO, raw));
  } catch {
    return json({ error: 'Could not send the message' }, 502);
  }
  return json({ ok: true });
};
