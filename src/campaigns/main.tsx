import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La cabecera, los filtros, las fichas, la campana y el feedback son los de las unidades enemigas;
// campaigns.css cambia el color de acento y añade las pestañas y las fichas plegables.
import '../units/units.css'
import './campaigns.css'
import { CampaignsApp } from './CampaignsApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CampaignsApp />
  </StrictMode>,
)
