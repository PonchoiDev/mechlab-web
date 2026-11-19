import type { CSSProperties, DragEvent, KeyboardEvent, MouseEvent } from 'react';
import type { Zone } from '../../types/mech';
import type { BtArmorSide, BtBuild, BtItem } from '../../types/battletech-mechlab';
import { SlotBar } from '../../components/SlotBar';
import { useLongPress } from '../../hooks/useLongPress';
import { getMenuPosition } from '../../utils/menuPosition';
import { ZONES } from '../../utils/zones';
import { getArmorLimit } from '../../utils/battletech/armor';
import type { BtDropTarget, BtDropTargets } from '../../utils/battletech/inventory';
import { getFixedItems, getHardpointViews, getLocationUsage, groupZoneEquipment, type EquipmentGroup, type HardpointView } from '../../utils/battletech/fitting';
import { getEquipmentCategory, getItem, getItemWeaponType, HARDPOINT_LABELS, HARDPOINTS, SOURCE_LABELS, WEIGHT_CLASS_LABELS } from '../../utils/battletech/mechlabData';
import { BtArmorControl } from './BtArmorControl';
import { MechIcon } from './MechIcon';

interface BtBoardProps {
  build: BtBuild;
  activeZone: Zone | null;
  selectedHardpoint: number | null;
  // Con el índice de un anclaje, el panel se abre con él elegido (como al pulsar un anclaje en MW5).
  onSelectZone: (zone: Zone, hardpointIndex: number | null) => void;
  onArmorChange: (zone: Zone, side: BtArmorSide, value: number) => void;
  onArmorStep: (zone: Zone, side: BtArmorSide, steps: number) => void;
  onHardpointMenu: (zone: Zone, hardpointIndex: number, x: number, y: number) => void;
  onEquipmentMenu: (zone: Zone, itemId: string, x: number, y: number) => void;
  // Vista de MW5: ranuras como celdas (Show slot cells) y tablero compacto, sin la imagen.
  expandedSlots: boolean;
  compact: boolean;
  // Destinos del objeto que se está colocando desde el inventario o arrastrando desde el tablero, si hay uno.
  dropTargets?: BtDropTargets | null;
  onPlace?: (zone: Zone, hardpointIndex: number | null) => void;
  // Arrastrar lo montado (a otro sitio, o fuera del tablero para desequiparlo) y quitarlo con el clic central,
  // por su posición en el loadout de la ubicación.
  onDragItem?: (zone: Zone, index: number) => void;
  onDragEnd?: () => void;
  onRemoveItem?: (zone: Zone, index: number) => void;
}

interface MountedHandlers {
  onDrag?: () => void;
  onDragEnd?: () => void;
  onRemove?: () => void;
}

// Lo montado se arrastra y se quita con el clic central, como en las tarjetas de MW5. Las piezas son divs y no
// botones porque Firefox no deja arrastrar botones; Enter las pulsa como a un botón.
const mountedProps = ({ onDrag, onDragEnd, onRemove }: MountedHandlers, name: string, onActivate: () => void) => ({
  role: 'button',
  tabIndex: 0,
  onKeyDown: (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  },
  ...(onDrag ? {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.stopPropagation();
      event.dataTransfer.setData('text/plain', name);
      event.dataTransfer.effectAllowed = 'move';
      onDrag();
    },
    onDragEnd
  } : {}),
  // El botón central se suelta en auxclick; en mousedown se evita el desplazamiento automático.
  ...(onRemove ? {
    onMouseDown: (event: MouseEvent) => { if (event.button === 1) event.preventDefault(); },
    onAuxClick: (event: MouseEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      onRemove();
    }
  } : {})
});

// Clic derecho o pulsación larga: abre el menú de la pieza, como en las tarjetas de MW5.
const openMenu = (event: MouseEvent, onMenu: (x: number, y: number) => void) => {
  event.preventDefault();
  event.stopPropagation();
  const { x, y } = getMenuPosition(event);
  onMenu(x, y);
};

