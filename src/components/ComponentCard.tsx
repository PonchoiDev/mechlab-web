import type { ComponentData, EquippedItem } from '../types/mech';
import { clampArmorValue } from '../utils/calculators';
import { getComponentStatus, getHardpointViews, getSlotTypeLabel, type AmmoWarning } from '../utils/equipment';
import { ArmorControl } from './ArmorControl';
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
}

const getEquipmentCategory = (item: EquippedItem): string => {
  if (item.type === 'ammo') return 'ammo';
  if (item.equipmentType === 'jumpJet') return 'jump-jet';
  if (item.cooling !== undefined) return 'heat-sink';
  return 'module';
};

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
  onArmorChange
}: ComponentCardProps) {
  const status = getComponentStatus(componentData, equippedItems);
  const hardpoints = getHardpointViews(componentData.hardpoints, equippedItems);
  const equipment = Array.from(
    equippedItems
      .filter(item => item.type !== 'weapon')
      .reduce((groups, item) => {
        const group = groups.get(item.name) ?? { item, count: 0 };
        group.count += 1;
        return groups.set(item.name, group);
      }, new Map<string, { item: EquippedItem; count: number }>())
      .values()
  );
  const armorTotal = armorFront + armorRear;
  const isArmorLow = armorTotal < componentData.maxArmor;
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
            />
          ))}
        </div>
      )}

      {equipment.length > 0 && (
        <div className="component-card-equipment">
          {equipment.map(({ item, count }) => (
            <span
              key={item.name}
              className="component-card-item"
              data-category={getEquipmentCategory(item)}
              data-weapon-type={item.type === 'ammo' ? item.weaponType ?? undefined : undefined}
              title={item.name}
            >
              {item.name}
              {count > 1 && <small>×{count}</small>}
            </span>
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

      <div className="component-card-footer">
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
      </div>

      <div className={isArmorLow ? 'component-card-armor is-low' : 'component-card-armor'}>
        <span className="component-card-armor-total" title={`Armor ${armorTotal} / ${componentData.maxArmor}`}>
          <span className="armor-meter" aria-hidden="true">
            <span style={{ width: `${componentData.maxArmor > 0 ? armorTotal / componentData.maxArmor * 100 : 0}%` }} />
          </span>
          Armor {armorTotal} / {componentData.maxArmor}
        </span>
        <span className="component-card-armor-controls">
          <ArmorControl
            label={`${label} front armor`}
            shortLabel={componentData.hasRearArmor ? 'Front' : 'Armor'}
            value={armorFront}
            onChange={(value) => onArmorChange('front', clampArmorValue(value, armorRear, componentData.maxArmor))}
          />
          {componentData.hasRearArmor && (
            <ArmorControl
              label={`${label} rear armor`}
              shortLabel="Rear"
              value={armorRear}
              onChange={(value) => onArmorChange('rear', clampArmorValue(value, armorFront, componentData.maxArmor))}
            />
          )}
        </span>
      </div>
    </div>
  );
}
