import type { CSSProperties, MouseEvent } from 'react';
import { ArmorControl } from '../components/ArmorControl';
import { SlotBar } from '../components/SlotBar';
import type { Zone } from '../types/mech';
import type { YamlBuild, YamlMech } from '../types/yaml-mechlab';
import { ZONES } from '../utils/zones';
import { getHardpointUsage, getInternalLabel, getZoneRows, INTERNAL_SLOT_LABELS, INTERNAL_SLOTS, type FillerGroup, type ZoneRow } from '../utils/yaml/board';
import { GENERAL_SLOT } from '../utils/yaml/stats';
import { getItemColor, getSlotColor, getYamlItem, getYamlQuirk } from '../utils/yaml/data';
import { ModLogo } from './YamlInventoryPanel';
import type { YamlInventoryTarget } from '../utils/yaml/inventory';
import { getEngineRating, getFreeGeneralSlots, getStructurePoints } from '../utils/yaml/stats';

// Tablero del MechLab de YAML con el marcado del de MW5 (MechBoard y ComponentCard): las ocho ubicaciones
// alrededor de la ficha del 'Mech. En YAML las armas ocupan ranuras y cada ubicación tiene además sus
// ranuras internas (motor, giroscopio, cabina...), que se cambian desde el inventario, como en el juego.

const ICON_BASE = `${import.meta.env.BASE_URL}mechlab/inventory/`;
const HARDPOINT_LABELS: Record<string, string> = {
  ballistic: 'Ballistic', energy: 'Energy', missile: 'Missile', omni: 'Omni', ams: 'AMS', artillery: 'Artillery'
};
// Las ranuras propias de equipo que no son internas: disipadores del motor, retrorreactores, brazos y piernas.
const SPECIAL_SLOT_LABELS: Record<string, string> = {
  EngineHeatsink_SlotType: 'Engine HS', armslot: 'Arm', legslot: 'Leg', ECM_SlotType: 'ECM',
  JumpJetClass1_SlotType: 'Jump jet', JumpJetClass2_SlotType: 'Jump jet', JumpJetClass3_SlotType: 'Jump jet',
  JumpJetClass4_SlotType: 'Jump jet', JumpJetClass5_SlotType: 'Jump jet'
};
const slotsLabel = (slots: number) => `${slots} ${slots === 1 ? 'slot' : 'slots'}`;

interface YamlBoardProps {
  mech: YamlMech;
  build: YamlBuild;
  target: YamlInventoryTarget | null;
  expandedSlots: boolean;
  compact: boolean;
  fillers: Record<Zone, FillerGroup[]>;
  // Mientras se coloca un objeto (arrastrado o elegido en el inventario): las ubicaciones donde cabe.
  dropZones: Zone[] | null;
  onSelect: (target: YamlInventoryTarget) => void;
  onPlace: (zone: Zone, hardpoint: string | null) => void;
  onArmorChange: (zone: Zone, side: 'front' | 'rear', value: number) => void;
  onRemoveWeapon: (hardpoint: string) => void;
  onRemoveItem: (index: number) => void;
}