function CardHardpoint({ view, isSelected, onSelect, onMenu, drop, handlers }: {
  view: HardpointView;
  isSelected: boolean;
  onSelect: () => void;
  onMenu: (x: number, y: number) => void;
  // Mientras se coloca un objeto: si este anclaje lo admite (ocupado, como reemplazo).
  drop?: { accepts: boolean; onDrop: () => void };
  handlers: MountedHandlers;
}) {
  const longPress = useLongPress(onMenu);
  const dropClass = drop ? (drop.accepts ? (view.item ? 'is-drop-target is-drop-replace' : 'is-drop-target') : 'is-drop-off') : '';
  return (
    <div
      {...mountedProps(view.item ? handlers : {}, view.item?.name ?? '', onSelect)}
      className={['hardpoint-chip', view.item ? 'is-occupied is-emphasized' : 'is-free', view.isOver ? 'is-over' : '', isSelected ? 'is-selected' : '', dropClass].filter(Boolean).join(' ')}
      data-weapon-type={view.type}
      aria-pressed={isSelected}
      title={`${HARDPOINT_LABELS[view.type]} hardpoint: ${view.item ? `${view.item.name}. Right-click for options, drag it elsewhere or off the board, middle-click to remove` : 'free. Right-click for options'}`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
      onContextMenu={(event) => openMenu(event, onMenu)}
      // Un anclaje que no admite el objeto no recoge el arrastre: lo recoge su tarjeta.
      onDragOver={(event) => { if (drop?.accepts) event.preventDefault(); }}
      onDrop={(event) => {
        if (!drop?.accepts) return;
        event.preventDefault();
        event.stopPropagation();
        drop.onDrop();
      }}
      {...longPress}
    >
      {!view.item && <span className="hardpoint-chip-label">{HARDPOINT_LABELS[view.type]}</span>}
      <span className="hardpoint-chip-content">
        {/* Como en MW5, un anclaje vacío solo dice su tipo: que está libre ya lo dicen los avisos. */}
        {view.item && <span className="hardpoint-chip-name">{view.item.name}</span>}
        {view.item && <span className="hardpoint-chip-tier">{view.item.bonuses.length > 0 ? view.item.bonuses.join(' ') : `${view.item.slots} sl`}</span>}
      </span>
    </div>
  );
}

// Sobre cada ubicación, como en la pantalla de reequipar del juego: anclajes usados y totales de cada tipo
// con su icono («2/2» y el balístico); un tipo que la ubicación no tiene sale como «0», apagado.
const HARDPOINT_ICON_PATH = `${import.meta.env.BASE_URL}mechlab/icons/hardpoints/`;
// En el orden del juego: balístico primero.
const HARDPOINT_ORDER = ['ballistic', 'energy', 'missile', 'support'] as const;

function LocationHardpoints({ usage }: { usage: ReturnType<typeof getLocationUsage> }) {
  return (
    <div className="bt-location-hardpoints" aria-label="Hardpoints">
      {HARDPOINT_ORDER.map(type => {
        const { used, capacity } = usage.hardpoints[type];
        return (
          <span
            key={type}
            className={capacity > 0 ? 'bt-location-hardpoint' : 'bt-location-hardpoint is-none'}
            data-weapon-type={type}
            title={`${HARDPOINT_LABELS[type]}: ${capacity > 0 ? `${used} of ${capacity} used` : 'none'}`}
          >
            {capacity > 0 ? `${used}/${capacity}` : '0'}
            <i style={{ '--icon': `url(${HARDPOINT_ICON_PATH}${type}.svg)` } as CSSProperties} aria-hidden="true" />
          </span>
        );
      })}
    </div>
  );
}

// El equipo fijo del chasis no tiene menú: no se puede mover ni quitar.
function CardEquipment({ group, onSelect, onMenu, handlers }: { group: EquipmentGroup; onSelect: () => void; onMenu: (x: number, y: number) => void; handlers: MountedHandlers }) {
  const longPress = useLongPress(onMenu);
  return (
    <div
      {...mountedProps(group.fixed ? {} : handlers, group.item.name, onSelect)}
      className={group.fixed ? 'component-card-item is-built-in' : 'component-card-item'}
      data-category={getEquipmentCategory(group.item)}
      data-weapon-type={group.item.kind === 'ammo' ? getItemWeaponType(group.item) : undefined}
      title={group.fixed ? `${group.item.name}${group.item.bonuses.length > 0 ? ` (${group.item.bonuses.join(', ')})` : ''}: built into this chassis, cannot be removed` : `${group.item.name}: right-click for options`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
      onContextMenu={group.fixed ? (event) => event.preventDefault() : (event) => openMenu(event, onMenu)}
      {...(group.fixed ? {} : longPress)}
    >
      {group.item.name}
      {group.count > 1 && <small>×{group.count}</small>}
      {group.item.bonuses.length > 0 && <small className="bt-item-bonus">{group.item.bonuses.join(' ')}</small>}
      {group.fixed && <small>built-in</small>}
    </div>
  );
}

// Tarjeta de una ubicación con el marcado del MechLab de MW5 (ComponentCard): anclajes con su arma,
// equipo agrupado, barra de ranuras y blindaje. En BATTLETECH las armas también ocupan ranuras, y el
// blindaje delantero y el trasero tienen cada uno su máximo.
// Show slot cells de MW5: cada ranura es una celda y cada pieza ocupa las suyas. En BATTLETECH las armas
// también ocupan ranuras, así que salen aquí además de en su anclaje.
function SlotCells({ mech, loadout, zone, capacity, onSelect, onMenu, onHardpointMenu, handlersFor }: {
  mech: BtBuild['mech'];
  loadout: BtBuild['loadout'];
  zone: Zone;
  capacity: number;
  onSelect: () => void;
  onMenu: (itemId: string, x: number, y: number) => void;
  onHardpointMenu: (hardpointIndex: number, x: number, y: number) => void;
  handlersFor: (index: number) => MountedHandlers;
}) {
  const fixed = getFixedItems(mech, zone);
  const hardpoints = getHardpointViews(mech, loadout, zone);
  const mounted = loadout[zone].map(id => getItem(id)).filter((item): item is BtItem => item !== undefined);
  const used = [...fixed, ...mounted].reduce((total, item) => total + item.slots, 0);
  return (
    <div className="slot-cells" aria-label={`Slots: ${used} of ${capacity}`}>
      <span className="slot-cells-label">Slots <small>{used}/{capacity}</small></span>
      {fixed.map((item, index) => (
        <CellItem key={`fixed-${index}`} item={item} fixed onSelect={onSelect} onMenu={() => undefined} />
      ))}
      {loadout[zone].map((id, index) => {
        const item = getItem(id);
        if (!item) return null;
        const hardpointIndex = hardpoints.findIndex(view => view.index === index);
        return (
          <CellItem
            key={`${id}-${index}`}
            item={item}
            onSelect={onSelect}
            onMenu={(x, y) => hardpointIndex >= 0 ? onHardpointMenu(hardpointIndex, x, y) : onMenu(id, x, y)}
            handlers={handlersFor(index)}
          />
        );
      })}
      {Array.from({ length: Math.max(0, capacity - used) }, (_, index) => <span key={`empty-${index}`} className="slot-cell-empty" aria-hidden="true" />)}
    </div>
  );
}

function CellItem({ item, fixed = false, onSelect, onMenu, handlers = {} }: { item: BtItem; fixed?: boolean; onSelect: () => void; onMenu: (x: number, y: number) => void; handlers?: MountedHandlers }) {
  const longPress = useLongPress(onMenu);
  return (
    <div
      {...mountedProps(fixed ? {} : handlers, item.name, onSelect)}
      className={fixed ? 'component-card-item slot-cell-item is-built-in' : 'component-card-item slot-cell-item'}
      style={{ '--slots': Math.max(1, item.slots) } as CSSProperties}
      data-category={item.kind === 'weapon' ? undefined : getEquipmentCategory(item)}
      data-weapon-type={getItemWeaponType(item)}
      title={fixed ? `${item.name}${item.bonuses.length > 0 ? ` (${item.bonuses.join(', ')})` : ''}: built into this chassis, cannot be removed` : `${item.name}: right-click for options`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
      onContextMenu={fixed ? (event) => event.preventDefault() : (event) => openMenu(event, onMenu)}
      {...(fixed ? {} : longPress)}
    >
      {item.name}
      {item.bonuses.length > 0 && <small className="bt-item-bonus">{item.bonuses.join(' ')}</small>}
      {fixed && <small>built-in</small>}
    </div>
  );
}

function LocationCard({ build, zone, label, position, isActive, selectedHardpoint, onSelectZone, onArmorChange, onArmorStep, onHardpointMenu, onEquipmentMenu, expandedSlots, placement, onDragItem, onDragEnd, onRemoveItem }: Omit<BtBoardProps, 'activeZone' | 'dropTargets' | 'onPlace'> & {
  zone: Zone;
  label: string;
  position: string;
  isActive: boolean;
  // Mientras se coloca un objeto: dónde admite soltarlo esta ubicación. Pulsar la tarjeta o un anclaje coloca
  // el objeto en vez de elegir la ubicación.
  placement?: { target: BtDropTarget; onPlace: (hardpointIndex: number | null) => void };
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
  const select = (hardpointIndex: number | null = null) => placement ? placement.onPlace(hardpointIndex) : onSelectZone(zone, hardpointIndex);
  const handlersFor = (index: number): MountedHandlers => ({
    onDrag: onDragItem && (() => onDragItem(zone, index)),
    onDragEnd,
    onRemove: onRemoveItem && (() => onRemoveItem(zone, index))
  });
  const dropClass = !placement ? '' : placement.target.component || placement.target.hardpoints.length > 0 ? 'is-drop-target' : 'is-drop-off';

  return (
    <div
      className={['component-card', `board-${position}`, stateClass, isActive ? 'is-active' : '', dropClass].filter(Boolean).join(' ')}
      onClick={() => select()}
      onDragOver={(event) => { if (placement?.target.component) event.preventDefault(); }}
      // Al mover algo ya montado, toda la página admite soltar (fuera del tablero se desequipa): aquí llega también
      // lo que se suelta en una tarjeta que no lo admite, y no se desequipa, sino que avisa del motivo.
      onDrop={(event) => {
        if (!placement) return;
        event.preventDefault();
        event.stopPropagation();
        placement.onPlace(null);
      }}
    >
      <div className="component-card-header">
        <button type="button" className="component-card-title" aria-pressed={isActive} onClick={(event) => { event.stopPropagation(); select(); }}>
          {label}
        </button>
        <span className="bt-card-header-end">
          {/* La estructura de la ubicación, como «S 70/70» en la pantalla de reequipar del juego. */}
          <span className="bt-structure" title="Internal structure">S {location.structure}/{location.structure}</span>
        </span>
      </div>

      <LocationHardpoints usage={usage} />

      {hardpoints.length > 0 && (
        <div className="component-card-hardpoints">
          {hardpoints.map((view, index) => (
            <CardHardpoint
              key={index}
              view={view}
              isSelected={isActive && selectedHardpoint === index}
              onSelect={() => select(index)}
              onMenu={(x, y) => onHardpointMenu(zone, index, x, y)}
              drop={placement && { accepts: placement.target.hardpoints.includes(index), onDrop: () => placement.onPlace(index) }}
              handlers={view.index !== null ? handlersFor(view.index) : {}}
            />
          ))}
        </div>
      )}

      {expandedSlots ? (
        <div className="component-card-slots">
          <SlotCells
            mech={mech}
            loadout={loadout}
            zone={zone}
            capacity={usage.slots.capacity}
            onSelect={() => select()}
            onMenu={(itemId, x, y) => onEquipmentMenu(zone, itemId, x, y)}
            onHardpointMenu={(index, x, y) => onHardpointMenu(zone, index, x, y)}
            handlersFor={handlersFor}
          />
        </div>
      ) : (
        <>
          {equipment.length > 0 && (
            <div className="component-card-equipment">
              {equipment.map(group => (
                <CardEquipment
                  key={`${group.fixed ? 'fixed' : 'item'}-${group.item.id}`}
                  group={group}
                  onSelect={() => select()}
                  onMenu={(x, y) => onEquipmentMenu(zone, group.item.id, x, y)}
                  // De un grupo (Heat Sink ×2) se arrastra o se quita la última copia montada.
                  handlers={group.indices.length > 0 ? handlersFor(group.indices[group.indices.length - 1]) : {}}
                />
              ))}
            </div>
          )}

          <div className="component-card-footer">
            <SlotBar used={usage.slots.used} capacity={usage.slots.capacity} label="Slots" />
          </div>
        </>
      )}

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
    <section className={['mech-board', props.compact ? 'is-compact' : '', props.dropTargets ? 'is-placing' : ''].filter(Boolean).join(' ')} aria-label={`${mech.name} ${mech.variant} components`}>
      <div className="mech-board-reference bt-reference">
        <div className="mech-board-title">
          <h2>{mech.name}</h2>
          <span className="variant-tag">{mech.variant}</span>
        </div>
        {/* Donde MW5 pone motor, disipadores y estructura (MechSpecs), BATTLETECH pone tonelaje, clase,
            rol y fuente: su motor y su estructura van dentro del chasis y no se cambian. */}
        <span className="mech-specs">
          <span className="mech-spec">{mech.tonnage} T</span>
          <span className="mech-spec">{WEIGHT_CLASS_LABELS[mech.weightClass].toUpperCase()}</span>
          {mech.source !== 'base' && <span className="mech-spec is-xl">{SOURCE_LABELS[mech.source].toUpperCase()}</span>}
        </span>
        {mech.role && (
          <p className="bt-stock-role" title="Stock combat role of the chassis, from the game">
            STOCK COMBAT ROLE <strong>{mech.role}</strong>
          </p>
        )}
        {!props.compact && (
          <div className="mech-board-image">
            <MechIcon mech={mech} size={128} />
            {mech.tags.length > 0 && (
              <ul className="bt-tags" aria-label="Role tags">
                {mech.tags.map(tag => <li key={tag}>{tag}</li>)}
              </ul>
            )}
            <p className="bt-reference-description">{mech.description}</p>
          </div>
        )}
      </div>
      {ZONES.map(({ zone, label, position }) => (
        <LocationCard
          key={zone}
          {...props}
          zone={zone}
          label={label}
          position={position}
          isActive={props.activeZone === zone}
          placement={props.dropTargets && props.onPlace
            ? { target: props.dropTargets[zone], onPlace: (index) => props.onPlace!(zone, index) }
            : undefined}
        />
      ))}
    </section>
  );
}
