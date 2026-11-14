import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { workerApi } from './vite.plugins.ts'

// BATTLETECH (Harebrained Schemes, 2018) vive en mw-builder.com/battletech/, con su propio build: las
// rutas de MW5 Mercenaries (/mercs/) no cambian. Sus páginas están en battletech/ y su código en
// src/battletech/. Se construye después del de MW5, que es el que vacía dist/ y copia site/.
const GAME_PATH = 'battletech'

export default defineConfig({
  root: resolve(import.meta.dirname, GAME_PATH),
  base: `/${GAME_PATH}/`,
  publicDir: resolve(import.meta.dirname, GAME_PATH, 'public'),
  build: {
    outDir: resolve(import.meta.dirname, 'dist', GAME_PATH),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, GAME_PATH, 'index.html'),
        starmap: resolve(import.meta.dirname, GAME_PATH, 'starmap/index.html'),
        argo: resolve(import.meta.dirname, GAME_PATH, 'argo/index.html')
      }
    }
  },
  // El código está fuera de battletech/ (en src/): el servidor de desarrollo tiene que poder leerlo.
  server: { port: 5174, fs: { allow: [import.meta.dirname] } },
  plugins: [react(), workerApi(GAME_PATH)]
})
