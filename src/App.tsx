import { useMemo, useState } from 'react';
import './App.css';
import mechsData from './data/mechs.json';
import itemsData from './data/items.json';
import type { Mech } from './types/mech';
import type { Item } from './types/item';
import { getBuildSummary } from './utils/calculators';
import { getEquippableItems } from './utils/equipment';
import { ZONES } from './utils/zones';
import { useMechBuild } from './hooks/useMechBuild';
import { useSarnaAsset } from './hooks/useSarnaAsset';
import { BuildPreview } from './components/BuildPreview';
import { ComponentPanel } from './components/ComponentPanel';
import { InventoryPanel, type WeaponSortOrder } from './components/InventoryPanel';
import { LoadoutAnalysis } from './components/LoadoutAnalysis';
import { MechImage, SarnaSourceLink } from './components/MechReference';
import { MechPicker } from './components/MechPicker';
import { StatsReadout } from './components/StatsReadout';
import { UtilityToolbar } from './components/UtilityToolbar';

type ViewMode = 'workbench' | 'preview';

const VIEW_OPTIONS: [ViewMode, string][] = [
  ['workbench', 'Workshop'],
  ['preview', 'Build preview']
];

const mechs = mechsData as unknown as Mech[];
const items = Object.values(itemsData) as Item[];

export default function App() {
  const build = useMechBuild(mechs);
  const { mech, loadout, armor, activeZone } = build;
  const sarna = useSarnaAsset(mech);
  const [viewMode, setViewMode] = useState<ViewMode>('workbench');
  const [weaponSortOrder, setWeaponSortOrder] = useState<WeaponSortOrder>('large-first');

  const summary = useMemo(() => getBuildSummary(mech, loadout, armor), [mech, loadout, armor]);
  const equippableItems = useMemo(
    () => activeZone ? getEquippableItems(items, mech.components[activeZone], loadout, activeZone) : [],
    [activeZone, mech, loadout]
  );
  const equippedItems = Object.values(loadout).flat();

  const mechImage = (
    <MechImage mech={mech} asset={sarna.asset} isLoading={sarna.isLoading} onImageError={sarna.markImageBroken} />
  );
  const sourceLink = <SarnaSourceLink asset={sarna.asset} />;

  return (
    <div className="mechlab-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">M</span>
          <div>
            <p className="eyebrow">FIELD CONFIGURATION SYSTEM</p>
            <h1>MechLab <span>MW5</span></h1>
          </div>
        </div>
        <div className="topbar-tools">
          <div className="view-switch" role="group" aria-label="Application view">
            {VIEW_OPTIONS.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                className={viewMode === mode ? 'view-switch-button is-active' : 'view-switch-button'}
                onClick={() => setViewMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
          <MechPicker mechs={mechs} selectedIndex={build.selectedIndex} onSelect={build.selectMech} />
        </div>
      </header>

      <StatsReadout mech={mech} summary={summary} />

      <UtilityToolbar
        canClearArmor={summary.armorPoints > 0}
        canMaximizeArmor={summary.armorPoints < summary.maxArmorPoints && summary.totalWeight < mech.tonnageMax}
        hasWeapons={equippedItems.some(item => item.type === 'weapon')}
        hasAmmo={equippedItems.some(item => item.type === 'ammo')}
        onClearArmor={build.clearArmor}
        onMaximizeArmor={build.maximizeArmor}
        onRemoveItems={build.removeItemsOfType}
      />

      {viewMode === 'workbench' ? (
        <div className="workbench">
          <InventoryPanel
            activeZone={activeZone}
            items={equippableItems}
            sortOrder={weaponSortOrder}
            onSortOrderChange={setWeaponSortOrder}
            onEquip={build.equipItem}
          />

          <main className="mech-stage">
            <div className="stage-heading">
              <div>
                <p className="eyebrow">02 / VISUAL REFERENCE</p>
                <h2>{mech.name}</h2>
              </div>
              <span className="variant-tag">{mech.variant}</span>
            </div>
            <div className="image-well">
              {mechImage}
            </div>
            {sourceLink}
          </main>

          <aside className="components-column">
            <header className="section-heading components-heading">
              <div>
                <p className="eyebrow">03 / HARDPOINTS</p>
                <h2>Components</h2>
              </div>
              <span className="component-count">{ZONES.length} SECTIONS</span>
            </header>
            <div className="component-stack">
              {ZONES.map(({ zone, label }) => (
                <ComponentPanel
                  key={zone}
                  title={label}
                  baseData={mech.components[zone]}
                  equippedItems={loadout[zone]}
                  isActive={activeZone === zone}
                  armorFront={armor[zone].front}
                  armorRear={armor[zone].rear}
                  onSelect={() => build.setActiveZone(zone)}
                  onRemoveItem={(instanceId) => build.removeItem(zone, instanceId)}
                  onTierChange={(instanceId, tier) => build.changeTier(zone, instanceId, tier)}
                  onArmorChange={(type, value) => build.changeArmor(zone, type, value)}
                />
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <BuildPreview mech={mech} loadout={loadout} armor={armor} reference={<>{mechImage}{sourceLink}</>} />
      )}

      <LoadoutAnalysis weapons={summary.weapons} ammunition={summary.ammunition} />
    </div>
  );
}
