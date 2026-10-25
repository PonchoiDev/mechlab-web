import type { CSSProperties } from 'react';
import type { ComponentData, EquippedItem } from '../types/mech';
import { clampArmorValue, scaleArmorPoints } from '../utils/calculators';
import {
  getComponentStatus,
  getEquipmentCategory,
  getHardpointViews,
  getSlotTypeLabel,
  groupEquipment,
  type AmmoWarning
} from '../utils/equipment';
import { ArmorControl } from './ArmorControl';
import { useLongPress } from '../hooks/useLongPress';
import { getMenuPosition } from '../utils/menuPosition';
import { HardpointChip } from './HardpointChip';
import { SlotBar } from './SlotBar';

interface ComponentCardProps {
  label: string;
  position: string;
  componentData: ComponentData;
  equippedItems: EquippedItem[];
  ammoWarnings: AmmoWarning[];
  armorFront: number;
  armorRear: number;
  isActive: boolean;
  selectedHardpoint: number | null;
  onSelect: (hardpointIndex: number | null) => void;
  onArmorChange: (type: 'front' | 'rear', value: number) => void;
  onHardpointMenu: (hardpointIndex: number, x: number, y: number) => void;
  onEquipmentMenu: (itemName: string, x: number, y: number) => void;
  // Vista expandida: cada ranura es una celda y cada pieza ocupa las que usa.
  expandedSlots?: boolean;
  // Refined Armor: los puntos se muestran multiplicados.
  armorScale?: number;
}

interface EquipmentChipProps {
  item: EquippedItem;
  count: number;
  category: string;
  onMenu: (x: number, y: number) => void;
  // En la vista expandida, número de celdas que ocupa.
  slots?: number;
}

function EquipmentChip({ item, count, category, onMenu, slots }: EquipmentChipProps) {
  const longPress = useLongPress(onMenu);

  return (
    <button
      type="button"
      className={slots ? 'component-card-item slot-cell-item' : 'component-card-item'}
      style={slots ? { '--slots': slots } as CSSProperties : undefined}
      data-category={category}
      data-weapon-type={item.type === 'ammo' ? item.weaponType ?? undefined : undefined}
      title={`${item.name}: right-click for options`}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const { x, y } = getMenuPosition(event);
        onMenu(x, y);
      }}
      {...longPress}
    >
      {item.name}
      {count > 1 && <small>×{count}</small>}
    </button>
  );
}

const GENERAL_SLOT_TYPE = 'General_SlotType';

interface SlotCellsProps {
  label: string;
  items: EquippedItem[];
  capacity: number;
  slotsOf: (item: EquippedItem) => number;
  onMenu: (itemName: string, x: number, y: number) => void;
}

// Ranuras de un tipo como celdas: las piezas ocupan sus celdas y los huecos libres quedan a la vista.
function SlotCells({ label, items, capacity, slotsOf, onMenu }: SlotCellsProps) {
  const used = items.reduce((total, item) => total + slotsOf(item), 0);
  if (capacity === 0 && items.length === 0) return null;

  return (
    <div className="slot-cells" aria-label={`${label}: ${used} of ${capacity} slots`}>
      <span className="slot-cells-label">{label} <small>{used}/{capacity}</small></span>
      {items.map(item => (
        <EquipmentChip
          key={item.instanceId}
          item={item}
          count={1}
          category={getEquipmentCategory(item)}
          slots={Math.max(1, slotsOf(item))}
          onMenu={(x, y) => onMenu(item.name, x, y)}
        />
      ))}
      {Array.from({ length: Math.max(0, capacity - used) }, (_, index) => (
        <span key={`empty-${index}`} className="slot-cell-empty" aria-hidden="true" />
      ))}
    </div>
  );
}

const AMMO_WARNING_TEXT: Record<AmmoWarning['kind'], string> = {
  'missing-ammo': 'no ammo',
  'unused-ammo': 'no weapon uses it'
};

