import type { MouseEvent } from 'react';
import type { HardpointView } from '../utils/equipment';
import { getSizeName, getTierName, getWeaponTypeName } from '../utils/items';

interface HardpointChipProps {
  view: HardpointView;
  isSelected?: boolean;
  // Con un arma montada, muestra solo el arma (el anclaje queda en el tooltip).
  emphasizeWeapon?: boolean;
  onClick?: () => void;
}

const getHardpointName = ({ hardpoint }: HardpointView): string =>
  `${getWeaponTypeName(hardpoint.type)} · ${getSizeName(hardpoint.size)}`;

const getHardpointTitle = (view: HardpointView): string => {
  const { hardpoint, weapon, builtInWeapon } = view;
  const weightClass = hardpoint.weightClass ? ` (${hardpoint.weightClass} class)` : '';
  const description = `${getHardpointName(view)} hardpoint${weightClass}`;
  if (weapon) return `${description}: ${weapon.name}`;
  if (builtInWeapon) return `${description}: free, uses the built-in ${builtInWeapon}`;
  return `${description}: free`;
};

export function HardpointChip({ view, isSelected = false, emphasizeWeapon = false, onClick }: HardpointChipProps) {
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
      {!(weapon && emphasizeWeapon) && <span className="hardpoint-chip-label">{getHardpointName(view)}</span>}
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

  return (
    <button
      type="button"
      className={className}
      data-weapon-type={hardpoint.type}
      aria-pressed={isSelected}
      title={getHardpointTitle(view)}
      onClick={handleClick}
    >
      {content}
    </button>
  );
}
