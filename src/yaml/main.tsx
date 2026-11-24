import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La cabecera y el aspecto son los de las unidades enemigas; yaml.css añade el tablero y el selector.
import '../units/units.css'
import './yaml.css'
import { YamlApp } from './YamlApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <YamlApp />
  </StrictMode>,
)
