import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La cabecera, los filtros, las fichas, la campana y el feedback son los de las unidades enemigas de MW5,
// como en la Argo; equipment.css cambia el color de acento y añade la tabla de armas y las fichas.
import '../../units/units.css'
import './equipment.css'
import { BtEquipmentApp } from './BtEquipmentApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BtEquipmentApp />
  </StrictMode>,
)
