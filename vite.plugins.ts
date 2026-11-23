import { cpSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { BUILDS_PATH, handleBuilds } from './worker/builds.ts'
import { FEEDBACK_PATH, parseFeedback } from './worker/feedback.ts'
import { createMemoryBuildStore } from './worker/memoryBuildStore.ts'
import { fetchSarnaImage, getSarnaImageTarget, SARNA_IMAGE_PATH } from './worker/sarnaImage.ts'
import { CHANGELOG } from './src/data/changelog.ts'

// Plugins que comparten los builds de cada juego (vite.config.ts para MW5 Mercenaries en /mercs/ y
// vite.battletech.config.ts para BATTLETECH en /battletech/). Lo que va en la raíz del sitio
// (redirecciones y página de entrada) está en site/ y lo copia el build de MW5, que va primero.
export const SITE_DIR = resolve(import.meta.dirname, 'dist')

export const rootSite = (): Plugin => ({
  name: 'root-site',
  apply: 'build',
  buildStart() {
    rmSync(SITE_DIR, { recursive: true, force: true })
  },
  closeBundle() {
    cpSync(resolve(import.meta.dirname, 'site'), SITE_DIR, { recursive: true })
    // La portada es HTML estático: su campana de novedades lee este archivo.
    writeFileSync(resolve(SITE_DIR, 'changelog.json'), JSON.stringify(CHANGELOG))
  }
})

// En desarrollo no hay Worker: el servidor de Vite hace sus veces para las rutas <juego>/api/*.
// Las de /battletech/api/* son las mismas que las de /mercs/api/* (el Worker las trata igual).
export const workerApi = (game = 'mercs'): Plugin => {
  const forGame = (path: string) => path.replace(/^\/mercs\//, `/${game}/`)
  const handle: Connect.NextHandleFunction = async (req, res) => {
    const target = getSarnaImageTarget(new URL(req.originalUrl ?? '', 'http://localhost'))
    const response = target ? await fetchSarnaImage(target) : new Response('Invalid image URL', { status: 400 })
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(Buffer.from(await response.arrayBuffer()))
  }

  // Sin Email Routing en local, el mensaje se escribe en la terminal en lugar de enviarse.
  const handleFeedback: Connect.NextHandleFunction = (req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      let feedback = null
      try { feedback = parseFeedback(JSON.parse(body)) } catch { /* cuerpo no válido */ }
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = feedback ? 200 : 400
      if (feedback) console.log('[feedback]', feedback)
      res.end(JSON.stringify(feedback ? { ok: true } : { error: 'Invalid message' }))
    })
  }

  // Sin D1 en local, las builds publicadas van a un almacén en memoria, que se pierde al reiniciar el servidor.
  const buildStore = createMemoryBuildStore()
  const handlePublishedBuilds: Connect.NextHandleFunction = (req, res) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', async () => {
      const url = new URL(req.originalUrl ?? '', 'http://localhost')
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
      const request = new Request(url, {
        method: req.method,
        headers: {
          'Content-Type': req.headers['content-type'] ?? 'application/json',
          Authorization: req.headers.authorization ?? '',
          'CF-Connecting-IP': req.socket.remoteAddress ?? 'local'
        },
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
      })
      const path = url.pathname.replace(/^\/battletech\/api\//, '/mercs/api/')
      const response = await handleBuilds(request, path, buildStore, { salt: 'local', adminKey: 'local-admin' })
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.end(Buffer.from(await response.arrayBuffer()))
    })
  }

  const mountApi = (middlewares: Connect.Server) => {
    middlewares.use(forGame(SARNA_IMAGE_PATH), handle)
    middlewares.use(forGame(FEEDBACK_PATH), handleFeedback)
    middlewares.use(forGame(BUILDS_PATH), handlePublishedBuilds)
  }

  return {
    name: 'worker-api',
    configureServer: server => mountApi(server.middlewares),
    configurePreviewServer: server => mountApi(server.middlewares)
  }
}
