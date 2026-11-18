import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La cabecera, los filtros, la campana y el feedback son los de las unidades enemigas, y la tabla es la de la
// página de armas; chassis.css solo cambia el color de acento y añade los filtros del selector de 'Mechs.
import '../units/units.css'
import '../equipment/equipment.css'
import './chassis.css'
import { ChassisApp } from './ChassisApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChassisApp />
  </StrictMode>,
)
