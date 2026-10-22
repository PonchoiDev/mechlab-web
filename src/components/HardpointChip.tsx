import type { MouseEvent } from 'react';
import { useLongPress } from '../hooks/useLongPress';
import { getMenuPosition } from '../utils/menuPosition';
import { getHardpointName, type HardpointView } from '../utils/equipment';
import { getTierName } from '../utils/items';

interface HardpointChipProps {
  view: HardpointView;
  isSelected?: boolean;
  // Con un arma montada, muestra solo el arma (el anclaje queda en el tooltip).
  emphasizeWeapon?: boolean;
  onClick?: () => void;
  onContextMenu?: (x: number, y: number) => void;
}

const getHardpointTitle = (view: HardpointView): string => {
  const { hardpoint, weapon, builtInWeapon } = view;
  const weightClass = hardpoint.weightClass ? ` (${hardpoint.weightClass} class)` : '';
  const description = `${getHardpointName(hardpoint)} hardpoint${weightClass}`;
  if (weapon) return `${description}: ${weapon.name}`;
  if (builtInWeapon) return `${description}: free, uses the built-in ${builtInWeapon}`;
  return `${description}: free`;
};

export function HardpointChip({ view, isSelected = false, emphasizeWeapon = false, onClick, onContextMenu }: HardpointChipProps) {
  const longPress = useLongPress((x, y) => onContextMenu?.(x, y));
  const { hardpoint, weapon, builtInWeapon } = view;
  const tierName = weapon ? getTierName(weapon) : null;
  const className = [
    'hardpoint-chip',
    weapon ? 'is-occupied' : builtInWeapon ? 'is-built-in' : 'is-free',
    weapon && emphasizeWeapon ? 'is-emphasized' : '',
    isSelected ? 'is-selected' : ''
  ].filter(Boolean).join(' ');
  const content = (
    <>
      {!(weapon && emphasizeWeapon) && <span className="hardpoint-chip-label">{getHardpointName(hardpoint)}</span>}
      <span className="hardpoint-chip-content">
        <span className="hardpoint-chip-name">{weapon?.name ?? builtInWeapon ?? 'Free'}</span>
        {tierName && <span className="hardpoint-chip-tier">{tierName}</span>}
      </span>
    </>
  );

  if (!onClick) {
    return <span className={className} data-weapon-type={hardpoint.type} title={getHardpointTitle(view)}>{content}</span>;
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

  return (
    <button
      type="button"
      className={className}
      data-weapon-type={hardpoint.type}
      aria-pressed={isSelected}
      title={getHardpointTitle(view)}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      {...(onContextMenu ? longPress : {})}
    >
      {content}
    </button>
  );
}
