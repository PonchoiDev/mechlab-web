import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Los mismos estilos que la lista de chasis de MW5: los de las unidades enemigas, la tabla de la página de
// armas y el naranja de chassis.css.
import '../../units/units.css'
import '../../equipment/equipment.css'
import '../../chassis/chassis.css'
import { BtChassisApp } from './BtChassisApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BtChassisApp />
  </StrictMode>,
)
