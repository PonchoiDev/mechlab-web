/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { rootSite, workerApi } from './vite.plugins.ts'

// Cada juego vive en su propia ruta del dominio (mw-builder.com/mercs/). Lo que va en la raíz
// del sitio (redirecciones y página de entrada) está en site/ y se copia junto al build.
const GAME_PATH = 'mercs'

export default defineConfig({
  base: `/${GAME_PATH}/`,
  build: {
    outDir: `dist/${GAME_PATH}`,
    // El mapa estelar, las unidades enemigas y los pilotos son otras páginas con su propio bundle: no se
    // descargan con el MechLab.
    rolldownOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        starmap: resolve(__dirname, 'starmap/index.html'),
        units: resolve(__dirname, 'units/index.html'),
        pilots: resolve(__dirname, 'pilots/index.html')
      }
    }
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
