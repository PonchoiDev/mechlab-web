import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// El aspecto es el del MechLab de MW5 (sus estilos generales y los de App.css); mechlab.css cambia el
// acento al amarillo de BATTLETECH y añade lo propio de este mechlab.
import '../../index.css'
import '../../App.css'
import './mechlab.css'
import { BtMechLabApp } from './BtMechLabApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BtMechLabApp />
  </StrictMode>,
)
