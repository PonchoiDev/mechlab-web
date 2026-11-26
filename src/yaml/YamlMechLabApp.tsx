import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { BrandMark } from '../components/BrandMark';
import { BuildStatus } from '../components/BuildStatus';
import { ContextMenu, type MenuEntry } from '../components/ContextMenu';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { PublishBuildDialog } from '../components/PublishBuildDialog';
import { SaveBuildDialog } from '../components/SaveBuildDialog';
import { MechImage, SarnaSourceLink } from '../components/MechReference';
import { SiteNav } from '../components/SiteNav';
import { SupportLink } from '../components/SupportLink';
import { Toast } from '../components/Toast';
import { UpgradesPanel } from '../components/UpgradesPanel';
import { UtilityToolbar } from '../components/UtilityToolbar';
import { useSarnaAsset } from '../hooks/useSarnaAsset';
import { useSavedBuilds } from '../hooks/useSavedBuilds';
import { useViewPreferences } from '../hooks/useViewPreferences';
import { copyText } from '../services/clipboard';
import type { Zone } from '../types/mech';
import type { YamlBuild, YamlMech } from '../types/yaml-mechlab';
import { distributeDynamicFillerGroups, removeItemAt, setArmor, setMaxArmor } from '../utils/yaml/board';
import { clearArmor, createStockBuild, dropExcessEngineHeatSinks, removeKind, removeWeapon, setWeaponTier, type MountResult } from '../utils/yaml/build';
import { decodeYamlBuild, encodeYamlBuild } from '../utils/yaml/buildCode';
import { findYamlMech, getYamlItem, getYamlSarnaMech, YAML_COLORS, yamlMechs } from '../utils/yaml/data';
import { autoPlaceYamlItem, chooseYamlInternal, getYamlDropZones, placeYamlItem, type YamlInventoryTarget } from '../utils/yaml/inventory';
import { getYamlBuildIssues } from '../utils/yaml/readouts';
import { YAML_SAVED_BUILDS_KEY } from '../utils/yaml/savedBuilds';
import { normalizeBuildName } from '../utils/savedBuildsCore';
import { getYamlUpgrades, toggleYamlUpgrade } from '../utils/yaml/traits';
import { getUsedUpgradeSlots, sanitizeUpgrades } from '../utils/upgrades';
import { ZONE_LABELS } from '../utils/zones';
import { YamlAnalysis } from './YamlAnalysis';
import { YamlBoard } from './YamlBoard';
import { YamlInventoryPanel } from './YamlInventoryPanel';
import { YamlMechPicker } from './YamlMechPicker';
import { YamlMyBuildsDialog } from './YamlMyBuildsDialog';
import { YamlStatsPanel } from './YamlStatsPanel';

const DEFAULT_MECH = 'NSR-9J';
// Los colores de anclaje y el relleno de las piezas del mechlab de YAML, para yaml.css.
const SHELL_COLORS = {
  ...Object.fromEntries(Object.entries(YAML_COLORS.hardpoints).map(([type, color]) => [`--yaml-${type}`, color])),
  '--yaml-general': YAML_COLORS.general,
  '--yaml-tint': `${Math.round(YAML_COLORS.tintOpacity * 100)}%`
} as CSSProperties;
// La vista (celdas, tablero compacto, inventario y su lado) se guarda aparte de la de MW5 y BATTLETECH.
const YAML_VIEW_KEY = 'mw-builder:yaml:view';
// Pulsar aquí no quita la ubicación elegida: el inventario, el tablero y cualquier control, como en MW5.
const KEEPS_TARGET = ['.inventory-panel', '.component-card', '.mech-picker', '.context-menu', 'button', 'a', 'input', 'select', 'label', '[role="button"]'].join(', ');

