/// <reference types="vitest/config" />
import { cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'
import { FEEDBACK_PATH, parseFeedback } from './worker/feedback.ts'
import { fetchSarnaImage, getSarnaImageTarget, SARNA_IMAGE_PATH } from './worker/sarnaImage.ts'

// Cada juego vive en su propia ruta del dominio (mw-builder.com/mercs/). Lo que va en la raíz
// del sitio (redirecciones y página de entrada) está en site/ y se copia junto al build.
const GAME_PATH = 'mercs'
const SITE_DIR = resolve(__dirname, 'dist')

const rootSite = (): Plugin => ({
  name: 'root-site',
  apply: 'build',
  buildStart() {
    rmSync(SITE_DIR, { recursive: true, force: true })
  },
  closeBundle() {
    cpSync(resolve(__dirname, 'site'), SITE_DIR, { recursive: true })
  }
})

// En desarrollo no hay Worker: el servidor de Vite hace sus veces para las rutas /mercs/api/*.
const workerApi = (): Plugin => {
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

  return {
    name: 'worker-api',
    configureServer: server => {
      server.middlewares.use(SARNA_IMAGE_PATH, handle)
      server.middlewares.use(FEEDBACK_PATH, handleFeedback)
    },
    configurePreviewServer: server => {
      server.middlewares.use(SARNA_IMAGE_PATH, handle)
      server.middlewares.use(FEEDBACK_PATH, handleFeedback)
    }
  }
}

export default defineConfig({
  base: `/${GAME_PATH}/`,
  build: {
    outDir: `dist/${GAME_PATH}`
  },
  plugins: [react(), rootSite(), workerApi()],
  test: {
    // Cobertura de la lógica y del Worker (npm run coverage); el CI publica el resumen.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'worker/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/test/**', 'src/main.tsx', '**/*.d.ts'],
      reporter: ['text-summary', 'json-summary', 'html']
    }
  }
})
