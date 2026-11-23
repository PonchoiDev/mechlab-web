import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Los mismos estilos que la página de builds de MW5.
import '../../index.css'
import '../../App.css'
import '../../units/units.css'
import '../../builds/builds.css'
import { BtBuildsApp } from './BtBuildsApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BtBuildsApp />
  </StrictMode>,
)
