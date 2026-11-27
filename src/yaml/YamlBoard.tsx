import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { ArmorControl } from '../components/ArmorControl';
import { SlotBar } from '../components/SlotBar';
import type { Zone } from '../types/mech';
import type { YamlBuild, YamlMech } from '../types/yaml-mechlab';
import { ZONE_LABELS, ZONES } from '../utils/zones';
import { getActuatorWeapons, getHardpointUsage, getInternalLabel, getZoneRows, INTERNAL_SLOT_LABELS, INTERNAL_SLOTS, type FillerGroup, type ZoneRow } from '../utils/yaml/board';
import { GENERAL_SLOT } from '../utils/yaml/stats';
import { getWeaponTiers } from '../utils/yaml/combat';
import { getItemColor, getSlotColor, getYamlItem, getYamlQuirk, getYamlQuirkColor } from '../utils/yaml/data';
import { ModLogo } from './YamlInventoryPanel';
import type { YamlInventoryTarget } from '../utils/yaml/inventory';
import { getYamlMechDisplayName } from '../utils/yaml/mechList';
import { ACTUATOR_SLOT_TYPES, getActuatorSlots, getActuatorSlotType, getEngineRating, getFreeGeneralSlots, getGeneralSlots, getStructurePoints } from '../utils/yaml/stats';

// Tablero del MechLab de YAML con el marcado del de MW5 (MechBoard y ComponentCard): las ocho ubicaciones
// alrededor de la ficha del 'Mech. En YAML las armas ocupan ranuras y cada ubicación tiene además sus
// ranuras internas (motor, giroscopio, cabina...), que se cambian desde el inventario, como en el juego.

const ICON_BASE = `${import.meta.env.BASE_URL}mechlab/inventory/`;
const HARDPOINT_LABELS: Record<string, string> = {
  ballistic: 'Ballistic', energy: 'Energy', missile: 'Missile', omni: 'Omni', ams: 'AMS', artillery: 'Artillery'
};
// Las ranuras propias de equipo que no son internas: disipadores del motor, retrorreactores, brazos y piernas. El
// segundo núcleo de los superpesados va como equipo en la ranura del motor y lleva su etiqueta de pieza interna.
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
  // La imagen de Sarna, como en el tablero de MW5; no se enseña en el compacto.
  reference?: ReactNode;
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
  if (row.kind === 'weapon' || row.kind === 'splitFiller') return getItemColor(row.item);
  if (row.kind === 'item') return getItemColor(build.items[row.index].item, row.slotType);
  if (row.kind === 'fixedFiller' || row.kind === 'dynamicFiller') {
    const owner = build.internal[row.slotType];
    return getYamlItem(owner)?.color ?? getSlotColor(row.slotType);
  }
  return undefined;
}

function rowItemId(row: ZoneRow, build: YamlBuild): string | undefined {
  if (row.kind === 'weapon' || row.kind === 'splitFiller') return row.item;
  if (row.kind === 'item') return build.items[row.index].item;
  if (row.kind === 'fixedFiller' || row.kind === 'dynamicFiller') return build.internal[row.slotType];
  return undefined;
}

// El nivel del arma con las rayitas del mechlab del juego («▬▬▬▭»): de 1 a 4 llenas; el 5 (Lost Tech) todas
// en dorado y el 0, ninguna.
function TierPips({ id, tier }: { id: string; tier: number }) {
  if (getWeaponTiers(id).length < 2) return null;
  const label = tier === 5 ? 'Lost Tech tier' : `Tier ${tier}`;
  return (
    <span className={tier === 5 ? 'yaml-tier-pips is-legendary' : 'yaml-tier-pips'} role="img" aria-label={label} title={label}>
      {[1, 2, 3, 4].map(pip => <span key={pip} className={pip <= tier ? 'is-filled' : undefined} />)}
    </span>
  );
}

