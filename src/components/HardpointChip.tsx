import type { DragEvent, MouseEvent } from 'react';
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
}

const getHardpointTitle = (view: HardpointView): string => {
  const { hardpoint, weapon, builtInWeapon } = view;
  const weightClass = hardpoint.weightClass ? ` (${hardpoint.weightClass} class)` : '';
  const description = `${getHardpointName(hardpoint)} hardpoint${weightClass}`;
  if (weapon) return `${description}: ${getWeaponLabel(weapon)}`;
  if (builtInWeapon) return `${description}: free, uses the built-in ${builtInWeapon}`;
  return `${description}: free`;
};

export function HardpointChip({ view, isSelected = false, emphasizeWeapon = false, onClick, onContextMenu, drop }: HardpointChipProps) {
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
    if (!drop?.accepts) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event: DragEvent) => {
    if (!drop?.accepts) return;
    event.preventDefault();
    event.stopPropagation();
    drop.onDrop();
  };

  return (
    <button
      type="button"
      className={className}
      data-weapon-type={colorType}
      aria-pressed={isSelected}
      title={getHardpointTitle(view)}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      {...(onContextMenu ? longPress : {})}
    >
      {content}
    </button>
  );
}
