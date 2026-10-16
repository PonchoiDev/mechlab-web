interface UtilityToolbarProps {
  canClearArmor: boolean;
  canMaximizeArmor: boolean;
  hasWeapons: boolean;
  hasAmmo: boolean;
  onClearArmor: () => void;
  onMaximizeArmor: () => void;
  onRemoveItems: (type: 'weapon' | 'ammo') => void;
}

export function UtilityToolbar({
  canClearArmor,
  canMaximizeArmor,
  hasWeapons,
  hasAmmo,
  onClearArmor,
  onMaximizeArmor,
  onRemoveItems
}: UtilityToolbarProps) {
  return (
    <nav className="utility-toolbar" aria-label="Loadout utilities">
      <div className="utility-group">
        <span className="utility-label">ARMOR</span>
        <button type="button" className="utility-button" onClick={onClearArmor} disabled={!canClearArmor}>
          Clear armor
        </button>
        <button
          type="button"
          className="utility-button utility-button-primary"
          onClick={onMaximizeArmor}
          disabled={!canMaximizeArmor}
        >
          Max armor
        </button>
      </div>
      <div className="utility-group">
        <span className="utility-label">LOADOUT</span>
        <button type="button" className="utility-button" onClick={() => onRemoveItems('weapon')} disabled={!hasWeapons}>
          Remove weapons
        </button>
        <button type="button" className="utility-button" onClick={() => onRemoveItems('ammo')} disabled={!hasAmmo}>
          Remove ammo
        </button>
      </div>
    </nav>
  );
}
