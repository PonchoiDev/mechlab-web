import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La cabecera, los filtros, la campana y el feedback son los de las unidades enemigas; las listas plegables
// y el rosa, los de HRQ & Campaigns de MW5 (campaigns.css). flashpoints.css añade lo propio: caminos y pagos.
import '../../units/units.css'
import '../../campaigns/campaigns.css'
import './flashpoints.css'
import { BtFlashpointsApp } from './BtFlashpointsApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BtFlashpointsApp />
  </StrictMode>,
)
