import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La cabecera, las fichas, la campana y el feedback son los de las unidades enemigas de MW5;
// argo.css cambia el color de acento y añade el árbol, el plan y lo propio de las mejoras.
import '../../units/units.css'
import './argo.css'
import { ArgoApp } from './ArgoApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ArgoApp />
  </StrictMode>,
)
