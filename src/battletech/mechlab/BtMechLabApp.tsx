import { useCallback, useMemo, useState } from 'react';
import type { Zone } from '../../types/mech';
import type { BtBuild, BtItem } from '../../types/battletech-mechlab';
import { BuildStatus } from '../../components/BuildStatus';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { SaveBuildDialog } from '../../components/SaveBuildDialog';
import { SupportLink } from '../../components/SupportLink';
import { Toast } from '../../components/Toast';
import { WhatsNew } from '../../components/WhatsNew';
import { useSavedBuilds } from '../../hooks/useSavedBuilds';
import { copyText } from '../../services/clipboard';
import { normalizeBuildName } from '../../utils/savedBuildsCore';
import { decodeBtBuild, DEFAULT_MECH, encodeBtBuild, getBtBuildUrl, readBtBuildFromLocation } from '../../utils/battletech/buildCode';
import { createStockBuild } from '../../utils/battletech/fitting';
import { getBtBuildIssues } from '../../utils/battletech/issues';
import { BT_MECHS, getItem, getMechDisplayName } from '../../utils/battletech/mechlabData';
import { BT_SAVED_BUILDS_KEY } from '../../utils/battletech/savedBuilds';
import { getBuildSummary } from '../../utils/battletech/stats';
import { BtAnalysis } from './BtAnalysis';
import { BtBoard } from './BtBoard';
import { BtComparePanel } from './BtComparePanel';
import { BtComponentEditor } from './BtComponentEditor';
import { BtMechPicker } from './BtMechPicker';
import { BtMyBuildsDialog } from './BtMyBuildsDialog';
import { useBtBuild } from './useBtBuild';

// Se lee una sola vez al cargar la página: la dirección queda limpia después.
const linked = readBtBuildFromLocation();
const formatNumber = (value: number) => String(Number(value.toFixed(2)));
const formatCost = (value: number) => value.toLocaleString('en');

