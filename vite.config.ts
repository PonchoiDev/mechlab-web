import { cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'
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

// En desarrollo no hay Worker: el servidor de Vite hace de proxy de las imágenes de Sarna.
const sarnaImageProxy = (): Plugin => {
  const handle: Connect.NextHandleFunction = async (req, res) => {
    const target = getSarnaImageTarget(new URL(req.originalUrl ?? '', 'http://localhost'))
    const response = target ? await fetchSarnaImage(target) : new Response('Invalid image URL', { status: 400 })
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(Buffer.from(await response.arrayBuffer()))
  }

  return {
    name: 'sarna-image-proxy',
    configureServer: server => { server.middlewares.use(SARNA_IMAGE_PATH, handle) },
    configurePreviewServer: server => { server.middlewares.use(SARNA_IMAGE_PATH, handle) }
  }
}

export default defineConfig({
  base: `/${GAME_PATH}/`,
  build: {
    outDir: `dist/${GAME_PATH}`
  },
  plugins: [react(), rootSite(), sarnaImageProxy()],
})
