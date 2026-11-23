import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Zone } from '../../types/mech';
import type { BtBuild, BtItem, BtLoadout } from '../../types/battletech-mechlab';
import { BuildStatus } from '../../components/BuildStatus';
import { ContextMenu, type MenuEntry } from '../../components/ContextMenu';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { SaveBuildDialog } from '../../components/SaveBuildDialog';
import { PublishBuildDialog } from '../../components/PublishBuildDialog';
import { ShareImageDialog } from '../../components/ShareImageDialog';
import { SupportLink } from '../../components/SupportLink';
import { Toast } from '../../components/Toast';
import { UtilityToolbar } from '../../components/UtilityToolbar';
import { WhatsNew } from '../../components/WhatsNew';
import { useSavedBuilds } from '../../hooks/useSavedBuilds';
import { useViewPreferences } from '../../hooks/useViewPreferences';
import { renderBtBuildImage } from '../../services/battletech/buildImage';
import { copyText } from '../../services/clipboard';
import { normalizeBuildName } from '../../utils/savedBuildsCore';
import { decodeBtBuild, DEFAULT_MECH, encodeBtBuild, getBtBuildUrl, readBtBuildFromLocation } from '../../utils/battletech/buildCode';
import {
  autoPlaceBtItem,
  getBtDropTargets,
  getNextFreeBtHardpoint,
  moveBtItem,
  placeBtItem,
  unequipBtItem,
  type BtEquippedOrigin,
  type BtPlaceResult
} from '../../utils/battletech/inventory';
import { createStockBuild } from '../../utils/battletech/fitting';
import { getBtBuildIssues } from '../../utils/battletech/issues';
import { BT_MECHS, getItem, getMechDisplayName } from '../../utils/battletech/mechlabData';
import { BT_SAVED_BUILDS_KEY } from '../../utils/battletech/savedBuilds';
import { getBuildSummary } from '../../utils/battletech/stats';
import { getBtReadouts } from '../../utils/battletech/readouts';
import { BtAnalysis } from './BtAnalysis';
import { HardpointUsage } from './HardpointUsage';
import { BtBoard } from './BtBoard';
import { BtComparePanel } from './BtComparePanel';
import { BtInventoryPanel } from './BtInventoryPanel';
import { BtMechPicker } from './BtMechPicker';
import { BtMyBuildsDialog } from './BtMyBuildsDialog';
import { getBtEquipmentMenu, getBtHardpointMenu, type BtMenuContext } from './btMenus';
import { useBtBuild } from './useBtBuild';

// Se lee una sola vez al cargar la página: la dirección queda limpia después.
const linked = readBtBuildFromLocation();
// Como en MW5, la portada puede enlazar a /battletech/#feedback para abrir directamente el formulario.
const openFeedbackOnLoad = window.location.hash === '#feedback';
if (openFeedbackOnLoad) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
// La vista (celdas, tablero compacto y lado del panel) se guarda aparte de la de MW5.
const BT_VIEW_KEY = 'mw-builder:battletech:view';
// Pulsar aquí no quita la ubicación elegida: el inventario, el tablero y cualquier control, como en MW5.
const KEEPS_TARGET = ['.inventory-panel', '.component-card', '.mech-picker', '.context-menu', 'button', 'a', 'input', 'select', 'textarea', 'label', '[role="button"]'].join(', ');

