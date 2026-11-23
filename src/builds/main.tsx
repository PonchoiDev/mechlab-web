import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La cabecera es la de las demás páginas (units.css) y las filas, los filtros y los botones son los de My builds
// (App.css), con builds.css para lo propio de la página: los votos, la descripción y la marca de las propias.
import '../index.css'
import '../App.css'
import '../units/units.css'
import './builds.css'
import { BuildsApp } from './BuildsApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BuildsApp />
  </StrictMode>,
)
