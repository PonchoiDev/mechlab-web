import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La cabecera, los filtros, las fichas, la campana y el feedback son los de las unidades enemigas;
// pilots.css solo cambia el color de acento y añade lo propio de los rasgos y los programas.
import '../units/units.css'
import './pilots.css'
import { PilotsApp } from './PilotsApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PilotsApp />
  </StrictMode>,
)