export function BtMechLabApp() {
  const actions = useBtBuild(linked?.build ?? createStockBuild(DEFAULT_MECH));
  const { build } = actions;
  const { mech } = build;
  const summary = useMemo(() => getBuildSummary(build), [build]);
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
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isBuildsOpen, setIsBuildsOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const saved = useSavedBuilds(BT_SAVED_BUILDS_KEY);

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
  const copyLink = async (url = buildUrl) => showToast(await copyText(url) ? 'Build link copied' : 'Could not copy the link');

  return (
    <div className={['mechlab-shell', 'bt-mechlab', activeZone ? 'has-editor is-editor-right' : ''].filter(Boolean).join(' ')}>
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
            <a href="/battletech/starmap/">Star map</a>
            <a href="/battletech/argo/">Argo</a>
          </nav>
        </div>
        <div className="topbar-tools">
          <WhatsNew />
          <button type="button" className="feedback-button" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
          <BtMechPicker
            mechs={BT_MECHS}
            current={mech}
            onSelect={(next) => {
              if (next.id !== mech.id) setActiveSavedId(null);
              actions.selectMech(next);
            }}
          />
        </div>
      </header>

      <section className="readout-strip bt-readout" aria-label="'Mech statistics">
        <div className="readout-cell">
          <span className="readout-label">TONNAGE</span>
          <strong className={summary.freeTonnage < 0 ? 'readout-warning' : ''}>{formatNumber(summary.tonnage)} <small>/ {mech.tonnage} t</small></strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">ARMOR</span>
          <strong>{summary.armorPoints} <small>/ {summary.maxArmorPoints} · {formatNumber(summary.armorTonnage)} t</small></strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">ALPHA DAMAGE</span>
          <strong>{formatNumber(summary.alphaDamage)}{summary.heatDamage > 0 && <small> +{summary.heatDamage} heat</small>}</strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">STABILITY DAMAGE</span>
          <strong>{formatNumber(summary.instability)}</strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label" title="Heat of an alpha strike against the heat the 'Mech sinks each turn">ALPHA HEAT / SINKING</span>
          <strong className={summary.heat.net > 0 ? 'readout-warning' : ''}>{formatNumber(summary.heat.alpha)} <small>/ {summary.heat.dissipation} per turn</small></strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label" title="Heat capacity, and the level where the 'Mech starts to overheat">MAX HEAT</span>
          <strong>{summary.heat.maxHeat} <small>overheat at {summary.heat.overheat}</small></strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">WALK / SPRINT</span>
          <strong>{summary.walk ?? '-'} <small>/ {summary.sprint ?? '-'} m</small></strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">JUMP JETS</span>
          <strong className={summary.jumpJets > summary.maxJumpJets ? 'readout-warning' : ''}>{summary.jumpJets} <small>/ {summary.maxJumpJets}</small></strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label">MAX RANGE</span>
          <strong>{summary.maxRange > 0 ? <>{summary.maxRange} <small>m</small></> : '-'}</strong>
        </div>
        <div className="readout-cell">
          <span className="readout-label" title="Chassis, mounted equipment and armor">VALUE</span>
          <strong>{formatCost(summary.cost)} <small>C-Bills</small></strong>
        </div>
      </section>

      <BuildStatus
        issues={issues}
        onSelectZone={(zone, hardpointIndex) => selectZone(zone, hardpointIndex)}
        readyMessage="No pending issues: every hardpoint is used, weapons have ammo, the heat is under control and no tonnage is left."
      />

      <section className="utility-toolbar bt-toolbar" aria-label="Build tools">
        <div className="utility-group">
          <span className="utility-label">LOADOUT</span>
          <button type="button" className="utility-button" disabled={buildCode === stockCode} onClick={() => { actions.loadStock(); showToast(`Loaded the stock ${mech.variant} loadout`); }}>Stock</button>
          <button type="button" className="utility-button" disabled={!hasKind('weapon')} onClick={() => actions.removeKinds(['weapon'])}>Remove weapons</button>
          <button type="button" className="utility-button" disabled={!hasKind('ammo')} onClick={() => actions.removeKinds(['ammo'])}>Remove ammo</button>
          <button type="button" className="utility-button" disabled={!hasKind('heatSink') && !hasKind('jumpJet') && !hasKind('upgrade')} onClick={() => actions.removeKinds(['heatSink', 'jumpJet', 'upgrade'])}>Remove equipment</button>
        </div>
        <div className="utility-group">
          <span className="utility-label">ARMOR</span>
          <button type="button" className="utility-button" title="Spread the free tonnage over the 'Mech like the in-game button" onClick={actions.distribute}>Distribute</button>
          <button type="button" className="utility-button" disabled={summary.armorPoints === 0} onClick={actions.clear}>Clear</button>
        </div>
        <div className="utility-group">
          <span className="utility-label">BUILD</span>
          <button type="button" className="utility-button" onClick={() => setIsSaveOpen(true)}>Save build</button>
          <button type="button" className="utility-button" onClick={() => setIsBuildsOpen(true)}>
            My builds{saved.builds.length > 0 && <span className="utility-count">{saved.builds.length}</span>}
          </button>
          <button type="button" className="utility-button" aria-pressed={isCompareOpen} onClick={() => setIsCompareOpen(open => !open)}>Compare</button>
          <button type="button" className="utility-button utility-button-primary" onClick={() => copyLink()}>Copy link</button>
        </div>
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
        <BtBoard
          build={build}
          activeZone={activeZone}
          selectedHardpoint={selectedHardpoint}
          onSelectZone={selectZone}
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
          onRemove={actions.remove}
          onArmorChange={actions.changeArmor}
          onArmorStep={actions.stepArmorBy}
          onClose={closeEditor}
        />
      )}

      <BtAnalysis summary={summary} />

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
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  );
}
