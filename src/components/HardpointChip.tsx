import type { DragEvent, KeyboardEvent, MouseEvent } from 'react';
import { useLongPress } from '../hooks/useLongPress';
import { getMenuPosition } from '../utils/menuPosition';
import { getHardpointName, type HardpointView } from '../utils/equipment';
import { getItemWeaponType, getTierName, getWeaponLabel } from '../utils/items';

interface HardpointChipProps {
  view: HardpointView;
  isSelected?: boolean;
  // Con un arma montada, muestra solo el arma (el anclaje queda en el tooltip).
  emphasizeWeapon?: boolean;
  onClick?: () => void;
  onContextMenu?: (x: number, y: number) => void;
  // Mientras se coloca un objeto del inventario: si este anclaje lo admite (ocupado, como reemplazo) y qué
  // hacer al soltarlo encima.
  drop?: { accepts: boolean; onDrop: () => void };
  // En el tablero, el arma montada se arrastra a otro sitio (o fuera, para desequiparla) y el clic central la quita.
  onDragWeapon?: () => void;
  onDragEnd?: () => void;
  onRemoveWeapon?: () => void;
}

const getHardpointTitle = (view: HardpointView): string => {
  const { hardpoint, weapon, builtInWeapon } = view;
  const weightClass = hardpoint.weightClass ? ` (${hardpoint.weightClass} class)` : '';
  const description = `${getHardpointName(hardpoint)} hardpoint${weightClass}`;
  if (weapon) return `${description}: ${getWeaponLabel(weapon)}`;
  if (builtInWeapon) return `${description}: free, uses the built-in ${builtInWeapon}`;
  return `${description}: free`;
};

export function HardpointChip({
  view,
  isSelected = false,
  emphasizeWeapon = false,
  onClick,
  onContextMenu,
  drop,
  onDragWeapon,
  onDragEnd,
  onRemoveWeapon
}: HardpointChipProps) {
  const longPress = useLongPress((x, y) => onContextMenu?.(x, y));
  const { hardpoint, weapon, builtInWeapon } = view;
  const tierName = weapon ? getTierName(weapon) : null;
  // Un anclaje omni con arma toma el color del arma; vacío, el suyo propio.
  const colorType = (weapon && getItemWeaponType(weapon)) || hardpoint.type;
  const className = [
    'hardpoint-chip',
    weapon ? 'is-occupied' : builtInWeapon ? 'is-built-in' : 'is-free',
    weapon && emphasizeWeapon ? 'is-emphasized' : '',
    isSelected ? 'is-selected' : '',
    drop ? (drop.accepts ? (weapon ? 'is-drop-target is-drop-replace' : 'is-drop-target') : 'is-drop-off') : ''
  ].filter(Boolean).join(' ');
  const content = (
    <>
      {!(weapon && emphasizeWeapon) && <span className="hardpoint-chip-label">{getHardpointName(hardpoint)}</span>}
      <span className="hardpoint-chip-content">
        {/* Un anclaje vacío solo dice su tipo y tamaño: que está libre ya lo dicen los avisos y su aspecto. */}
        {(weapon || builtInWeapon) && <span className="hardpoint-chip-name">{weapon?.name ?? builtInWeapon}</span>}
        {tierName && <span className="hardpoint-chip-tier">{tierName}</span>}
      </span>
    </>
  );

  if (!onClick) {
    return <span className={className} data-weapon-type={colorType} title={getHardpointTitle(view)}>{content}</span>;
  }

  const handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    onClick();
  };

  const handleContextMenu = (event: MouseEvent) => {
    if (!onContextMenu) return;
    event.preventDefault();
    event.stopPropagation();
    const { x, y } = getMenuPosition(event);
    onContextMenu(x, y);
  };

  // Un anclaje que no admite el objeto no recoge el arrastre: lo recoge su tarjeta, que lo pone en otro libre.
  const handleDragOver = (event: DragEvent) => {
    if (drop?.accepts) event.preventDefault();
  };

  const handleDrop = (event: DragEvent) => {
    if (!drop?.accepts) return;
    event.preventDefault();
    event.stopPropagation();
    drop.onDrop();
  };

  const props = {
    className,
    'data-weapon-type': colorType,
    'aria-pressed': isSelected,
    title: getHardpointTitle(view),
    onClick: handleClick,
    onContextMenu: handleContextMenu,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    ...(onContextMenu ? longPress : {})
  };

  // Con un arma que se puede arrastrar es un div: Firefox no deja arrastrar botones.
  if (weapon && onDragWeapon) {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      onClick();
    };
    return (
      <div
        {...props}
        role="button"
        tabIndex={0}
        draggable
        title={`${getHardpointTitle(view)}. Drag it elsewhere, or off the board to remove it. Middle-click removes it`}
        onKeyDown={handleKeyDown}
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.setData('text/plain', weapon.name);
          event.dataTransfer.effectAllowed = 'move';
          onDragWeapon();
        }}
        onDragEnd={onDragEnd}
        // El botón central se suelta en auxclick; en mousedown se evita el desplazamiento automático.
        onMouseDown={(event) => { if (event.button === 1) event.preventDefault(); }}
        onAuxClick={(event) => {
          if (event.button !== 1 || !onRemoveWeapon) return;
          event.preventDefault();
          event.stopPropagation();
          onRemoveWeapon();
        }}
      >
        {content}
      </div>
    );
  }

  return <button type="button" {...props}>{content}</button>;
}
