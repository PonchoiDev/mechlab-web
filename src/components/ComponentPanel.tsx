import React from 'react';
import type { ComponentData } from '../types/mech';
import type { Item } from '../types/item';
import { getItemWeaponType } from '../utils/items';
import { getHardpointOccupancy, getSlotTypeLabel, getUsedGeneralSlots } from '../utils/equipment';

interface Props {
  title: string;
  baseData: ComponentData;
  equippedItems: Item[];
  isActive: boolean;
  selectedHardpointIndex?: number | null;
  armorFront: number;
  armorRear: number;
  onSelect: () => void;
  onSelectHardpoint?: (index: number) => void;
  onRemoveItem: (index: number) => void;
  onTierChange: (index: number, tier: string) => void;
  onArmorChange: (type: 'front' | 'rear', value: number) => void;
}

export const ComponentPanel: React.FC<Props> = ({ 
  title, 
  baseData, 
  equippedItems, 
  isActive, 
  selectedHardpointIndex,
  armorFront, 
  armorRear, 
  onSelect, 
  onSelectHardpoint,
  onRemoveItem, 
  onTierChange,
  onArmorChange 
}) => {
  const slotsUsed = getUsedGeneralSlots(equippedItems);
  const specialSlots = Object.entries(baseData.specialSlots ?? {}).filter(([, count]) => count > 0);
  const hasJumpJetClassSlots = specialSlots.some(([slotType]) => slotType.startsWith('JumpJetClass'));
  const jumpJetSlotsUsed = equippedItems.filter(item => item.equippedSlotType?.startsWith('JumpJetClass')).length;
  const totalArmor = armorFront + armorRear;
  const { weaponAssignments } = getHardpointOccupancy(baseData.hardpoints || [], equippedItems);

  const getHardpointColor = (type: string) => {
    switch(type.toLowerCase()) {
      case 'energy': return '#00d2ff';
      case 'ballistic': return '#ffb703';
      case 'missile': return '#4caf50';
      case 'ams': return '#e91e63';
      case 'melee': return '#9c27b0';
      default: return '#888';
    }
  };

  const handleArmorInput = (type: 'front' | 'rear', val: string) => {
    let num = parseInt(val) || 0;
    if (num < 0) num = 0;
    
    if (type === 'front' && num + armorRear > baseData.maxArmor) {
        num = baseData.maxArmor - armorRear;
    }
    if (type === 'rear' && num + armorFront > baseData.maxArmor) {
        num = baseData.maxArmor - armorFront;
    }
    onArmorChange(type, num);
  };

  return (
    <div 
      onClick={onSelect}
      className={isActive ? 'component-panel is-active' : 'component-panel'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '6px', marginBottom: '8px', alignItems: 'center' }}>
        <h3 style={{ margin: 0, textTransform: 'uppercase', color: isActive ? '#00d2ff' : '#ccc', fontSize: '15px', fontWeight: 'bold' }}>
          {title}
        </h3>
        <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
          <span style={{ color: slotsUsed > baseData.maxSlots ? '#ff4444' : '#888' }}>
            [{slotsUsed} / {baseData.maxSlots} Slots]
          </span>
          {!hasJumpJetClassSlots && baseData.jumpJetSlots > 0 && (
            <span style={{ color: '#ffb703' }} title="Ranuras para Jump Jets">
              [JJ: {jumpJetSlotsUsed}/{baseData.jumpJetSlots}]
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', minHeight: '16px', flexWrap: 'wrap' }}>
        {baseData.hardpoints && baseData.hardpoints.length > 0 ? (
          baseData.hardpoints.map((hp, index) => {
            const isHardpointActive = isActive && selectedHardpointIndex === index;
            const assignedWeapon = weaponAssignments.get(index);
            const isOccupied = !!assignedWeapon;

            return (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                  onSelectHardpoint?.(index);
                }}
                title={
                  isOccupied
                    ? `Anclaje ${hp.type} (${hp.size}): Ocupado por ${assignedWeapon.name}`
                    : `Anclaje ${hp.type} (${hp.size}): Libre. Haz clic para filtrar armas compatibles.`
                }
                style={{
                  fontSize: '11px',
                  padding: '3px 7px',
                  borderRadius: '4px',
                  color: isOccupied ? '#eee' : '#000',
                  fontWeight: 'bold',
                  textTransform: 'capitalize',
                  backgroundColor: isOccupied ? '#2e2e2e' : getHardpointColor(hp.type),
                  border: isHardpointActive
                    ? '2px solid #fff'
                    : isOccupied
                    ? `1px solid ${getHardpointColor(hp.type)}`
                    : '1px solid transparent',
                  boxShadow: isHardpointActive ? '0 0 6px #fff' : 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isOccupied ? '#4caf50' : '#000',
                    display: 'inline-block'
                  }}
                />
                {hp.type} ({hp.size ? hp.size.charAt(0).toUpperCase() : 'M'})
                {isOccupied && <span style={{ color: '#aaa', fontWeight: 'normal', fontSize: '10px' }}>✓</span>}
              </button>
            );
          })
        ) : (
          <span style={{ fontSize: '12px', color: '#555', fontStyle: 'italic' }}>Sin anclajes de armas</span>
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

      <div style={{ marginBottom: '10px', fontSize: '14px', padding: '8px', backgroundColor: '#111', borderRadius: '4px', border: '1px solid #222' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#aaa', fontSize: '13px' }}>
          <span>Armor: <strong style={{ color: '#eee' }}>{totalArmor}</strong> / {baseData.maxArmor}</span>
          <span>Structure: <strong style={{ color: '#eee' }}>{baseData.structure}</strong></span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '15px', color: '#888', fontWeight: 'bold' }}>F:</span>
          <button 
            onClick={(e) => { e.stopPropagation(); handleArmorInput('front', String(armorFront - 1)); }} 
            style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff', cursor: 'pointer', padding: '2px 8px', borderRadius: '3px' }}
          >-</button>
          
          <input 
            type="number" 
            value={armorFront} 
            onChange={(e) => handleArmorInput('front', e.target.value)} 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '46px', textAlign: 'center', background: '#1a1a1a', color: '#fff', border: '1px solid #444', borderRadius: '3px', padding: '2px' }} 
          />
          
          <button 
            onClick={(e) => { e.stopPropagation(); handleArmorInput('front', String(armorFront + 1)); }} 
            style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff', cursor: 'pointer', padding: '2px 8px', borderRadius: '3px' }}
          >+</button>
        </div>

        {baseData.hasRearArmor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <span style={{ width: '15px', color: '#888', fontWeight: 'bold' }}>R:</span>
            <button 
              onClick={(e) => { e.stopPropagation(); handleArmorInput('rear', String(armorRear - 1)); }} 
              style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff', cursor: 'pointer', padding: '2px 8px', borderRadius: '3px' }}
            >-</button>
            
            <input 
              type="number" 
              value={armorRear} 
              onChange={(e) => handleArmorInput('rear', e.target.value)} 
              onClick={(e) => e.stopPropagation()}
              style={{ width: '46px', textAlign: 'center', background: '#1a1a1a', color: '#fff', border: '1px solid #444', borderRadius: '3px', padding: '2px' }}
            />
            
            <button 
              onClick={(e) => { e.stopPropagation(); handleArmorInput('rear', String(armorRear + 1)); }} 
              style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff', cursor: 'pointer', padding: '2px 8px', borderRadius: '3px' }}
            >+</button>
          </div>
        )}
      </div>
      
      <div style={{ minHeight: '30px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {equippedItems.map((item, index) => {
          const wType = getItemWeaponType(item) || item.weaponType;
          return (
          <div key={index} style={{ backgroundColor: '#252525', padding: '5px 8px', fontSize: '13px', borderLeft: `3px solid ${wType ? getHardpointColor(wType) : '#888'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 4px 4px 0' }}>
            <span>{item.name} <span style={{ color: '#888' }}>({item.slots}s)</span></span>
            {item.type === 'weapon' && item.tiers && (
              <div role="group" aria-label={`Tier de ${item.name}`} style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                <span style={{ color: '#888', marginRight: '2px' }}>T</span>
                {item.tiers['0'] && (
                  <button
                    type="button"
                    aria-label="Tier 0"
                    aria-pressed={(item.tier ?? '1') === '0'}
                    title="Tier 0"
                    onClick={(event) => {
                      event.stopPropagation();
                      onTierChange(index, '0');
                    }}
                    style={{ padding: '0 2px', color: (item.tier ?? '1') === '0' ? '#fff' : '#87938a', background: 'transparent', border: 0, font: '500 9px var(--work-mono)', cursor: 'pointer' }}
                  >0</button>
                )}
                {(['1', '2', '3', '4'] as const).filter(tier => item.tiers?.[tier]).map(tier => {
                  const selectedTier = item.tier ?? '1';
                  const selectedNumber = Number(selectedTier);
                  const isClanTier = selectedTier.toLowerCase() === 'clan';
                  const isFilled = isClanTier || selectedTier === '5' || selectedNumber >= Number(tier);
                  const tierColor = isClanTier ? '#c3ed62' : selectedTier === '5' ? '#ff9d00' : '#00d2ff';

                  return (
                    <button
                      key={tier}
                      type="button"
                      aria-label={`Tier ${tier}`}
                      aria-pressed={selectedTier === tier}
                      title={`Tier ${tier}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onTierChange(index, tier);
                      }}
                      style={{ width: '12px', height: '10px', padding: 0, border: selectedTier === tier ? '1px solid #fff' : '1px solid #555', borderRadius: '1px', backgroundColor: isFilled ? tierColor : '#303238', cursor: 'pointer' }}
                    />
                  );
                })}
                {item.tiers['5'] && (
                  <button
                    type="button"
                    aria-label="Tier 5 legendario"
                    aria-pressed={(item.tier ?? '1') === '5'}
                    title="Tier 5 legendario"
                    onClick={(event) => {
                      event.stopPropagation();
                      onTierChange(index, '5');
                    }}
                    style={{ marginLeft: '2px', padding: '0 2px', color: (item.tier ?? '1') === '5' ? '#ff9d00' : '#a96b18', background: 'transparent', border: 0, font: '600 9px var(--work-mono)', cursor: 'pointer' }}
                  >5</button>
                )}
                {Object.keys(item.tiers).find(tier => tier.toLowerCase() === 'clan') && (
                  <button
                    type="button"
                    aria-label="Clan tier"
                    aria-pressed={(item.tier ?? '1').toLowerCase() === 'clan'}
                    title="Clan tier"
                    onClick={(event) => {
                      event.stopPropagation();
                      onTierChange(index, 'Clan');
                    }}
                    style={{ marginLeft: '2px', padding: '0 2px', color: (item.tier ?? '1').toLowerCase() === 'clan' ? '#c3ed62' : '#849451', background: 'transparent', border: 0, font: '700 9px var(--work-mono)', cursor: 'pointer' }}
                  >C</button>
                )}
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); onRemoveItem(index); }} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
          );
        })}
      </div>
    </div>
  );
};