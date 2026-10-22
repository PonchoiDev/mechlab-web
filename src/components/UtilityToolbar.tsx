interface UtilityToolbarProps {
  canClearArmor: boolean;
  canMaximizeArmor: boolean;
  hasWeapons: boolean;
  hasAmmo: boolean;
  onClearArmor: () => void;
  onMaximizeArmor: () => void;
  onRemoveItems: (type: 'weapon' | 'ammo') => void;
  savedBuildCount: number;
  onSaveBuild: () => void;
  onOpenBuilds: () => void;
  onShare: (anchor: DOMRect) => void;
}

export function UtilityToolbar({
  canClearArmor,
  canMaximizeArmor,
  hasWeapons,
  hasAmmo,
  onClearArmor,
  onMaximizeArmor,
  onRemoveItems,
  savedBuildCount,
  onSaveBuild,
  onOpenBuilds,
  onShare
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
      <div className="utility-group">
        <span className="utility-label">BUILD</span>
        <button type="button" className="utility-button" aria-haspopup="dialog" onClick={onSaveBuild}>
          Save build
        </button>
        <button type="button" className="utility-button" aria-haspopup="dialog" onClick={onOpenBuilds}>
          My builds{savedBuildCount > 0 && <span className="utility-count">{savedBuildCount}</span>}
        </button>
        <button
          type="button"
          className="utility-button utility-button-primary"
          aria-haspopup="menu"
          onClick={(event) => onShare(event.currentTarget.getBoundingClientRect())}
        >
          Share ▾
        </button>
      </div>
    </nav>
  );
}