function RowItem({ row, build, inCells = false, isSelected = false, onSelect, onRemove }: {
  row: ZoneRow;
  build: YamlBuild;
  inCells?: boolean;
  isSelected?: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  if (row.kind === 'free') return null;
  const fixed = row.kind === 'fixedFiller' || row.kind === 'dynamicFiller' || row.kind === 'splitFiller';
  const fillerReason = row.kind === 'dynamicFiller' ? 'the Endo or Ferro takes'
    : row.kind === 'splitFiller' ? `the weapon in the ${ZONE_LABELS[row.from].toLowerCase()} takes` : 'the engine fixes here';
  return (
    <button
      type="button"
      className={['component-card-item', inCells ? 'slot-cell-item' : '', fixed ? 'is-built-in yaml-filler' : '', row.kind === 'dynamicFiller' ? 'is-dynamic' : '', isSelected ? 'is-selected' : ''].filter(Boolean).join(' ')}
      style={{ '--slots': row.slots, '--item-color': rowColor(row, build) } as CSSProperties}
      data-category={row.kind === 'item' ? 'equipment' : undefined}
      aria-pressed={row.kind === 'weapon' ? isSelected : undefined}
      title={fixed
        ? `${row.label}: ${slotsLabel(row.slots)} ${fillerReason}`
        : `${row.label}: ${row.kind === 'weapon' ? 'click to swap it from the inventory, ' : ''}middle-click to remove`}
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
          {row.kind === 'weapon' && <TierPips id={row.item} tier={row.tier} />}
          <small>{(row.kind === 'weapon' ? row.totalSlots : row.slots) > 1 ? slotsLabel(row.kind === 'weapon' ? row.totalSlots : row.slots) : ''}</small>
        </>
      )}
      <ModLogo id={rowItemId(row, build)} />
    </button>
  );
}

// YAML pliega por defecto las ranuras que no son generales («Collapse special slots»): cada pieza interna va en
// una línea con su tamaño encima en pequeño. El del motor XL son los rellenos que fija en los torsos
// («6 SLOTS · XL ENGINE»).
function internalSize(build: YamlBuild, slotType: string): number {
  const item = getYamlItem(build.internal[slotType]);
  const fixed = Object.entries(item?.fillerSlots ?? {}).filter(([key]) => key !== 'dynamic').reduce((sum, [, value]) => sum + (value ?? 0), 0);
  return fixed;
}

// Los actuadores con el nombre del mechlab del juego: Shoulder, Upper arm, Lower arm, Hand; Hip, Upper
// leg, Lower leg, Foot.
function actuatorLabel(actuator: string, zone: Zone): string {
  const limb = zone.endsWith('Arm') ? 'arm' : 'leg';
  if (actuator === 'UpperActuator') return `Upper ${limb}`;
  if (actuator === 'LowerActuator') return `Lower ${limb}`;
  return actuator.replace('Actuator', '');
}

