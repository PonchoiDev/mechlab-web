import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// El aspecto es el del MechLab de MW5 (sus estilos generales y los de App.css), como el de BATTLETECH;
// yaml.css añade lo propio de YAML: las ranuras internas, los rellenos y el resumen de anclajes.
import '../index.css'
import '../App.css'
import './yaml.css'
import { YamlMechLabApp } from './YamlMechLabApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <YamlMechLabApp />
  </StrictMode>,
)
