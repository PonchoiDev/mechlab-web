import { useCallback, useMemo, useState } from 'react';
import type { Zone } from '../../types/mech';
import type { BtBuild, BtItem } from '../../types/battletech-mechlab';
import { BuildStatus } from '../../components/BuildStatus';
import { ContextMenu, type MenuEntry } from '../../components/ContextMenu';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { SaveBuildDialog } from '../../components/SaveBuildDialog';
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
import { replaceItem } from '../../utils/battletech/actions';
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
import { BtComponentEditor } from './BtComponentEditor';
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

export function BtMechLabApp() {
  const actions = useBtBuild(linked?.build ?? createStockBuild(DEFAULT_MECH));
  const { build } = actions;
  const { mech } = build;
  const summary = useMemo(() => getBuildSummary(build), [build]);
  const readouts = useMemo(() => getBtReadouts(build), [build]);
  const issues = useMemo(() => getBtBuildIssues(build), [build]);
  // Ubicación con el panel abierto, como en el MechLab de MW5: se abre al pulsar una tarjeta.
  const [activeZone, setActiveZone] = useState<Zone | null>(null);
  const [selectedHardpoint, setSelectedHardpoint] = useState<number | null>(null);
  const selectZone = (zone: Zone, hardpointIndex: number | null = null) => {
    setActiveZone(zone);
    setSelectedHardpoint(hardpointIndex);
  };
  const closeEditor = useCallback(() => {
    setActiveZone(null);
    setSelectedHardpoint(null);
  }, []);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(() =>
    linked && !linked.build ? { id: 0, message: 'This build link is not valid' } : null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(openFeedbackOnLoad);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [isBuildsOpen, setIsBuildsOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [menu, setMenu] = useState<{ title: string; x: number; y: number; entries: MenuEntry[] } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const saved = useSavedBuilds(BT_SAVED_BUILDS_KEY);
  const view = useViewPreferences(BT_VIEW_KEY);

  const showToast = useCallback((message: string) => setToast({ id: Date.now(), message }), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const closeFeedback = useCallback(() => setIsFeedbackOpen(false), []);
  const closeSave = useCallback(() => setIsSaveOpen(false), []);
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
  const copyLink = async (url = buildUrl) => showToast(await copyText(url) ? 'Build link copied' : 'Could not copy the link');
  const renderShareImage = useCallback(() => renderBtBuildImage(build), [build]);
  const closeShareImage = useCallback(() => setIsSharingImage(false), []);

  return (
    <div className={['mechlab-shell', 'bt-mechlab', activeZone ? `has-editor is-editor-${view.editorSide}` : ''].filter(Boolean).join(' ')}>
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
        onToggleCompare={() => setIsCompareOpen(open => !open)}
        savedBuildCount={saved.builds.length}
        onSaveBuild={() => setIsSaveOpen(true)}
        onOpenBuilds={() => setIsBuildsOpen(true)}
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
          key={mech.id}
          mechs={BT_MECHS}
          current={build}
          savedBuilds={saved.builds}
          onLoad={(next, label, savedId) => {
            loadBuild(next, `Loaded ${savedId ? `“${label}”` : `the ${label} loadout`}`, savedId);
            setIsCompareOpen(false);
          }}
          onClose={closeCompare}
        />
      )}

      <main className="workspace">
        <div className="view-toggles" aria-label="View options">
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
            title="Side of the screen where the location panel opens"
            onClick={view.toggleEditorSide}
          >
            Panel {view.editorSide} ⇄
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
        />
      </main>

      {activeZone && (
        <BtComponentEditor
          key={activeZone}
          build={build}
          zone={activeZone}
          selectedHardpoint={selectedHardpoint}
          onSelectHardpoint={setSelectedHardpoint}
          onMount={(zone, item) => showToast(actions.mount(zone, item))}
          onReplace={(zone, index, item) => menuContext.run(current => replaceItem(mech, current, zone, index, item))}
          onRemove={actions.remove}
          onArmorChange={actions.changeArmor}
          onArmorStep={actions.stepArmorBy}
          onClose={closeEditor}
          side={view.editorSide}
          onToggleSide={view.toggleEditorSide}
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
          onCopyLink={(code) => copyLink(getBtBuildUrl(code))}
          onMessage={showToast}
          onClose={closeBuilds}
        />
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} title={menu.title} entries={menu.entries} onClose={closeMenu} />}
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  );
}
