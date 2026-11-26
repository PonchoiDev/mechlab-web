import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La composición de la página de equipo de MW5 (units.css y equipment.css), con lo propio de YAML aparte.
import '../../units/units.css'
import '../../equipment/equipment.css'
import './yamlEquipment.css'
import { YamlEquipmentApp } from './YamlEquipmentApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <YamlEquipmentApp />
  </StrictMode>,
)
