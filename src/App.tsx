import { useCallback, useMemo, useState } from 'react';
import './App.css';
import mechsData from './data/mechs.json';
import itemsData from './data/items.json';
import type { EquippedLoadout, Mech, Zone } from './types/mech';
import type { Item } from './types/item';
import { replaceWeapon, type ActionResult } from './utils/buildActions';
import { getBuildSummary } from './utils/calculators';
import { getBuildIssues } from './utils/issues';
import { ZONE_LABELS } from './utils/zones';
import { useMechBuild } from './hooks/useMechBuild';
import { useSarnaAsset } from './hooks/useSarnaAsset';
import { BuildStatus } from './components/BuildStatus';
import { ComponentEditor } from './components/ComponentEditor';
import { ContextMenu } from './components/ContextMenu';
import { getEquipmentMenu, getHardpointMenu, type MenuDefinition } from './components/menus';
import { LoadoutAnalysis } from './components/LoadoutAnalysis';
import { MechBoard } from './components/MechBoard';
import { MechImage, SarnaSourceLink } from './components/MechReference';
import { MechPicker } from './components/MechPicker';
import { StatsReadout } from './components/StatsReadout';
import { Toast } from './components/Toast';
import { UtilityToolbar } from './components/UtilityToolbar';

const mechs = mechsData as unknown as Mech[];
const items = Object.values(itemsData) as Item[];

export default function App() {
  const build = useMechBuild(mechs);
  const { mech, loadout, armor, activeZone, setActiveZone } = build;
  const sarna = useSarnaAsset(mech);

  const summary = useMemo(() => getBuildSummary(mech, loadout, armor), [mech, loadout, armor]);
  const issues = useMemo(() => getBuildIssues(mech, loadout, armor), [mech, loadout, armor]);
  const equippedItems = Object.values(loadout).flat();
  const [selectedHardpoint, setSelectedHardpoint] = useState<number | null>(null);
  const selectZone = (zone: Zone, hardpointIndex: number | null) => {
    setActiveZone(zone);
    setSelectedHardpoint(hardpointIndex);
  };
  const closeEditor = useCallback(() => {
    setActiveZone(null);
    setSelectedHardpoint(null);
  }, [setActiveZone, setSelectedHardpoint]);

  const [menu, setMenu] = useState<(MenuDefinition & { x: number; y: number }) | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const menuContext = {
    mech,
    loadout,
    catalog: items,
    run: (action: (current: EquippedLoadout) => ActionResult) => {
      setToast({ id: Date.now(), message: build.runAction(action) });
      setMenu(null);
    },
    openEditor: (zone: Zone, hardpointIndex: number | null) => {
      setMenu(null);
      selectZone(zone, hardpointIndex);
    }
  };
  const openHardpointMenu = (zone: Zone, hardpointIndex: number, x: number, y: number) =>
    setMenu({ ...getHardpointMenu(menuContext, zone, hardpointIndex), x, y });
  const openEquipmentMenu = (zone: Zone, itemName: string, x: number, y: number) => {
    const definition = getEquipmentMenu(menuContext, zone, itemName);
    if (definition) setMenu({ ...definition, x, y });
  };

  return (
    <div className={activeZone ? 'mechlab-shell has-editor' : 'mechlab-shell'}>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">M</span>
          <div>
            <p className="eyebrow">FIELD CONFIGURATION SYSTEM</p>
            <h1>MechLab <span>MW5: MERCENARIES</span></h1>
          </div>
        </div>
        <div className="topbar-tools">
          <MechPicker mechs={mechs} selectedIndex={build.selectedIndex} onSelect={build.selectMech} />
        </div>
      </header>

      <StatsReadout mech={mech} summary={summary} />

      <BuildStatus issues={issues} onSelectZone={selectZone} />

      <UtilityToolbar
        canClearArmor={summary.armorPoints > 0}
        canMaximizeArmor={summary.armorPoints < summary.maxArmorPoints && summary.totalWeight < mech.tonnageMax}
        hasWeapons={equippedItems.some(item => item.type === 'weapon')}
        hasAmmo={equippedItems.some(item => item.type === 'ammo')}
        onClearArmor={build.clearArmor}
        onMaximizeArmor={build.maximizeArmor}
        onRemoveItems={build.removeItemsOfType}
      />

      <main className="workspace">
        <MechBoard
          mech={mech}
          loadout={loadout}
          armor={armor}
          activeZone={activeZone}
          selectedHardpoint={selectedHardpoint}
          onSelectZone={selectZone}
          onArmorChange={build.changeArmor}
          onHardpointMenu={openHardpointMenu}
          onEquipmentMenu={openEquipmentMenu}
          reference={(
            <>
              <MechImage mech={mech} asset={sarna.asset} isLoading={sarna.isLoading} onImageError={sarna.markImageBroken} />
              <SarnaSourceLink asset={sarna.asset} />
            </>
          )}
        />

        <LoadoutAnalysis weapons={summary.weapons} ammunition={summary.ammunition} />
      </main>

      {activeZone && (
        <ComponentEditor
          key={activeZone}
          zone={activeZone}
          label={ZONE_LABELS[activeZone]}
          componentData={mech.components[activeZone]}
          catalog={items}
          loadout={loadout}
          armorFront={armor[activeZone].front}
          armorRear={armor[activeZone].rear}
          selectedHardpoint={selectedHardpoint}
          onSelectHardpoint={setSelectedHardpoint}
          onEquip={build.equipItem}
          onReplace={(item, hardpointIndex) => menuContext.run(current => replaceWeapon(mech, current, activeZone, hardpointIndex, item))}
          onRemoveItem={(instanceId) => build.removeItem(activeZone, instanceId)}
          onTierChange={(instanceId, tier) => build.changeTier(activeZone, instanceId, tier)}
          onArmorChange={(type, value) => build.changeArmor(activeZone, type, value)}
          onClose={closeEditor}
        />
      )}

      {menu && <ContextMenu x={menu.x} y={menu.y} title={menu.title} entries={menu.entries} onClose={closeMenu} />}
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  );
}
