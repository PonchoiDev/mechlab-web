import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// El lienzo, la cabecera, la ficha y la leyenda son los del mapa de MW5; battletech.css añade lo propio.
import '../../starmap/starmap.css'
import './battletech.css'
import { BtStarmapApp } from './BtStarmapApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BtStarmapApp />
  </StrictMode>,
)