export function ComponentCard({
  label,
  position,
  componentData,
  equippedItems,
  ammoWarnings,
  armorFront,
  armorRear,
  isActive,
  selectedHardpoint,
  onSelect,
  onArmorChange,
  onHardpointMenu,
  onEquipmentMenu,
  expandedSlots = false,
  armorScale = 1
}: ComponentCardProps) {
  const status = getComponentStatus(componentData, equippedItems);
  const hardpoints = getHardpointViews(componentData.hardpoints, equippedItems);
  const equipment = groupEquipment(equippedItems);
  const armorTotal = armorFront + armorRear;
  const isArmorLow = armorTotal < componentData.maxArmor;
  const shownArmor = scaleArmorPoints(armorFront, armorScale) + scaleArmorPoints(armorRear, armorScale);
  const shownMaxArmor = scaleArmorPoints(componentData.maxArmor, armorScale);
  const stateClass = status.isOverSlots ? 'is-over' : status.hasFreeSpace ? 'has-free-space' : 'is-full';

  return (
    <div
      className={['component-card', `board-${position}`, stateClass, isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
      onClick={() => onSelect(null)}
    >
      <div className="component-card-header">
        <button
          type="button"
          className="component-card-title"
          aria-pressed={isActive}
          onClick={(event) => { event.stopPropagation(); onSelect(null); }}
        >
          {label}
        </button>
        {status.freeHardpoints > 0 && (
          <span className="component-card-badge">{status.freeHardpoints} free</span>
        )}
      </div>

      {hardpoints.length > 0 && (
        <div className="component-card-hardpoints">
          {hardpoints.map(view => (
            <HardpointChip
              key={view.index}
              view={view}
              isSelected={isActive && selectedHardpoint === view.index}
              emphasizeWeapon
              onClick={() => onSelect(view.index)}
              onContextMenu={(x, y) => onHardpointMenu(view.index, x, y)}
            />
          ))}
        </div>
      )}

      {expandedSlots && (
        <div className="component-card-slots">
          <SlotCells
            label="Slots"
            items={equippedItems.filter(item => item.type !== 'weapon' && (item.equippedSlotType ?? GENERAL_SLOT_TYPE) === GENERAL_SLOT_TYPE)}
            capacity={status.maxSlots}
            slotsOf={item => item.slots ?? 0}
            onMenu={onEquipmentMenu}
          />
          {status.specialSlots.map(slot => (
            <SlotCells
              key={slot.slotType}
              label={getSlotTypeLabel(slot.slotType)}
              items={equippedItems.filter(item => item.equippedSlotType === slot.slotType)}
              capacity={slot.capacity}
              slotsOf={() => 1}
              onMenu={onEquipmentMenu}
            />
          ))}
        </div>
      )}

      {!expandedSlots && equipment.length > 0 && (
        <div className="component-card-equipment">
          {equipment.map(({ item, count }) => (
            <EquipmentChip
              key={item.name}
              item={item}
              count={count}
              category={getEquipmentCategory(item)}
              onMenu={(x, y) => onEquipmentMenu(item.name, x, y)}
            />
          ))}
        </div>
      )}

      {ammoWarnings.length > 0 && (
        <ul className="component-card-warnings">
          {ammoWarnings.map(warning => (
            <li key={`${warning.kind}-${warning.itemName}`} className={`ammo-warning is-${warning.kind}`}>
              {warning.itemName}: {AMMO_WARNING_TEXT[warning.kind]}
            </li>
          ))}
        </ul>
      )}

      {!expandedSlots && <div className="component-card-footer">
        <SlotBar used={status.usedSlots} capacity={status.maxSlots} label="Slots" />
        {status.specialSlots.map(slot => (
          <SlotBar
            key={slot.slotType}
            used={slot.used}
            capacity={slot.capacity}
            label={getSlotTypeLabel(slot.slotType)}
            variant="special"
          />
        ))}
      </div>}

      <div className={isArmorLow ? 'component-card-armor is-low' : 'component-card-armor'}>
        <span className="component-card-armor-total" title={`Armor ${shownArmor} / ${shownMaxArmor}`}>
          <span className="armor-meter" aria-hidden="true">
            <span style={{ width: `${componentData.maxArmor > 0 ? armorTotal / componentData.maxArmor * 100 : 0}%` }} />
          </span>
          Armor {shownArmor} / {shownMaxArmor}
        </span>
        <span className="component-card-armor-controls">
          <ArmorControl
            label={`${label} front armor`}
            shortLabel={componentData.hasRearArmor ? 'Front' : 'Armor'}
            value={armorFront}
            scale={armorScale}
            onChange={(value) => onArmorChange('front', clampArmorValue(value, armorRear, componentData.maxArmor))}
          />
          {componentData.hasRearArmor && (
            <ArmorControl
              label={`${label} rear armor`}
              shortLabel="Rear"
              value={armorRear}
              scale={armorScale}
              onChange={(value) => onArmorChange('rear', clampArmorValue(value, armorFront, componentData.maxArmor))}
            />
          )}
        </span>
      </div>
    </div>
  );
}
