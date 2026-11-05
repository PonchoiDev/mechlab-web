import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './starmap.css'
import { StarmapApp } from './StarmapApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StarmapApp />
  </StrictMode>,
)
