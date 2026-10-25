import type { Mech } from '../types/mech';
import type { Upgrade } from '../types/upgrade';
import { canInstallUpgrade, getUsedUpgradeSlots, UPGRADE_CATEGORIES, UPGRADES } from '../utils/upgrades';

interface UpgradesPanelProps {
  mech: Mech;
  installed: Upgrade[];
  onToggle: (upgrade: Upgrade) => void;
  onClear: () => void;
  onClose: () => void;
}

// Mejoras de la cantina, como la pantalla Mejoras del juego: cada una se instala una vez y ocupa
// 1 o 2 de las ranuras de mejora del mech.
export function UpgradesPanel({ mech, installed, onToggle, onClear, onClose }: UpgradesPanelProps) {
  const capacity = mech.upgradeSlots ?? 0;
  const used = getUsedUpgradeSlots(installed);
  const installedIds = new Set(installed.map(upgrade => upgrade.id));

  return (
    <section className="upgrades-panel" aria-label="Cantina upgrades">
      <header className="upgrades-header">
        <h2>CANTINA UPGRADES</h2>
        <span className="upgrades-meter" aria-label={`${used} of ${capacity} upgrade slots used`}>
          {Array.from({ length: capacity }, (_, index) => (
            <span key={index} className={index < used ? 'is-used' : ''} aria-hidden="true" />
          ))}
          <small>{used}/{capacity} slots</small>
        </span>
        <p className="upgrades-hint">Effects show in the stats above. Each upgrade installs once; levels I and II stack.</p>
        <button type="button" className="utility-button" onClick={onClear} disabled={installed.length === 0}>
          Remove upgrades
        </button>
        <button type="button" className="share-dialog-close" aria-label="Close upgrades" onClick={onClose}>✕</button>
      </header>

      <div className="upgrades-categories">
        {UPGRADE_CATEGORIES.map(category => (
          <div key={category} className="upgrades-category">
            <h3>{category.toUpperCase()}</h3>
            {UPGRADES.filter(upgrade => upgrade.category === category).map(upgrade => {
              const isInstalled = installedIds.has(upgrade.id);
              const fits = isInstalled || canInstallUpgrade(mech, installed, upgrade);
              return (
                <button
                  key={upgrade.id}
                  type="button"
                  className="upgrade-option"
                  aria-pressed={isInstalled}
                  disabled={!fits}
                  title={fits ? undefined : 'Not enough upgrade slots left'}
                  onClick={() => onToggle(upgrade)}
                >
                  <span className="upgrade-name">{upgrade.name}</span>
                  <span className="upgrade-slots" aria-label={`${upgrade.slots} slots`}>
                    {Array.from({ length: upgrade.slots }, (_, index) => <span key={index} aria-hidden="true" />)}
                  </span>
                  <span className="upgrade-effect">{upgrade.description}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
