import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Mientras la página se desarrolla, un aviso con el enlace al mapa estelar, que ya está listo.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main style={{ minHeight: '100svh', display: 'grid', placeContent: 'center', gap: 12, padding: 24, color: '#e8eee5', background: '#020309', fontFamily: '"Barlow Condensed", sans-serif', textAlign: 'center' }}>
      <h1 style={{ margin: 0, fontSize: 40, letterSpacing: '0.04em', textTransform: 'uppercase' }}>BATTLETECH MechLab</h1>
      <p style={{ margin: 0, fontSize: 20 }}>Coming soon. Meanwhile, explore the <a href="/battletech/starmap/" style={{ color: '#ffd400' }}>star map</a>.</p>
    </main>
  </StrictMode>,
)
