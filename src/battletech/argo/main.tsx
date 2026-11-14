import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Provisional: la página se monta en el commit que la desarrolla.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <p>BATTLETECH argo</p>
  </StrictMode>,
)
