import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Las fichas, los filtros, la cabecera, la campana y el feedback son los de las unidades enemigas de MW5,
// con su mismo rojo; units.css de aquí añade el blindaje por ubicación y lo propio de BATTLETECH.
import '../../units/units.css'
import './units.css'
import { BtUnitsApp } from './BtUnitsApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BtUnitsApp />
  </StrictMode>,
)
