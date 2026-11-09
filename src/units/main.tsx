import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './units.css'
import { UnitsApp } from './UnitsApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UnitsApp />
  </StrictMode>,
)
