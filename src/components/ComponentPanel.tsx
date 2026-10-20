import type { Item } from '../types/item';
import type { ComponentData, EquippedItem, Hardpoint } from '../types/mech';
import { clampArmorValue } from '../utils/calculators';
import { getItemWeaponType, getSlotsLabel } from '../utils/items';
import { getActiveBuiltInMeleeWeapons, getHardpointOccupancy, getSlotTypeLabel, getUsedGeneralSlots } from '../utils/equipment';
import { ArmorControl } from './ArmorControl';
import { TierSelector } from './TierSelector';

interface ComponentPanelProps {
  title: string;
  baseData: ComponentData;
  equippedItems: EquippedItem[];
  isActive: boolean;
  armorFront: number;
  armorRear: number;
  onSelect: () => void;
  onRemoveItem: (instanceId: string) => void;
  onTierChange: (instanceId: string, tier: string) => void;
  onArmorChange: (type: 'front' | 'rear', value: number) => void;
}

const getHardpointTitle = (hardpoint: Hardpoint, assignedWeapon?: Item): string => {
  const weightClass = hardpoint.weightClass ? `, ${hardpoint.weightClass} class` : '';
  const description = `${hardpoint.type} hardpoint (${hardpoint.size}${weightClass})`;
  if (assignedWeapon) return `${description}: occupied by ${assignedWeapon.name}`;
  return hardpoint.defaultWeapon
    ? `${description}: free, uses the built-in ${hardpoint.defaultWeapon} when empty`
    : `${description}: free`;
};

export function ComponentPanel({
  title,
  baseData,
  equippedItems,
  isActive,
  armorFront,
  armorRear,
  onSelect,
  onRemoveItem,
  onTierChange,
  onArmorChange
}: ComponentPanelProps) {
  const slotsUsed = getUsedGeneralSlots(equippedItems);
  const specialSlots = Object.entries(baseData.specialSlots ?? {}).filter(([, count]) => count > 0);
  const hasJumpJetClassSlots = specialSlots.some(([slotType]) => slotType.startsWith('JumpJetClass'));
  const jumpJetSlotsUsed = equippedItems.filter(item => item.equippedSlotType?.startsWith('JumpJetClass')).length;
  const { weaponAssignments } = getHardpointOccupancy(baseData.hardpoints, equippedItems);
  const builtInMeleeWeapons = getActiveBuiltInMeleeWeapons(baseData.hardpoints, equippedItems);

  return (
    <div onClick={onSelect} className={isActive ? 'component-panel is-active' : 'component-panel'}>
      <div className="component-header">
        <h3 className="component-title">
          <button
            type="button"
            className="component-select"
            aria-pressed={isActive}
            onClick={(event) => { event.stopPropagation(); onSelect(); }}
          >
            {title}
          </button>
        </h3>
        <div className="component-capacity">
          <span className={slotsUsed > baseData.maxSlots ? 'slot-count is-over' : 'slot-count'}>
            [{slotsUsed} / {baseData.maxSlots} Slots]
          </span>
          {!hasJumpJetClassSlots && baseData.jumpJetSlots > 0 && (
            <span className="jump-jet-count" title="Jump jet slots">
              [JJ: {jumpJetSlotsUsed}/{baseData.jumpJetSlots}]
            </span>
          )}
        </div>
      </div>

      <div className="hardpoint-list">
        {baseData.hardpoints.length > 0 ? (
          baseData.hardpoints.map((hardpoint, index) => {
            const assignedWeapon = weaponAssignments.get(index);

            return (
              <button
                key={index}
                type="button"
                className={['hardpoint', assignedWeapon ? 'is-occupied' : '', hardpoint.defaultWeapon ? 'has-built-in' : '']
                  .filter(Boolean).join(' ')}
                data-weapon-type={hardpoint.type}
                title={getHardpointTitle(hardpoint, assignedWeapon)}
                onClick={(event) => { event.stopPropagation(); onSelect(); }}
              >
                <span className="hardpoint-dot" />
                {hardpoint.type} ({hardpoint.size.charAt(0).toUpperCase()})
                {assignedWeapon && <span className="hardpoint-check">✓</span>}
              </button>
            );
          })
        ) : (
          <span className="hardpoint-empty">No weapon hardpoints</span>
        )}
      </div>

      {specialSlots.length > 0 && (
        <div className="component-special-slots" aria-label="Special component slots">
          {specialSlots.map(([slotType, capacity]) => {
            const used = equippedItems.filter(item => item.equippedSlotType === slotType).length;
            return (
              <span key={slotType} className={used >= capacity ? 'special-slot is-full' : 'special-slot'}>
                <span>{getSlotTypeLabel(slotType)}</span>
                <strong>{used}/{capacity}</strong>
              </span>
            );
          })}
        </div>
      )}

      <div className="armor-box">
        <div className="armor-summary">
          <span>Armor: <strong>{armorFront + armorRear}</strong> / {baseData.maxArmor}</span>
          <span>Structure: <strong>{baseData.structure}</strong></span>
        </div>
        <ArmorControl
          label={`${title} front armor`}
          shortLabel="F"
          value={armorFront}
          onChange={(value) => onArmorChange('front', clampArmorValue(value, armorRear, baseData.maxArmor))}
        />
        {baseData.hasRearArmor && (
          <ArmorControl
            label={`${title} rear armor`}
            shortLabel="R"
            value={armorRear}
            onChange={(value) => onArmorChange('rear', clampArmorValue(value, armorFront, baseData.maxArmor))}
          />
        )}
      </div>

      <div className="equipped-list">
        {builtInMeleeWeapons.map((weaponName, index) => (
          <div
            key={`built-in-${index}`}
            className="equipped-item is-built-in"
            data-weapon-type="melee"
            title="Used automatically while no melee weapon is equipped in this hardpoint"
          >
            <span>{weaponName}</span>
            <span className="built-in-tag">BUILT-IN</span>
          </div>
        ))}
        {equippedItems.map(item => (
          <div key={item.instanceId} className="equipped-item" data-weapon-type={getItemWeaponType(item) ?? undefined}>
            <span>
              {item.name}
              {item.type !== 'weapon' && <span className="equipped-item-slots"> ({getSlotsLabel(item)})</span>}
            </span>
            {item.type === 'weapon' && item.tiers && (
              <TierSelector item={item} onChange={(tier) => onTierChange(item.instanceId, tier)} />
            )}
            <button
              type="button"
              className="remove-item"
              aria-label={`Remove ${item.name}`}
              onClick={(event) => { event.stopPropagation(); onRemoveItem(item.instanceId); }}
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