// El clic central quita lo montado, como en las tarjetas de MW5.
const removeOnMiddleClick = (onRemove: () => void) => ({
  onMouseDown: (event: MouseEvent) => { if (event.button === 1) event.preventDefault(); },
  onAuxClick: (event: MouseEvent) => {
    if (event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    onRemove();
  }
});

function LocationHardpoints({ mech, build, zone }: { mech: YamlMech; build: YamlBuild; zone: Zone }) {
  return (
    <span className="yaml-location-hardpoints" aria-label="Hardpoints">
      {getHardpointUsage(mech, build, zone).map(usage => (
        <span key={usage.type} className="yaml-location-hardpoint" data-weapon-type={usage.type} title={`${HARDPOINT_LABELS[usage.type]}: ${usage.used} of ${usage.total} used`}>
          <i style={{ '--icon': `url(${ICON_BASE}${usage.type}.png)` } as CSSProperties} aria-hidden="true" />
          {usage.used}/{usage.total}
        </span>
      ))}
    </span>
  );
}

// El color de una fila como en el mechlab del juego: el arma, el de su tipo de ranura; el equipo, el suyo o
// el general; los rellenos, el de la pieza que los pide (motor XL naranja, Endo azul, Ferro rojo).
function rowColor(row: ZoneRow, build: YamlBuild): string | undefined {
  if (row.kind === 'weapon') return getItemColor(row.item);
  if (row.kind === 'item') return getItemColor(build.items[row.index].item, row.slotType);
  if (row.kind === 'fixedFiller' || row.kind === 'dynamicFiller') {
    const owner = build.internal[row.slotType];
    return getYamlItem(owner)?.color ?? getSlotColor(row.slotType);
  }
  return undefined;
}

function rowItemId(row: ZoneRow, build: YamlBuild): string | undefined {
  if (row.kind === 'weapon') return row.item;
  if (row.kind === 'item') return build.items[row.index].item;
  if (row.kind === 'fixedFiller' || row.kind === 'dynamicFiller') return build.internal[row.slotType];
  return undefined;
}

function RowItem({ row, build, inCells = false, onSelect, onRemove }: { row: ZoneRow; build: YamlBuild; inCells?: boolean; onSelect: () => void; onRemove?: () => void }) {
  if (row.kind === 'free') return null;
  const fixed = row.kind === 'fixedFiller' || row.kind === 'dynamicFiller';
  return (
    <button
      type="button"
      className={['component-card-item', inCells ? 'slot-cell-item' : '', fixed ? 'is-built-in yaml-filler' : '', row.kind === 'dynamicFiller' ? 'is-dynamic' : ''].filter(Boolean).join(' ')}
      style={{ '--slots': row.slots, '--item-color': rowColor(row, build) } as CSSProperties}
      data-category={row.kind === 'item' ? 'equipment' : undefined}
      title={fixed ? `${row.label}: ${slotsLabel(row.slots)} the ${row.kind === 'dynamicFiller' ? 'Endo or Ferro takes' : 'engine fixes here'}` : `${row.label}: middle-click to remove`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
      {...(onRemove ? removeOnMiddleClick(onRemove) : {})}
    >
      {fixed ? (
        // Como en el juego: «DYNAMIC FILLER» o «FIXED FILLER» en pequeño y debajo la pieza que lo pide.
        <span className="yaml-filler-text">
          <small>{row.kind === 'dynamicFiller' ? 'Dynamic filler' : 'Fixed filler'} · {slotsLabel(row.slots)}</small>
          <span>{row.label}</span>
        </span>
      ) : (
        <>
          {row.label}
          <small>{row.slots > 1 ? slotsLabel(row.slots) : ''}</small>
        </>
      )}
      <ModLogo id={rowItemId(row, build)} />
    </button>
  );
}

function LocationCard({ zone, label, position, ...props }: YamlBoardProps & { zone: Zone; label: string; position: string }) {
  const { mech, build, target, expandedSlots, fillers, dropZones, onSelect, onPlace, onArmorChange, onRemoveWeapon, onRemoveItem } = props;
  const data = mech.zones[zone];
  const isActive = target?.zone === zone;
  const rows = getZoneRows(mech, build, zone, fillers);
  const free = getFreeGeneralSlots(mech, build, zone) - fillers[zone].reduce((sum, group) => sum + group.slots, 0);
  const used = data.general - free;
  const internals = INTERNAL_SLOTS.filter(slotType => data.special[slotType]);
  // Lo montado en ranuras propias (disipadores del motor, retrorreactores...) va con las internas: no ocupa
  // ranuras generales.
  const isGeneral = (row: ZoneRow) => row.kind !== 'item' || row.slotType === GENERAL_SLOT;
  const specialRows = rows.filter(row => !isGeneral(row));
  const usedHardpoints = new Map(build.weapons.filter(weapon => weapon.zone === zone).map(weapon => [weapon.hardpoint, weapon]));
  const hardpoints = data.hardpoints.filter(hardpoint => hardpoint.type !== 'melee');
  const armor = build.armor[zone];
  const armorTotal = armor.front + armor.rear;
  const placing = dropZones !== null;
  const accepts = !!dropZones?.includes(zone);
  const stateClass = free < 0 ? 'is-over' : free > 0 || hardpoints.some(hardpoint => !usedHardpoints.has(hardpoint.id)) ? 'has-free-space' : 'is-full';
  const select = (hardpoint: string | null = null, internal: string | null = null) => {
    if (placing) onPlace(zone, hardpoint);
    else onSelect({ zone, hardpoint, internal });
  };

  return (
    <div
      className={['component-card', `board-${position}`, stateClass, isActive ? 'is-active' : '', placing ? (accepts ? 'is-drop-target' : 'is-drop-off') : ''].filter(Boolean).join(' ')}
      onClick={() => select()}
      onDragOver={(event) => { if (accepts) event.preventDefault(); }}
      onDrop={(event) => {
        if (!placing) return;
        event.preventDefault();
        onPlace(zone, null);
      }}
    >
      <div className="component-card-header">
        <button type="button" className="component-card-title" aria-pressed={isActive} onClick={(event) => { event.stopPropagation(); select(); }}>
          {label}
        </button>
        <LocationHardpoints mech={mech} build={build} zone={zone} />
      </div>

      {hardpoints.length > 0 && (
        <div className="component-card-hardpoints">
          {hardpoints.map(hardpoint => {
            const mounted = usedHardpoints.get(hardpoint.id);
            const item = mounted && getYamlItem(mounted.item);
            const isSelected = isActive && target?.hardpoint === hardpoint.id;
            return (
              <div
                key={hardpoint.id}
                role="button"
                tabIndex={0}
                className={['hardpoint-chip', item ? 'is-occupied is-emphasized' : 'is-free', isSelected ? 'is-selected' : ''].filter(Boolean).join(' ')}
                data-weapon-type={hardpoint.type}
                style={mounted ? { '--weapon-color': getItemColor(mounted.item) } as CSSProperties : undefined}
                aria-pressed={isSelected}
                title={`${HARDPOINT_LABELS[hardpoint.type]} hardpoint: ${item ? `${item.name}, ${slotsLabel(item.slots)}. Middle-click to remove` : 'free'}`}
                onClick={(event) => { event.stopPropagation(); select(hardpoint.id); }}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); select(hardpoint.id); } }}
                {...(mounted ? removeOnMiddleClick(() => onRemoveWeapon(hardpoint.id)) : {})}
              >
                {!item && <span className="hardpoint-chip-label">{HARDPOINT_LABELS[hardpoint.type]}</span>}
                <span className="hardpoint-chip-content">
                  {item && <span className="hardpoint-chip-name">{item.name}</span>}
                  {item && <span className="hardpoint-chip-tier">{slotsLabel(item.slots)}</span>}
                  {mounted && <ModLogo id={mounted.item} />}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {(internals.length > 0 || specialRows.length > 0) && (
        <div className="yaml-internals" aria-label="Internal slots">
          {internals.map(slotType => (
            <button
              key={slotType}
              type="button"
              className={isActive && target?.internal === slotType ? 'component-card-item yaml-internal is-selected' : 'component-card-item yaml-internal'}
              data-slot={slotType}
              style={{ '--item-color': getYamlItem(build.internal[slotType])?.color ?? getSlotColor(slotType) } as CSSProperties}
              title={`${INTERNAL_SLOT_LABELS[slotType]}: click to change it from the inventory`}
              onClick={(event) => { event.stopPropagation(); if (!placing) onSelect({ zone, hardpoint: null, internal: slotType }); }}
            >
              <small>{INTERNAL_SLOT_LABELS[slotType]}</small>
              <span className="yaml-internal-name">{getInternalLabel(build, slotType)}</span>
              <ModLogo id={build.internal[slotType]} />
            </button>
          ))}
          {specialRows.map((row, index) => row.kind === 'item' && (
            <button
              key={`special-${index}`}
              type="button"
              className="component-card-item yaml-internal"
              data-category="equipment"
              style={{ '--item-color': getItemColor(build.items[row.index].item, row.slotType) } as CSSProperties}
              title={`${row.label}: middle-click to remove`}
              onClick={(event) => { event.stopPropagation(); select(); }}
              {...removeOnMiddleClick(() => onRemoveItem(row.index))}
            >
              <small>{SPECIAL_SLOT_LABELS[row.slotType] ?? 'Special'}</small>
              <span className="yaml-internal-name">{row.label}</span>
              <ModLogo id={build.items[row.index].item} />
            </button>
          ))}
        </div>
      )}

      {data.actuators.length > 0 && (
        <p className="yaml-actuators" title="Actuators">{data.actuators.map(actuator => actuator.replace('Actuator', '')).join(' · ')}</p>
      )}

      {expandedSlots ? (
        <div className="component-card-slots">
          <div className="slot-cells" aria-label={`Slots: ${used} of ${data.general}`}>
            <span className="slot-cells-label">Slots <small>{used}/{data.general}</small></span>
            {rows.filter(row => row.kind !== 'free' && isGeneral(row)).map((row, index) => (
              <RowItem key={index} row={row} build={build} inCells onSelect={() => select()} onRemove={rowRemover(row, onRemoveWeapon, onRemoveItem)} />
            ))}
            {Array.from({ length: Math.max(0, free) }, (_, index) => <span key={`empty-${index}`} className="slot-cell-empty" aria-hidden="true" />)}
          </div>
        </div>
      ) : (
        <>
          {rows.some(row => row.kind !== 'free' && row.kind !== 'weapon' && isGeneral(row)) && (
            <div className="component-card-equipment">
              {rows.filter(row => row.kind !== 'free' && row.kind !== 'weapon' && isGeneral(row)).map((row, index) => (
                <RowItem key={index} row={row} build={build} onSelect={() => select()} onRemove={rowRemover(row, onRemoveWeapon, onRemoveItem)} />
              ))}
            </div>
          )}
          <div className="component-card-footer">
            <SlotBar used={used} capacity={data.general} label="Slots" />
          </div>
        </>
      )}

      <div className={armorTotal < data.maxArmor ? 'component-card-armor is-low' : 'component-card-armor'}>
        <span className="component-card-armor-total" title={`Armor ${armorTotal} / ${data.maxArmor}`}>
          <span className="armor-meter" aria-hidden="true">
            <span style={{ width: `${data.maxArmor > 0 ? (armorTotal / data.maxArmor) * 100 : 0}%` }} />
          </span>
          Armor {armorTotal} / {data.maxArmor}
        </span>
        <span className="component-card-armor-controls">
          <ArmorControl label={`${label} front armor`} shortLabel={data.rear ? 'Front' : 'Armor'} value={armor.front} onChange={(value) => onArmorChange(zone, 'front', value)} />
          {data.rear && <ArmorControl label={`${label} rear armor`} shortLabel="Rear" value={armor.rear} onChange={(value) => onArmorChange(zone, 'rear', value)} />}
        </span>
      </div>
    </div>
  );
}

function rowRemover(row: ZoneRow, onRemoveWeapon: (hardpoint: string) => void, onRemoveItem: (index: number) => void) {
  if (row.kind === 'weapon') return () => onRemoveWeapon(row.hardpoint);
  if (row.kind === 'item') return () => onRemoveItem(row.index);
  return undefined;
}

export function YamlBoard(props: YamlBoardProps) {
  const { mech, build } = props;
  const rating = getEngineRating(build);
  return (
    <section className={['mech-board', props.compact ? 'is-compact' : '', props.dropZones ? 'is-placing' : ''].filter(Boolean).join(' ')} aria-label={`${mech.chassis} ${mech.variant} components`}>
      <div className="mech-board-reference yaml-reference">
        <div className="mech-board-title">
          <h2>{mech.chassis}</h2>
          <span className="variant-tag">{mech.variant}</span>
        </div>
        {/* Donde MW5 pone motor, disipadores y estructura (MechSpecs), con las piezas internas de YAML. */}
        <span className="mech-specs">
          <span className="mech-spec">{rating || 'NO CORE'}</span>
          <span className="mech-spec is-xl">{getInternalLabel(build, 'EngineTypeSlot').toUpperCase()}</span>
          <span className="mech-spec">{getInternalLabel(build, 'Structureslot').toUpperCase()}</span>
          <span className="mech-spec">{getInternalLabel(build, 'Armorslot').toUpperCase()}</span>
          <span className="mech-spec">S {getStructurePoints(mech, build).total}</span>
        </span>
        {!props.compact && mech.quirks.length > 0 && (
          <ul className="yaml-quirks" aria-label="Quirks">
            {mech.quirks.map(id => <li key={id} title={getYamlQuirk(id)?.description}>{getYamlQuirk(id)?.name ?? id}</li>)}
          </ul>
        )}
      </div>
      {ZONES.map(({ zone, label, position }) => <LocationCard key={zone} {...props} zone={zone} label={label} position={position} />)}
    </section>
  );
}