export function BtMechLabApp() {
  const actions = useBtBuild(linked?.build ?? createStockBuild(DEFAULT_MECH));
  const { build } = actions;
  const { mech } = build;
  const summary = useMemo(() => getBuildSummary(build), [build]);
  const readouts = useMemo(() => getBtReadouts(build), [build]);
  const issues = useMemo(() => getBtBuildIssues(build), [build]);
  // Ubicación (y anclaje) elegida en el tablero, como en el MechLab de MW5: el inventario apunta a ella y equipa ahí.
  const [activeZone, setActiveZone] = useState<Zone | null>(null);
  const [selectedHardpoint, setSelectedHardpoint] = useState<number | null>(null);
  // Objeto que se está colocando: el que se arrastra (del inventario o ya montado, con su sitio) o, si no, el
  // elegido en el inventario para colocarlo pulsando el tablero.
  const [pickedItem, setPickedItem] = useState<BtItem | null>(null);
  const [dragged, setDragged] = useState<{ item: BtItem; origin?: BtEquippedOrigin } | null>(null);
  const view = useViewPreferences(BT_VIEW_KEY);
  const target = useMemo(
    () => activeZone ? { zone: activeZone, hardpointIndex: selectedHardpoint } : null,
    [activeZone, selectedHardpoint]
  );
  const selectZone = (zone: Zone, hardpointIndex: number | null = null) => {
    setActiveZone(zone);
    setSelectedHardpoint(hardpointIndex);
    setPickedItem(null);
    view.openInventory();
  };
  const clearTarget = useCallback(() => {
    setActiveZone(null);
    setSelectedHardpoint(null);
  }, []);
  // undo: el loadout de antes y el de después de reemplazar o desequipar.
  const [toast, setToast] = useState<{ id: number; message: string; undo?: { before: BtLoadout; after: BtLoadout } } | null>(() =>
    linked && !linked.build ? { id: 0, message: 'This build link is not valid' } : null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(openFeedbackOnLoad);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [isBuildsOpen, setIsBuildsOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  // Build guardada que pide el botón Compare de My builds. El contador abre el comparador de nuevo con ella
  // aunque ya estuviera abierto.
  const [compareRequest, setCompareRequest] = useState<{ savedId: string; count: number } | null>(null);
  const [menu, setMenu] = useState<{ title: string; x: number; y: number; entries: MenuEntry[] } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const saved = useSavedBuilds(BT_SAVED_BUILDS_KEY);

  const showToast = useCallback((message: string) => setToast({ id: Date.now(), message }), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const closeFeedback = useCallback(() => setIsFeedbackOpen(false), []);
  const closeSave = useCallback(() => setIsSaveOpen(false), []);
  const closePublish = useCallback(() => setIsPublishOpen(false), []);
  const closeBuilds = useCallback(() => setIsBuildsOpen(false), []);
  const closeCompare = useCallback(() => setIsCompareOpen(false), []);

  const buildCode = encodeBtBuild(build);
  const buildUrl = getBtBuildUrl(buildCode);
  const stockCode = useMemo(() => encodeBtBuild(createStockBuild(mech)), [mech]);
  const hasUnsavedChanges = buildCode !== stockCode && !saved.builds.some(entry => entry.code === buildCode);
  const activeBuild = saved.builds.find(entry => entry.id === activeSavedId) ?? null;
  const defaultName = getMechDisplayName(mech);
  const mountedKinds = useMemo(() => new Set(Object.values(build.loadout).flat().map(id => getItem(id)?.kind)), [build.loadout]);
  const hasKind = (kind: BtItem['kind']) => mountedKinds.has(kind);
  // La build guardada abierta solo se actualiza mientras se sigue en su chasis.
  const editableBuild = activeBuild && decodeBtBuild(activeBuild.code)?.mech.id === mech.id ? activeBuild : null;

  const loadBuild = (next: BtBuild, message: string, savedId: string | null = null) => {
    actions.loadBuild(next);
    setActiveSavedId(savedId);
    showToast(message);
  };
  const menuContext: BtMenuContext = {
    mech,
    loadout: build.loadout,
    run: (action) => {
      const result = action(build.loadout);
      actions.setLoadout(result.loadout);
      showToast(result.message);
      setMenu(null);
    },
    openEditor: (zone, hardpointIndex) => {
      setMenu(null);
      selectZone(zone, hardpointIndex);
    }
  };
  const openHardpointMenu = (zone: Zone, hardpointIndex: number, x: number, y: number) => {
    const definition = getBtHardpointMenu(menuContext, zone, hardpointIndex);
    if (definition) setMenu({ ...definition, x, y });
  };
  const openEquipmentMenu = (zone: Zone, itemId: string, x: number, y: number) => {
    const definition = getBtEquipmentMenu(menuContext, zone, itemId);
    if (definition) setMenu({ ...definition, x, y });
  };
  const isInventoryOpen = view.inventoryOpen;
  const hasTarget = activeZone !== null;
  const held = useMemo(
    () => dragged ?? (isInventoryOpen && pickedItem && !hasTarget ? { item: pickedItem } : null),
    [dragged, isInventoryOpen, pickedItem, hasTarget]
  );
  const dropTargets = useMemo(() => held ? getBtDropTargets(mech, build.loadout, held.item, held.origin) : null, [mech, build.loadout, held]);
  const endDrag = useCallback(() => setDragged(null), [setDragged]);

  // Como en MW5: si no cambia nada avisa del motivo, y el reemplazo y el desequipar se pueden deshacer.
  const applyPlacement = (result: BtPlaceResult, { undoable = result.replaced, announce = false } = {}) => {
    if (result.loadout === build.loadout) {
      showToast(result.message);
      return false;
    }
    actions.setLoadout(result.loadout);
    if (undoable) setToast({ id: Date.now(), message: result.message, undo: { before: build.loadout, after: result.loadout } });
    else if (announce) showToast(result.message);
    return true;
  };
  const placeHeldItem = (zone: Zone, hardpointIndex: number | null) => {
    if (!held) return;
    setDragged(null);
    applyPlacement(held.origin
      ? moveBtItem(mech, build.loadout, held.origin, zone, hardpointIndex)
      : placeBtItem(mech, build.loadout, zone, held.item, hardpointIndex));
  };
  const removeMounted = (zone: Zone, index: number) => applyPlacement(unequipBtItem(build.loadout, zone, index), { undoable: true });
  const equipInTarget = (item: BtItem) => {
    if (!target) return;
    const result = placeBtItem(mech, build.loadout, target.zone, item, target.hardpointIndex);
    const wasFree = target.hardpointIndex !== null && !result.replaced;
    if (applyPlacement(result) && wasFree) {
      setSelectedHardpoint(getNextFreeBtHardpoint(mech, result.loadout, target.zone, target.hardpointIndex as number));
    }
  };
  const quickEquip = (item: BtItem) => {
    if (target) equipInTarget(item);
    else applyPlacement(autoPlaceBtItem(mech, build.loadout, item), { announce: true });
  };
  const undoPlacement = (undo: { before: BtLoadout; after: BtLoadout }) => {
    if (build.loadout !== undo.after) {
      showToast('The build changed since, nothing to undo');
      return;
    }
    actions.setLoadout(undo.before);
    showToast('Undone');
  };
  const toggleInventory = () => {
    if (view.inventoryOpen) {
      setPickedItem(null);
      clearTarget();
    }
    view.toggleInventory();
  };

  // Lo montado que se arrastra se desequipa al soltarlo fuera de las tarjetas, como en MW5.
  const draggedOrigin = dragged?.origin;
  useEffect(() => {
    if (!draggedOrigin) return;
    const allow = (event: DragEvent) => event.preventDefault();
    const remove = (event: DragEvent) => {
      event.preventDefault();
      setDragged(null);
      removeMounted(draggedOrigin.zone, draggedOrigin.index);
    };
    window.addEventListener('dragover', allow);
    window.addEventListener('drop', remove);
    return () => {
      window.removeEventListener('dragover', allow);
      window.removeEventListener('drop', remove);
    };
  });

  // Escape suelta primero el objeto elegido y después la ubicación. Pulsar en una zona vacía la quita.
  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !pickedItem) clearTarget();
    };
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

  const copyLink = async (url = buildUrl) => showToast(await copyText(url) ? 'Build link copied' : 'Could not copy the link');
  const renderShareImage = useCallback(() => renderBtBuildImage(build), [build]);
  const closeShareImage = useCallback(() => setIsSharingImage(false), []);

  return (
    <div className={['mechlab-shell', 'bt-mechlab', view.inventoryOpen ? `has-inventory is-inventory-${view.editorSide}` : ''].filter(Boolean).join(' ')}>
      <header className="topbar">
        <div className="topbar-start">
          <a className="brand-lockup" href="/" title="Back to MW Builder">
            <span className="brand-mark" aria-hidden="true">M</span>
            <div>
              <p className="eyebrow">FIELD CONFIGURATION SYSTEM</p>
              <h1>MechLab <span>BATTLETECH</span></h1>
            </div>
          </a>
          <nav className="topbar-links" aria-label="BATTLETECH">
            <a href="/battletech/starmap/"><small>BATTLETECH</small> Star map</a>
            <a href="/battletech/chassis/">Chassis</a>
            <a href="/battletech/builds/">Builds</a>
            <a href="/battletech/flashpoints/">Flashpoints</a>
            <a href="/battletech/units/">Enemy units</a>
            <a href="/battletech/argo/">Argo</a>
            <a href="/battletech/equipment/">Equipment</a>
          </nav>
        </div>
        <div className="topbar-tools">
          <WhatsNew />
          <button type="button" className="feedback-button" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
      </header>

      {/* El selector de 'Mech, en su propia fila, como en MW5. */}
      <section className="mech-select-bar" aria-label="'Mech">
        <BtMechPicker
          mechs={BT_MECHS}
          current={mech}
          prominent
          onSelect={(next) => {
            if (next.id !== mech.id) setActiveSavedId(null);
            actions.selectMech(next);
          }}
        />
      </section>

      <BuildStatus
        issues={issues}
        onSelectZone={(zone, hardpointIndex) => selectZone(zone, hardpointIndex)}
        readyMessage="Nothing to note: every hardpoint is used, weapons have ammo, the heat is under control and no tonnage is left."
      />

      <UtilityToolbar
        canClearArmor={summary.armorPoints > 0}
        canMaximizeArmor={summary.armorPoints < summary.maxArmorPoints && summary.freeTonnage > 0}
        hasWeapons={hasKind('weapon')}
        hasAmmo={hasKind('ammo')}
        hasEquipment={hasKind('heatSink') || hasKind('jumpJet') || hasKind('upgrade')}
        onClearArmor={actions.clear}
        onMaximizeArmor={actions.distribute}
        onRemoveItems={(type) => actions.removeKinds(type === 'equipment' ? ['heatSink', 'jumpJet', 'upgrade'] : [type])}
        canLoadStock={buildCode !== stockCode}
        onLoadStock={() => {
          actions.loadStock();
          setSelectedHardpoint(null);
          showToast(`Loaded the stock ${mech.variant} loadout`);
        }}
        isCompareOpen={isCompareOpen}
        onToggleCompare={() => {
          setCompareRequest(null);
          setIsCompareOpen(open => !open);
        }}
        savedBuildCount={saved.builds.length}
        onSaveBuild={() => setIsSaveOpen(true)}
        onOpenBuilds={() => setIsBuildsOpen(true)}
        canPublish={Object.values(build.loadout).some(ids => ids.length > 0)}
        onPublish={() => setIsPublishOpen(true)}
        onShare={(anchor) => setMenu({
          title: 'Share build',
          x: anchor.left,
          y: anchor.bottom + 4,
          entries: [
            { kind: 'action', label: 'Copy build link', onSelect: () => { setMenu(null); copyLink(); } },
            { kind: 'action', label: 'Generate build image', onSelect: () => { setMenu(null); setIsSharingImage(true); } }
          ]
        })}
      />

      {/* Las diez cifras del StatsReadout de MW5 (getBtReadouts), las mismas que lleva la imagen para compartir,
          debajo de los avisos y los menús, como en MW5. */}
      <section className="readout-strip" aria-label="Mech statistics">
        {readouts.map(readout => (
          <div key={readout.label} className="readout-cell">
            <span className="readout-label" title={readout.title}>{readout.label}</span>
            <strong className={readout.warn ? 'readout-warning' : ''}>{readout.value}{readout.unit && <> <small>{readout.unit}</small></>}</strong>
            {readout.label === 'TONNAGE' && <HardpointUsage mech={mech} loadout={build.loadout} />}
          </div>
        ))}
      </section>

      {isCompareOpen && (
        <BtComparePanel
          key={`${mech.id}-${compareRequest?.count ?? 0}`}
          initialSavedId={compareRequest?.savedId ?? null}
          mechs={BT_MECHS}
          current={build}
          savedBuilds={saved.builds}
          expandedSlots={view.expandedSlots}
          onLoad={(next, label, savedId) => {
            loadBuild(next, `Loaded ${savedId ? `“${label}”` : `the ${label} loadout`}`, savedId);
            setIsCompareOpen(false);
          }}
          onClose={closeCompare}
        />
      )}

      <main className="workspace">
        <div className="view-toggles" aria-label="View options">
          <button
            type="button"
            className="utility-button inventory-toggle"
            aria-pressed={view.inventoryOpen}
            title="Every weapon, piece of equipment and ammo, to drag onto the board"
            onClick={toggleInventory}
          >
            Inventory
          </button>
          <span className="utility-label">VIEW</span>
          <button
            type="button"
            className="utility-button"
            aria-pressed={view.expandedSlots}
            title="Show every slot as a cell, like the in-game mechlab"
            onClick={view.toggleExpandedSlots}
          >
            {view.expandedSlots ? 'Hide slot cells' : 'Show slot cells'}
          </button>
          <button
            type="button"
            className="utility-button"
            aria-pressed={view.compactBoard}
            title="Hide the 'Mech icon and lay the locations out in five columns"
            onClick={view.toggleCompactBoard}
          >
            Compact board
          </button>
          <button
            type="button"
            className="utility-button"
            title="Side of the screen where the inventory opens"
            onClick={view.toggleEditorSide}
          >
            Inventory {view.editorSide} ⇄
          </button>
        </div>
        <BtBoard
          expandedSlots={view.expandedSlots}
          compact={view.compactBoard}
          build={build}
          activeZone={activeZone}
          selectedHardpoint={selectedHardpoint}
          onSelectZone={selectZone}
          onHardpointMenu={openHardpointMenu}
          onEquipmentMenu={openEquipmentMenu}
          onArmorChange={actions.changeArmor}
          onArmorStep={actions.stepArmorBy}
          dropTargets={dropTargets}
          onPlace={placeHeldItem}
          onDragItem={(zone, index) => {
            const item = getItem(build.loadout[zone][index]);
            if (item) setDragged({ item, origin: { zone, index } });
          }}
          onDragEnd={endDrag}
          onRemoveItem={removeMounted}
        />
      </main>

      {view.inventoryOpen && (
        <BtInventoryPanel
          build={build}
          side={view.editorSide}
          target={target}
          onClearTarget={clearTarget}
          pickedItem={pickedItem}
          onPick={setPickedItem}
          onEquip={equipInTarget}
          onQuickEquip={quickEquip}
          onDragStart={(item) => setDragged({ item })}
          onDragEnd={endDrag}
          onRemoveInstalled={(index) => activeZone && actions.remove(activeZone, index)}
          onToggleSide={view.toggleEditorSide}
          onClose={toggleInventory}
        />
      )}

      <BtAnalysis build={build} summary={summary} />

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
          Fan-made tool, not affiliated with or endorsed by Harebrained Schemes, Paradox Interactive or the BattleTech
          trademark holders. Game data belongs to its respective owners.
        </p>
      </footer>

      {isSharingImage && (
        <ShareImageDialog
          render={renderShareImage}
          fileName={`${mech.variant.replace(/[^a-z0-9-]+/gi, '_')}-build.png`}
          alt={`${getMechDisplayName(mech)} build`}
          buildUrl={buildUrl}
          onCopyLink={() => copyLink()}
          onMessage={showToast}
          onClose={closeShareImage}
        />
      )}
      {isFeedbackOpen && <FeedbackDialog buildUrl={buildUrl} onMessage={showToast} onClose={closeFeedback} />}
      {isPublishOpen && (
        <PublishBuildDialog
          game="battletech"
          code={buildCode}
          defaultName={editableBuild?.name ?? defaultName}
          onCopyLink={(url) => copyLink(url)}
          onClose={closePublish}
        />
      )}
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
          onClose={closeSave}
        />
      )}
      {isBuildsOpen && (
        <BtMyBuildsDialog
          saved={saved}
          currentCode={buildCode}
          hasUnsavedChanges={hasUnsavedChanges}
          activeId={activeSavedId}
          onActiveChange={setActiveSavedId}
          onLoad={(next, name) => {
            actions.loadBuild(next);
            setIsBuildsOpen(false);
            showToast(`Loaded “${name}”`);
          }}
          onCompare={(savedId) => {
            setCompareRequest(current => ({ savedId, count: (current?.count ?? 0) + 1 }));
            setIsBuildsOpen(false);
            setIsCompareOpen(true);
          }}
          onCopyLink={(code) => copyLink(getBtBuildUrl(code))}
          onMessage={showToast}
          onClose={closeBuilds}
        />
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} title={menu.title} entries={menu.entries} onClose={closeMenu} />}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          onDismiss={dismissToast}
          action={toast.undo && { label: 'Undo', onSelect: () => toast.undo && undoPlacement(toast.undo) }}
        />
      )}
    </div>
  );
}
