import { cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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

export default defineConfig({
  base: `/${GAME_PATH}/`,
  build: {
    outDir: `dist/${GAME_PATH}`
  },
  plugins: [react(), rootSite()],
})
