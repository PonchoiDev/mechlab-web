import type { Zone } from '../../types/mech';
import type { BtArmorSide, BtBuild } from '../../types/battletech-mechlab';
import { SlotBar } from '../../components/SlotBar';
import { ZONES } from '../../utils/zones';
import { getArmorLimit } from '../../utils/battletech/armor';
import { getHardpointViews, getLocationUsage, groupZoneEquipment } from '../../utils/battletech/fitting';
import { getEquipmentCategory, getItemWeaponType, HARDPOINT_LABELS, HARDPOINTS, SOURCE_LABELS, WEIGHT_CLASS_LABELS } from '../../utils/battletech/mechlabData';
import { BtArmorControl } from './BtArmorControl';
import { MechIcon } from './MechIcon';

interface BtBoardProps {
  build: BtBuild;
  activeZone: Zone | null;
  onSelectZone: (zone: Zone) => void;
  onArmorChange: (zone: Zone, side: BtArmorSide, value: number) => void;
  onArmorStep: (zone: Zone, side: BtArmorSide, steps: number) => void;
}

// Tarjeta de una ubicación con el marcado del MechLab de MW5 (ComponentCard): anclajes con su arma,
// equipo agrupado, barra de ranuras y blindaje. En BATTLETECH las armas también ocupan ranuras, y el
// blindaje delantero y el trasero tienen cada uno su máximo.
function LocationCard({ build, zone, label, position, isActive, onSelectZone, onArmorChange, onArmorStep }: Omit<BtBoardProps, 'activeZone'> & {
  zone: Zone;
  label: string;
  position: string;
  isActive: boolean;
}) {
  const { mech, loadout, armor } = build;
  const location = mech.locations[zone];
  const usage = getLocationUsage(mech, loadout, zone);
  const hardpoints = getHardpointViews(mech, loadout, zone);
  const equipment = groupZoneEquipment(mech, loadout, zone);
  const freeHardpoints = hardpoints.filter(view => !view.item).length;
  const isOver = usage.slots.used > usage.slots.capacity || HARDPOINTS.some(type => usage.hardpoints[type].used > usage.hardpoints[type].capacity);
  const stateClass = isOver ? 'is-over' : usage.slots.used < usage.slots.capacity || freeHardpoints > 0 ? 'has-free-space' : 'is-full';
  const frontMax = getArmorLimit(mech, zone, 'front');
  const rearMax = location.maxRearArmor;
  const armorTotal = armor[zone].front + armor[zone].rear;
  const maxArmor = frontMax + (rearMax ?? 0);
  const select = () => onSelectZone(zone);

  return (
    <div className={['component-card', `board-${position}`, stateClass, isActive ? 'is-active' : ''].filter(Boolean).join(' ')} onClick={select}>
      <div className="component-card-header">
        <button type="button" className="component-card-title" aria-pressed={isActive} onClick={(event) => { event.stopPropagation(); select(); }}>
          {label}
        </button>
        {freeHardpoints > 0 && <span className="component-card-badge">{freeHardpoints} free</span>}
      </div>

      {hardpoints.length > 0 && (
        <div className="component-card-hardpoints">
          {hardpoints.map((view, index) => (
            <button
              key={index}
              type="button"
              className={['hardpoint-chip', view.item ? 'is-occupied is-emphasized' : 'is-free', view.isOver ? 'is-over' : ''].filter(Boolean).join(' ')}
              data-weapon-type={view.type}
              title={`${HARDPOINT_LABELS[view.type]} hardpoint: ${view.item ? view.item.name : 'free'}`}
              onClick={(event) => { event.stopPropagation(); select(); }}
            >
              {!view.item && <span className="hardpoint-chip-label">{HARDPOINT_LABELS[view.type]}</span>}
              <span className="hardpoint-chip-content">
                <span className="hardpoint-chip-name">{view.item?.name ?? 'Free'}</span>
                {view.item && <span className="hardpoint-chip-tier">{view.item.slots} sl</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {equipment.length > 0 && (
        <div className="component-card-equipment">
          {equipment.map(group => (
            <button
              key={`${group.fixed ? 'fixed' : 'item'}-${group.item.id}`}
              type="button"
              className={group.fixed ? 'component-card-item is-built-in' : 'component-card-item'}
              data-category={getEquipmentCategory(group.item)}
              data-weapon-type={group.item.kind === 'ammo' ? getItemWeaponType(group.item) : undefined}
              title={group.fixed ? `${group.item.name}: built into this chassis, cannot be removed` : group.item.name}
              onClick={(event) => { event.stopPropagation(); select(); }}
            >
              {group.item.name}
              {group.count > 1 && <small>×{group.count}</small>}
              {group.fixed && <small>built-in</small>}
            </button>
          ))}
        </div>
      )}

      <div className="component-card-footer">
        <SlotBar used={usage.slots.used} capacity={usage.slots.capacity} label="Slots" />
      </div>

      <div className={armorTotal < maxArmor ? 'component-card-armor is-low' : 'component-card-armor'}>
        <span className="component-card-armor-total" title={`Armor ${armorTotal} / ${maxArmor}`}>
          <span className="armor-meter" aria-hidden="true">
            <span style={{ width: `${maxArmor > 0 ? (armorTotal / maxArmor) * 100 : 0}%` }} />
          </span>
          Armor {armorTotal} / {maxArmor}
        </span>
        <span className="component-card-armor-controls">
          <BtArmorControl
            label={`${label} front armor`}
            shortLabel={rearMax !== null ? 'Front' : 'Armor'}
            value={armor[zone].front}
            max={frontMax}
            onChange={(value) => onArmorChange(zone, 'front', value)}
            onStep={(steps) => onArmorStep(zone, 'front', steps)}
          />
          {rearMax !== null && (
            <BtArmorControl
              label={`${label} rear armor`}
              shortLabel="Rear"
              value={armor[zone].rear}
              max={rearMax}
              onChange={(value) => onArmorChange(zone, 'rear', value)}
              onStep={(steps) => onArmorStep(zone, 'rear', steps)}
            />
          )}
        </span>
      </div>
    </div>
  );
}

// Tablero con las 8 ubicaciones alrededor de la ficha del 'Mech, como el MechBoard de MW5.
export function BtBoard(props: BtBoardProps) {
  const { mech } = props.build;
  return (
    <section className="mech-board bt-board" aria-label={`${mech.name} ${mech.variant} components`}>
      <div className="mech-board-reference bt-reference">
        <div className="mech-board-title">
          <h2>{mech.name}</h2>
          <span className="variant-tag">{mech.variant}</span>
        </div>
        <p className="bt-reference-meta">
          {mech.tonnage} t · {WEIGHT_CLASS_LABELS[mech.weightClass]}{mech.role ? ` · ${mech.role}` : ''}
          {mech.source !== 'base' && <> · <span className="bt-source-tag">{SOURCE_LABELS[mech.source]}</span></>}
        </p>
        <div className="mech-board-image">
          <MechIcon mech={mech} size={128} />
          {mech.tags.length > 0 && (
            <ul className="bt-tags" aria-label="Role tags">
              {mech.tags.map(tag => <li key={tag}>{tag}</li>)}
            </ul>
          )}
          <p className="bt-reference-description">{mech.description}</p>
        </div>
      </div>
      {ZONES.map(({ zone, label, position }) => (
        <LocationCard key={zone} {...props} zone={zone} label={label} position={position} isActive={props.activeZone === zone} />
      ))}
    </section>
  );
}