// La build sale del enlace: compartida (?b=) o la de serie de una variante (?mech=). Después, la dirección
// lleva siempre la build actual.
function initialState(): { mech: YamlMech; build: YamlBuild } {
  const params = new URLSearchParams(window.location.search);
  const shared = params.get('b') ? decodeYamlBuild(params.get('b')!) : null;
  const sharedMech = shared ? findYamlMech(shared.mechId) : undefined;
  // Los rasgos que no existen, se repiten o no caben en los huecos del 'Mech se quitan.
  if (shared && sharedMech) return { mech: sharedMech, build: { ...shared.build, traits: sanitizeUpgrades(sharedMech, shared.build.traits) } };
  const mech = findYamlMech(params.get('mech') ?? '') ?? findYamlMech(DEFAULT_MECH)!;
  return { mech, build: createStockBuild(mech) };
}

export function YamlMechLabApp() {
  const [{ mech, build }, setState] = useState(initialState);
  const [target, setTarget] = useState<YamlInventoryTarget | null>(null);
  const [pickedItem, setPickedItem] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [menu, setMenu] = useState<{ title: string; x: number; y: number; entries: MenuEntry[] } | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isUpgradesOpen, setIsUpgradesOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isBuildsOpen, setIsBuildsOpen] = useState(false);
  // Se publican en la página de builds de MW5, con la etiqueta YAML (docs/specs/publicar-builds-yaml.md).
  const [publishTarget, setPublishTarget] = useState<{ code: string; name: string } | null>(null);
  const closePublish = useCallback(() => setPublishTarget(null), []);
  // Con la ventana de publicar encima, Escape la cierra a ella y My builds sigue abierta debajo.
  const closeBuilds = useCallback(() => {
    if (!publishTarget) setIsBuildsOpen(false);
  }, [publishTarget]);
  // La build guardada abierta, para actualizarla al guardar (docs/specs/builds-guardadas-yaml.md).
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const saved = useSavedBuilds(YAML_SAVED_BUILDS_KEY);
  // El nivel elegido en el inventario para cada arma, con el que se monta, como en MW5.
  const [inventoryTiers, setInventoryTiers] = useState<Record<string, number>>({});
  const view = useViewPreferences(YAML_VIEW_KEY);
  // Memorizado: el hook vuelve a pedir la imagen cuando cambia el objeto.
  const sarnaMech = useMemo(() => getYamlSarnaMech(mech), [mech]);
  const sarna = useSarnaAsset(sarnaMech);

  // Como en el juego, un cambio que deja menos ranuras de disipadores del motor desmonta los que sobran.
  const setBuild = (next: YamlBuild) => setState({ mech, build: dropExcessEngineHeatSinks(mech, next) });
  const showToast = useCallback((message: string) => setToast(current => ({ id: (current?.id ?? 0) + 1, message })), []);
  const buildCode = encodeYamlBuild(mech.id, build);
  // Cargar la de serie no cambia los rasgos, como en el MechLab de MW5: en el juego se instalan aparte. Los de
  // serie entran al abrir la variante.
  const stockBuild = useMemo(() => ({ ...createStockBuild(mech), traits: build.traits }), [mech, build.traits]);
  const stockCode = encodeYamlBuild(mech.id, stockBuild);
  const hasUnsavedChanges = buildCode !== stockCode && !saved.builds.some(entry => entry.code === buildCode);
  const activeBuild = saved.builds.find(entry => entry.id === activeSavedId) ?? null;
  // Como en MW5 y BATTLETECH, la build guardada abierta solo se actualiza mientras se sigue en su chasis.
  const editableBuild = activeBuild && decodeYamlBuild(activeBuild.code)?.mechId === mech.id ? activeBuild : null;
  const defaultName = `${mech.chassis} ${mech.variant}`;
  const upgrades = useMemo(() => getYamlUpgrades(build), [build]);
  const buildUrl = `${window.location.origin}${window.location.pathname}?b=${buildCode}`;
  const issues = useMemo(() => getYamlBuildIssues(mech, build), [mech, build]);
  const fillers = useMemo(() => distributeDynamicFillerGroups(mech, build), [mech, build]);
  const held = dragged ?? pickedItem;
  const dropZones = useMemo(() => held ? getYamlDropZones(mech, build, held) : null, [mech, build, held]);

  useEffect(() => {
    window.history.replaceState(null, '', `?b=${buildCode}`);
  }, [buildCode]);

  const clearTarget = useCallback(() => setTarget(null), []);
  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && !pickedItem) clearTarget(); };
    const handleClick = (event: MouseEvent) => {
      const element = event.target;
      if (!(element instanceof Element) || !element.isConnected || element.closest(KEEPS_TARGET)) return;
      clearTarget();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
    };
  }, [target, pickedItem, clearTarget]);

  // Como en MW5: si no se puede, avisa del motivo.
  const apply = (result: MountResult, announce?: string) => {
    if (!result.build) {
      showToast(result.error);
      return false;
    }
    setBuild(result.build);
    if (announce) showToast(announce);
    return true;
  };
  const selectTarget = (next: YamlInventoryTarget) => {
    setTarget(next);
    setPickedItem(null);
    view.openInventory();
  };
  const placeHeld = (zone: Zone, hardpoint: string | null) => {
    if (!held) return;
    setDragged(null);
    setPickedItem(null);
    apply(placeYamlItem(mech, build, held, zone, hardpoint, inventoryTiers[held]));
  };
  const equipInTarget = (id: string) => {
    if (target) apply(placeYamlItem(mech, build, id, target.zone, target.hardpoint, inventoryTiers[id]));
  };
  const quickEquip = (id: string) => {
    if (target) {
      equipInTarget(id);
      return;
    }
    const result = autoPlaceYamlItem(mech, build, id, inventoryTiers[id]);
    apply(result, result.zone && `${getYamlItem(id)?.name} equipped in ${ZONE_LABELS[result.zone]}`);
  };
  const toggleInventory = () => {
    if (view.inventoryOpen) {
      setPickedItem(null);
      clearTarget();
    }
    view.toggleInventory();
  };
  const copyLink = async () => showToast(await copyText(buildUrl) ? 'Build link copied' : 'Could not copy the link');
  const hasKind = (kind: 'ammo' | 'equipment') => build.items.some(mounted => (getYamlItem(mounted.item)?.kind === 'ammo') === (kind === 'ammo'));
  const armorPoints = Object.values(build.armor).reduce((sum, side) => sum + side.front + side.rear, 0);
  const maxArmorPoints = Object.values(mech.zones).reduce((sum, zone) => sum + zone.maxArmor, 0);

  return (
    <div
      className={['mechlab-shell', 'yaml-mechlab', view.inventoryOpen ? `has-inventory is-inventory-${view.editorSide}` : ''].filter(Boolean).join(' ')}
      style={SHELL_COLORS}
    >
      <header className="topbar">
        <div className="topbar-start">
          <a className="brand-lockup" href="/" title="Back to MW Builder">
            <BrandMark />
            <div>
              <p className="eyebrow">FIELD CONFIGURATION SYSTEM</p>
              <h1>MechLab <span>YAML</span></h1>
            </div>
          </a>
          <SiteNav game="mercs" current="mechlab" className="topbar-links" />
        </div>
        <div className="topbar-tools">
          <button type="button" className="feedback-button" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
      </header>

      <section className="mech-select-bar" aria-label="'Mech">
        <YamlMechPicker
          mechs={yamlMechs}
          current={mech}
          onSelect={(next) => {
            setTarget(null);
            if (next.id !== mech.id) setActiveSavedId(null);
            setState({ mech: next, build: createStockBuild(next) });
          }}
        />
        <p className="yaml-rules-note">
          Rules of the <strong>Yet Another Mechlab</strong> mod 0.99.4.3, with Yet Another Weapon, its Clan version and
          Yet Another Equipment Collection: weapons take critical slots, the engine is a core plus a type, and Endo and
          Ferro take filler slots anywhere in the 'Mech. Every weapon and piece of equipment is on
          the <a href={`${import.meta.env.BASE_URL}yaml/equipment/`}>YAML equipment page</a>.
        </p>
      </section>

      <BuildStatus
        issues={issues}
        onSelectZone={(zone) => selectTarget({ zone, hardpoint: null, internal: null })}
        readyMessage="Nothing to note: the build is within its tonnage and every piece has room."
      />

      <UtilityToolbar
        canClearArmor={armorPoints > 0}
        canMaximizeArmor={armorPoints < maxArmorPoints}
        hasWeapons={build.weapons.length > 0}
        hasAmmo={hasKind('ammo')}
        hasEquipment={hasKind('equipment')}
        onClearArmor={() => setBuild(clearArmor(build))}
        onMaximizeArmor={() => setBuild(setMaxArmor(mech, build))}
        onRemoveItems={(kind) => setBuild(removeKind(build, kind))}
        canLoadStock={buildCode !== stockCode}
        onLoadStock={() => {
          setBuild(stockBuild);
          showToast(`Loaded the stock ${mech.variant} loadout`);
        }}
        upgradeSlots={{ used: getUsedUpgradeSlots(upgrades), capacity: mech.upgradeSlots }}
        isUpgradesOpen={isUpgradesOpen}
        onToggleUpgrades={() => setIsUpgradesOpen(open => !open)}
        savedBuildCount={saved.builds.length}
        onSaveBuild={() => setIsSaveOpen(true)}
        onOpenBuilds={() => setIsBuildsOpen(true)}
        canPublish={build.weapons.length > 0 || build.items.length > 0}
        onPublish={() => setPublishTarget({ code: buildCode, name: editableBuild?.name ?? defaultName })}
        onShare={(anchor) => setMenu({
          title: 'Share build',
          x: anchor.left,
          y: anchor.bottom + 4,
          entries: [{ kind: 'action', label: 'Copy build link', onSelect: () => { setMenu(null); copyLink(); } }]
        })}
      />

      <YamlStatsPanel mech={mech} build={build} />

      {isUpgradesOpen && (
        <UpgradesPanel
          mech={mech}
          installed={upgrades}
          onToggle={(upgrade) => setBuild(toggleYamlUpgrade(mech, build, upgrade.id))}
          onClear={() => setBuild({ ...build, traits: [] })}
          onClose={() => setIsUpgradesOpen(false)}
          hint="Effects show in the stats above; weapon upgrades only act in missions, as in the game's mechlab."
        />
      )}

      <main className="workspace">
        <div className="view-toggles" aria-label="View options">
          <button type="button" className="utility-button inventory-toggle" aria-pressed={view.inventoryOpen}
            title="Every weapon, piece of equipment and ammo, to drag onto the board" onClick={toggleInventory}>
            Inventory
          </button>
          <span className="utility-label">VIEW</span>
          <button type="button" className="utility-button" aria-pressed={view.expandedSlots} title="Show every slot as a cell, like the in-game mechlab" onClick={view.toggleExpandedSlots}>
            {view.expandedSlots ? 'Hide slot cells' : 'Show slot cells'}
          </button>
          <button type="button" className="utility-button" aria-pressed={view.compactBoard} title="Hide the quirks and lay the locations out in five columns" onClick={view.toggleCompactBoard}>
            Compact board
          </button>
          <button type="button" className="utility-button" title="Side of the screen where the inventory opens" onClick={view.toggleEditorSide}>
            Inventory {view.editorSide} ⇄
          </button>
        </div>
        <YamlBoard
          mech={mech}
          build={build}
          target={target}
          expandedSlots={view.expandedSlots}
          compact={view.compactBoard}
          fillers={fillers}
          dropZones={dropZones}
          onSelect={selectTarget}
          onPlace={placeHeld}
          onArmorChange={(zone, side, value) => setBuild(setArmor(mech, build, zone, side, value))}
          onRemoveWeapon={(hardpoint) => setBuild(removeWeapon(build, hardpoint))}
          onRemoveItem={(index) => setBuild(removeItemAt(build, index))}
          reference={(
            <>
              <MechImage mech={sarnaMech} asset={sarna.asset} isLoading={sarna.isLoading} onImageError={sarna.markImageBroken} />
              <SarnaSourceLink asset={sarna.asset} />
            </>
          )}
        />

        <YamlAnalysis mech={mech} build={build} />
      </main>

      {view.inventoryOpen && (
        <YamlInventoryPanel
          mech={mech}
          build={build}
          side={view.editorSide}
          target={target}
          fillers={fillers}
          onClearTarget={clearTarget}
          pickedItem={pickedItem}
          onPick={setPickedItem}
          onEquip={equipInTarget}
          onQuickEquip={quickEquip}
          onChooseInternal={(slotType, id) => apply(chooseYamlInternal(mech, build, slotType, id))}
          onDragStart={setDragged}
          onDragEnd={() => setDragged(null)}
          onRemoveWeapon={(hardpoint) => setBuild(removeWeapon(build, hardpoint))}
          onRemoveItem={(index) => setBuild(removeItemAt(build, index))}
          inventoryTiers={inventoryTiers}
          onInventoryTierChange={(id, tier) => setInventoryTiers(current => ({ ...current, [id]: tier }))}
          onWeaponTierChange={(hardpoint, tier) => setBuild(setWeaponTier(build, hardpoint, tier))}
          onToggleSide={view.toggleEditorSide}
          onClose={toggleInventory}
        />
      )}

      <footer className="site-footer">
        <p className="support-note">
          <span>Life in the Inner Sphere is rough. MechLab is free and ad-free, so if it helps you, consider supporting this merc!</span>
          <SupportLink />
        </p>
        <p className="feedback-note">
          Found a bug or a wrong number, or have an idea?
          <button type="button" className="feedback-inline" onClick={() => setIsFeedbackOpen(true)}>Send feedback</button>
        </p>
        <p>
          Fan-made tool, not affiliated with or endorsed by Piranha Games, the authors of the Yet Another Mechlab mods or
          the BattleTech trademark holders. Game and mod data belong to their respective owners.
        </p>
      </footer>

      {isFeedbackOpen && <FeedbackDialog buildUrl={buildUrl} onMessage={showToast} onClose={() => setIsFeedbackOpen(false)} />}
      {isSaveOpen && (
        <SaveBuildDialog
          defaultName={defaultName}
          activeBuild={editableBuild}
          isActiveUpToDate={activeBuild?.code === buildCode}
          onSaveNew={(name) => {
            const entry = saved.saveBuild(normalizeBuildName(name, defaultName), buildCode);
            setActiveSavedId(entry.id);
            setIsSaveOpen(false);
            showToast(`Saved “${entry.name}”`);
          }}
          onUpdate={() => {
            if (!editableBuild) return;
            saved.updateBuild(editableBuild.id, { code: buildCode });
            setIsSaveOpen(false);
            showToast(`Updated “${editableBuild.name}”`);
          }}
          onClose={() => setIsSaveOpen(false)}
        />
      )}
      {isBuildsOpen && (
        <YamlMyBuildsDialog
          saved={saved}
          currentCode={buildCode}
          hasUnsavedChanges={hasUnsavedChanges}
          activeId={activeSavedId}
          onActiveChange={setActiveSavedId}
          onLoad={(nextMech, nextBuild, name) => {
            setTarget(null);
            // Los rasgos que no caben en el 'Mech se quitan, como al abrir un enlace.
            setState({ mech: nextMech, build: { ...nextBuild, traits: sanitizeUpgrades(nextMech, nextBuild.traits) } });
            setIsBuildsOpen(false);
            showToast(`Loaded “${name}”`);
          }}
          onCopyLink={async (code) => showToast(await copyText(`${window.location.origin}${window.location.pathname}?b=${code}`) ? 'Build link copied' : 'Could not copy the link')}
          onPublish={(entry) => setPublishTarget({ code: entry.code, name: entry.name })}
          onMessage={showToast}
          onClose={closeBuilds}
        />
      )}
      {publishTarget && (
        <PublishBuildDialog
          key={publishTarget.code}
          game="mercs"
          code={publishTarget.code}
          defaultName={publishTarget.name}
          onCopyLink={async (url) => showToast(await copyText(url) ? 'Link copied' : 'Could not copy the link')}
          onClose={closePublish}
        />
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} title={menu.title} entries={menu.entries} onClose={() => setMenu(null)} />}
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
