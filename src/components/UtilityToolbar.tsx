interface UtilityToolbarProps {
  canClearArmor: boolean;
  canMaximizeArmor: boolean;
  hasWeapons: boolean;
  hasAmmo: boolean;
  hasEquipment: boolean;
  onClearArmor: () => void;
  onMaximizeArmor: () => void;
  onRemoveItems: (type: 'weapon' | 'ammo' | 'equipment') => void;
  canLoadStock: boolean;
  onLoadStock: () => void;
  upgradeSlots: { used: number; capacity: number };
  isUpgradesOpen: boolean;
  onToggleUpgrades: () => void;
  isCompareOpen: boolean;
  onToggleCompare: () => void;
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
  hasEquipment,
  onClearArmor,
  onMaximizeArmor,
  onRemoveItems,
  canLoadStock,
  onLoadStock,
  upgradeSlots,
  isUpgradesOpen,
  onToggleUpgrades,
  isCompareOpen,
  onToggleCompare,
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
        <button
          type="button"
          className="utility-button"
          onClick={onLoadStock}
          disabled={!canLoadStock}
          title="Load the factory loadout of this variant"
        >
          Stock loadout
        </button>
        <button type="button" className="utility-button" onClick={() => onRemoveItems('weapon')} disabled={!hasWeapons}>
          Remove weapons
        </button>
        <button type="button" className="utility-button" onClick={() => onRemoveItems('ammo')} disabled={!hasAmmo}>
          Remove ammo
        </button>
        <button
          type="button"
          className="utility-button"
          onClick={() => onRemoveItems('equipment')}
          disabled={!hasEquipment}
          title="Remove heat sinks, jump jets and the rest of the equipment"
        >
          Remove equipment
        </button>
      </div>
      <div className="utility-group">
        <span className="utility-label">CANTINA</span>
        <button
          type="button"
          className="utility-button"
          aria-expanded={isUpgradesOpen}
          title="Cantina upgrades installed on this 'Mech"
          onClick={onToggleUpgrades}
        >
          Upgrades{upgradeSlots.used > 0 && <span className="utility-count">{upgradeSlots.used}/{upgradeSlots.capacity}</span>}
        </button>
      </div>
      <div className="utility-group">
        <span className="utility-label">BUILD</span>
        <button
          type="button"
          className="utility-button"
          aria-expanded={isCompareOpen}
          title="Compare this build with the stock loadout of another 'Mech"
          onClick={onToggleCompare}
        >
          Compare
        </button>
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
