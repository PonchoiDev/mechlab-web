import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La cabecera, los filtros, las fichas, la campana y el feedback son los de las unidades enemigas;
// equipment.css solo cambia el color de acento y añade la tabla de armas y las fichas de equipo.
import '../units/units.css'
import './equipment.css'
import { EquipmentApp } from './EquipmentApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EquipmentApp />
  </StrictMode>,
)
