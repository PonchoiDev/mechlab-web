import type { ReactNode } from 'react';
import type { ArmorState, EquippedLoadout, Mech, Zone } from '../types/mech';
import { getAmmoWarnings } from '../utils/equipment';
import { ZONES } from '../utils/zones';
import { ComponentCard } from './ComponentCard';

interface MechBoardProps {
  mech: Mech;
  loadout: EquippedLoadout;
  armor: ArmorState;
  activeZone: Zone | null;
  selectedHardpoint: number | null;
  reference: ReactNode;
  onSelectZone: (zone: Zone, hardpointIndex: number | null) => void;
  onArmorChange: (zone: Zone, type: 'front' | 'rear', value: number) => void;
  onHardpointMenu: (zone: Zone, hardpointIndex: number, x: number, y: number) => void;
  onEquipmentMenu: (zone: Zone, itemName: string, x: number, y: number) => void;
}

export function MechBoard({
  mech,
  loadout,
  armor,
  activeZone,
  selectedHardpoint,
  reference,
  onSelectZone,
  onArmorChange,
  onHardpointMenu,
  onEquipmentMenu
}: MechBoardProps) {
  const ammoWarnings = getAmmoWarnings(loadout);

  return (
    <section className="mech-board" aria-label={`${mech.name} ${mech.variant} components`}>
      <div className="mech-board-reference">
        <div className="mech-board-title">
          <h2>{mech.name}</h2>
          <span className="variant-tag">{mech.variant}</span>
        </div>
        <div className="mech-board-image">{reference}</div>
      </div>
      {ZONES.map(({ zone, label, position }) => (
        <ComponentCard
          key={zone}
          label={label}
          position={position}
          componentData={mech.components[zone]}
          equippedItems={loadout[zone]}
          ammoWarnings={ammoWarnings[zone]}
          armorFront={armor[zone].front}
          armorRear={armor[zone].rear}
          isActive={activeZone === zone}
          selectedHardpoint={selectedHardpoint}
          onSelect={(hardpointIndex) => onSelectZone(zone, hardpointIndex)}
          onArmorChange={(type, value) => onArmorChange(zone, type, value)}
          onHardpointMenu={(index, x, y) => onHardpointMenu(zone, index, x, y)}
          onEquipmentMenu={(itemName, x, y) => onEquipmentMenu(zone, itemName, x, y)}
        />
      ))}
    </section>
  );
}
