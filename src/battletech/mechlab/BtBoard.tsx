import type { MouseEvent } from 'react';
import type { Zone } from '../../types/mech';
import type { BtArmorSide, BtBuild } from '../../types/battletech-mechlab';
import { SlotBar } from '../../components/SlotBar';
import { ZONES } from '../../utils/zones';
import { getArmorLimit } from '../../utils/battletech/armor';
import { getItemTab } from '../../utils/battletech/filters';
import { getFixedItems, getLocationUsage, getZoneItems } from '../../utils/battletech/fitting';
import { HARDPOINT_LABELS, HARDPOINT_SHORT, HARDPOINTS, SOURCE_LABELS, WEIGHT_CLASS_LABELS } from '../../utils/battletech/mechlabData';
import { MechIcon } from './MechIcon';

interface BtBoardProps {
  build: BtBuild;
  activeZone: Zone;
  onSelectZone: (zone: Zone) => void;
  onRemove: (zone: Zone, index: number) => void;
  onArmorChange: (zone: Zone, side: BtArmorSide, value: number) => void;
  onArmorStep: (zone: Zone, side: BtArmorSide, steps: number) => void;
}

const stop = (event: MouseEvent) => event.stopPropagation();

const formatTonnage = (value: number) => String(Number(value.toFixed(2)));

function ArmorField({ label, short, value, max, onChange, onStep }: {
  label: string;
  short: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  onStep: (steps: number) => void;
}) {
  return (
    <div className="armor-control bt-armor-control">
      <span className="armor-control-label" aria-hidden="true" title={label}>{short}</span>
      <button type="button" className="armor-step" aria-label={`Decrease ${label} by 5`} disabled={value <= 0} onClick={(event) => { stop(event); onStep(-1); }}>-</button>
      <input
        type="number"
        className="armor-input"
        aria-label={label}
        min={0}
        max={max}
        value={value}
        onClick={stop}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10) || 0)}
      />
      <button type="button" className="armor-step" aria-label={`Increase ${label} by 5`} disabled={value >= max} onClick={(event) => { stop(event); onStep(1); }}>+</button>
      <small className="bt-armor-max">/ {max}</small>
    </div>
  );
}

function LocationCard({ build, zone, label, position, isActive, onSelectZone, onRemove, onArmorChange, onArmorStep }: Omit<BtBoardProps, 'activeZone'> & {
  zone: Zone;
  label: string;
  position: string;
  isActive: boolean;
}) {
  const { mech, loadout, armor } = build;
  const location = mech.locations[zone];
  const usage = getLocationUsage(mech, loadout, zone);
  const fixed = getFixedItems(mech, zone);
  const mounted = getZoneItems(loadout, zone);
  const isOver = usage.slots.used > usage.slots.capacity || HARDPOINTS.some(type => usage.hardpoints[type].used > usage.hardpoints[type].capacity);
  const isFull = usage.slots.used === usage.slots.capacity;
  const frontMax = getArmorLimit(mech, zone, 'front');
  const rearMax = location.maxRearArmor;
  const className = ['component-card', 'bt-location', `board-${position}`, isActive ? 'is-active' : '', isOver ? 'is-over' : isFull ? 'is-full' : 'has-free-space']
    .filter(Boolean).join(' ');

  return (
    <section className={className} aria-label={label} onClick={() => onSelectZone(zone)}>
      <header className="component-card-header">
        <button type="button" className="component-card-title" aria-pressed={isActive} onClick={(event) => { stop(event); onSelectZone(zone); }}>
          {label}
        </button>
        <span className="bt-structure" title="Internal structure">{location.structure} IS</span>
      </header>

      <SlotBar used={usage.slots.used} capacity={usage.slots.capacity} label="Slots" />

      {location.hardpoints.length > 0 && (
        <div className="bt-hardpoints" aria-label="Hardpoints">
          {HARDPOINTS.filter(type => usage.hardpoints[type].capacity > 0).map(type => {
            const { used, capacity } = usage.hardpoints[type];
            return (
              <span
                key={type}
                className={used > capacity ? 'bt-hardpoint-tag is-over' : used === capacity ? 'bt-hardpoint-tag is-full' : 'bt-hardpoint-tag'}
                data-weapon-type={type}
                title={`${HARDPOINT_LABELS[type]}: ${used} of ${capacity} used`}
              >
                {HARDPOINT_SHORT[type]} {used}/{capacity}
              </span>
            );
          })}
        </div>
      )}

      <ul className="bt-items">
        {fixed.map((item, index) => (
          <li key={`fixed-${index}`} className="bt-item is-fixed" data-weapon-type={item.hardpoint ?? undefined} data-category={getItemTab(item)} title={`${item.name}: built into this chassis. ${item.bonuses.join('. ')}`}>
            <span className="bt-item-name">{item.name}</span>
            <small>{item.slots} sl · {formatTonnage(item.tonnage)} t · built-in</small>
          </li>
        ))}
        {mounted.map((item, index) => (
          <li key={`${item.id}-${index}`} className="bt-item" data-weapon-type={item.hardpoint ?? undefined} data-category={getItemTab(item)}>
            <span className="bt-item-name" title={item.manufacturer ? `${item.name} (${item.manufacturer})` : item.name}>{item.name}</span>
            <small>{item.slots} sl · {formatTonnage(item.tonnage)} t</small>
            <button
              type="button"
              className="bt-item-remove"
              aria-label={`Remove ${item.name} from the ${label.toLowerCase()}`}
              onClick={(event) => { stop(event); onRemove(zone, index); }}
            >✕</button>
          </li>
        ))}
        {fixed.length === 0 && mounted.length === 0 && <li className="bt-item-empty">Empty</li>}
      </ul>

      <footer className="bt-armor">
        <ArmorField
          label={`${label} front armor`}
          short="Front"
          value={armor[zone].front}
          max={frontMax}
          onChange={(value) => onArmorChange(zone, 'front', value)}
          onStep={(steps) => onArmorStep(zone, 'front', steps)}
        />
        {rearMax !== null && (
          <ArmorField
            label={`${label} rear armor`}
            short="Rear"
            value={armor[zone].rear}
            max={rearMax}
            onChange={(value) => onArmorChange(zone, 'rear', value)}
            onStep={(steps) => onArmorStep(zone, 'rear', steps)}
          />
        )}
      </footer>
    </section>
  );
}

// Tablero con las 8 ubicaciones alrededor del icono y la ficha del 'Mech, como el del MechLab de MW5.
export function BtBoard(props: BtBoardProps) {
  const { mech } = props.build;
  return (
    <div className="mech-board bt-board">
      {ZONES.map(({ zone, label, position }) => (
        <LocationCard key={zone} {...props} zone={zone} label={label} position={position} isActive={props.activeZone === zone} />
      ))}
      <section className="mech-board-reference bt-reference" aria-label="'Mech">
        <div className="mech-board-title">
          <h2>{mech.name} <span>{mech.variant}</span></h2>
          {mech.source !== 'base' && <span className="bt-source-tag">{SOURCE_LABELS[mech.source]}</span>}
        </div>
        <MechIcon mech={mech} size={128} />
        <p className="bt-reference-meta">{mech.tonnage} t · {WEIGHT_CLASS_LABELS[mech.weightClass]}{mech.role ? ` · ${mech.role}` : ''}</p>
        {mech.tags.length > 0 && (
          <ul className="bt-tags" aria-label="Role tags">
            {mech.tags.map(tag => <li key={tag}>{tag}</li>)}
          </ul>
        )}
        <p className="bt-reference-description">{mech.description}</p>
      </section>
    </div>
  );
}