// Una ubicación con la lista de ranuras del mechlab del juego, de arriba abajo: en brazos y piernas, los
// actuadores y luego las ranuras generales; en la cabeza y el torso central, las generales y luego las
// internas (cabeza: defensa, sensores, FCS, soporte vital y cabina; torso central: armadura, estructura,
// disipadores del motor, giroscopio, motor y núcleo); en los torsos laterales, solo las generales. Las armas
// van en la lista con sus ranuras, como en el juego, y los anclajes quedan como recuento en la cabecera.
function LocationCard({ zone, label, position, ...props }: YamlBoardProps & { zone: Zone; label: string; position: string }) {
  const { mech, build, target, expandedSlots, fillers, dropZones, onSelect, onPlace, onArmorChange, onRemoveWeapon, onRemoveItem } = props;
  const data = mech.zones[zone];
  const isActive = target?.zone === zone;
  const rows = getZoneRows(mech, build, zone, fillers);
  const free = getFreeGeneralSlots(mech, build, zone) - fillers[zone].reduce((sum, group) => sum + group.slots, 0);
  const generalSlots = getGeneralSlots(mech, build, zone);
  const used = generalSlots - free;
  const internals = INTERNAL_SLOTS.filter(slotType => data.special[slotType]);
  const isGeneral = (row: ZoneRow) => row.kind !== 'item' || row.slotType === GENERAL_SLOT;
  const generalRows = rows.filter(row => row.kind !== 'free' && isGeneral(row));
  // El equipo de actuadores va en las filas de los actuadores que ocupa, no en la lista de piezas propias.
  const isActuatorRow = (row: ZoneRow) => row.kind === 'item' && ACTUATOR_SLOT_TYPES.has(row.slotType);
  const specialRows = rows.filter(row => !isGeneral(row) && !isActuatorRow(row));
  const actuatorRows = rows.filter(isActuatorRow);
  const coveringRow = (actuator: string) => {
    const slotType = getActuatorSlotType(mech, zone, actuator);
    return actuatorRows.find(row => row.kind === 'item' && slotType && (getYamlItem(build.items[row.index].item)?.slotTypes ?? []).includes(slotType));
  };
  const hasFreeHardpoint = getHardpointUsage(mech, build, zone).some(usage => usage.used < usage.total);
  const armor = build.armor[zone];
  const armorTotal = armor.front + armor.rear;
  const placing = dropZones !== null;
  const accepts = !!dropZones?.includes(zone);
  const stateClass = free < 0 ? 'is-over' : free > 0 || hasFreeHardpoint ? 'has-free-space' : 'is-full';
  const select = (hardpoint: string | null = null, internal: string | null = null) => {
    if (placing) onPlace(zone, hardpoint);
    else onSelect({ zone, hardpoint, internal });
  };
  const rowProps = (row: ZoneRow) => ({
    row,
    build,
    isSelected: isActive && row.kind === 'weapon' && target?.hardpoint === row.hardpoint,
    onSelect: () => select(row.kind === 'weapon' ? row.hardpoint : null),
    onRemove: rowRemover(row, onRemoveWeapon, onRemoveItem)
  });

  // Los actuadores y, debajo de la mano, su ataque de cuerpo a cuerpo («Assault Hand»), como en el juego.
  const actuators = data.actuators.length > 0 && (
    <div className="yaml-internals yaml-actuators" aria-label="Actuators">
      {data.actuators.map((actuator, index) => {
        const covering = coveringRow(actuator);
        if (!covering) {
          // Los de los superpesados ocupan dos ranuras: como las demás piezas grandes, con su tamaño al lado y,
          // con las ranuras desplegadas, con el alto de dos celdas, como los dibuja el juego.
          const slots = getActuatorSlots(mech, zone, actuator);
          return (
            <span
              key={actuator}
              className={['component-card-item is-built-in yaml-actuator', expandedSlots ? 'slot-cell-item' : ''].filter(Boolean).join(' ')}
              style={{ '--slots': slots } as CSSProperties}
            >
              {actuatorLabel(actuator, zone)}
              {slots > 1 && <small>{slotsLabel(slots)}</small>}
            </span>
          );
        }
        // Una pieza que ocupa varios actuadores sale una vez, en el primero.
        if (data.actuators.slice(0, index).some(previous => coveringRow(previous) === covering)) return null;
        return <RowItem key={actuator} {...rowProps(covering)} />;
      })}
      {getActuatorWeapons(build, zone).map(weapon => (
        <span
          key={weapon.hardpoint}
          className="component-card-item yaml-actuator yaml-melee"
          data-weapon-type="melee"
          style={{ '--item-color': getItemColor(weapon.item) } as CSSProperties}
          title={`${getYamlItem(weapon.item)?.name}: melee attack of this actuator`}
        >
          {getYamlItem(weapon.item)?.name ?? weapon.item}
        </span>
      ))}
    </div>
  );

  const general = expandedSlots ? (
    <div className="component-card-slots">
      <div className="slot-cells" aria-label={`Slots: ${used} of ${generalSlots}`}>
        <span className="slot-cells-label">Slots <small>{used}/{generalSlots}</small></span>
        {generalRows.map((row, index) => <RowItem key={index} {...rowProps(row)} inCells />)}
        {Array.from({ length: Math.max(0, free) }, (_, index) => <span key={`empty-${index}`} className="slot-cell-empty" aria-hidden="true" />)}
      </div>
    </div>
  ) : (
    <>
      {generalRows.length > 0 && (
        <div className="component-card-equipment yaml-general">
          {generalRows.map((row, index) => <RowItem key={index} {...rowProps(row)} />)}
        </div>
      )}
      <div className="component-card-footer">
        <SlotBar used={used} capacity={generalSlots} label="Slots" />
      </div>
    </>
  );

  const internalSlots = (internals.length > 0 || specialRows.length > 0) && (
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
          <span className="yaml-internal-name">
            {internalSize(build, slotType) > 1 && <em className="yaml-collapsed-size">{slotsLabel(internalSize(build, slotType))}</em>}
            {getInternalLabel(build, slotType)}
          </span>
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
          <small>{SPECIAL_SLOT_LABELS[row.slotType] ?? INTERNAL_SLOT_LABELS[row.slotType] ?? 'Special'}</small>
          <span className="yaml-internal-name">{row.slots > 1 && <em className="yaml-collapsed-size">{slotsLabel(row.slots)}</em>}{row.label}</span>
          <ModLogo id={build.items[row.index].item} />
        </button>
      ))}
    </div>
  );

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

      {actuators}
      {general}
      {internalSlots}

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
          <h2>{getYamlMechDisplayName(mech)}</h2>
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
            {mech.quirks.map(id => (
              <li key={id} title={getYamlQuirk(id)?.description} style={{ '--item-color': getYamlQuirkColor(id) } as CSSProperties}>
                {getYamlQuirk(id)?.name ?? id}
              </li>
            ))}
          </ul>
        )}
        {!props.compact && props.reference && <div className="mech-board-image">{props.reference}</div>}
      </div>
      {ZONES.map(({ zone, label, position }) => <LocationCard key={zone} {...props} zone={zone} label={label} position={position} />)}
    </section>
  );
}
