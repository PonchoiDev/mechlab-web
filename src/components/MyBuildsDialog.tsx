import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import type { useSavedBuilds } from '../hooks/useSavedBuilds';
import { decodeBuild, type SharedBuild } from '../utils/buildCode';
import { getBuildSummary } from '../utils/calculators';
import { getUpgrades } from '../utils/upgrades';
import { getMechDisplayName } from '../utils/mechs';
import { createExportFile, normalizeBuildName, parseImportFile, type SavedBuild } from '../utils/savedBuilds';

interface MyBuildsDialogProps {
  saved: ReturnType<typeof useSavedBuilds>;
  mechs: Mech[];
  catalog: Item[];
  currentCode: string;
  // La build abierta tiene equipo o armadura que no coincide con ninguna guardada.
  hasUnsavedChanges: boolean;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  onLoad: (build: SharedBuild, name: string) => void;
  onCopyLink: (code: string) => void;
  onMessage: (message: string) => void;
  onClose: () => void;
}

const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatDate = (iso: string) => dateFormat.format(new Date(iso));

const downloadFile = (content: string, fileName: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export function MyBuildsDialog({
  saved,
  mechs,
  catalog,
  currentCode,
  hasUnsavedChanges,
  activeId,
  onActiveChange,
  onLoad,
  onCopyLink,
  onMessage,
  onClose
}: MyBuildsDialogProps) {
  const { builds, storageFailed } = saved;
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; action: 'delete' | 'load' } | null>(null);
  const [duplicatedId, setDuplicatedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (duplicatedId) document.querySelector(`[data-build-id="${duplicatedId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [duplicatedId]);

  // Cada build se reconstruye para mostrar su mech y sus cifras con los datos actuales del juego.
  const rows = useMemo(() => builds.map(build => {
    const shared = decodeBuild(build.code, mechs, catalog);
    const summary = shared ? getBuildSummary(shared.mech, shared.loadout, shared.armor, getUpgrades(shared.upgrades)) : null;
    return { build, shared, summary };
  }), [builds, mechs, catalog]);

  const load = (build: SavedBuild, shared: SharedBuild) => {
    setConfirming(null);
    onActiveChange(build.id);
    onLoad(shared, build.name);
  };

  const requestLoad = (build: SavedBuild, shared: SharedBuild) => {
    if (hasUnsavedChanges && build.code !== currentCode) setConfirming({ id: build.id, action: 'load' });
    else load(build, shared);
  };

  // La copia queda en la lista, resaltada sobre la original, para renombrar o cargar la que se quiera.
  const duplicate = (build: SavedBuild) => {
    const copy = saved.duplicateBuild(build.id);
    if (!copy) return;
    setDuplicatedId(copy.id);
    onMessage(`Duplicated as “${copy.name}”`);
  };

  const remove = (build: SavedBuild) => {
    setConfirming(null);
    saved.deleteBuild(build.id);
    if (build.id === activeId) onActiveChange(null);
    onMessage(`Deleted “${build.name}”`);
  };

  const commitRename = () => {
    if (!editing) return;
    const build = builds.find(candidate => candidate.id === editing.id);
    if (build) saved.updateBuild(build.id, { name: normalizeBuildName(editing.name, build.name) });
    setEditing(null);
  };

  const exportBuilds = () => {
    downloadFile(createExportFile(builds), `mw-builder-mercs-builds-${new Date().toISOString().slice(0, 10)}.json`);
    onMessage(`Exported ${builds.length} ${builds.length === 1 ? 'build' : 'builds'}`);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    const result = parseImportFile(await file.text(), mechs, catalog);
    if (!result) {
      onMessage('That file is not a MW Builder builds export');
      return;
    }
    const { added, skipped } = saved.importBuilds(result.entries);
    const notes = [
      skipped > 0 ? `${skipped} already saved` : '',
      result.invalid > 0 ? `${result.invalid} not valid` : ''
    ].filter(Boolean);
    onMessage(`Imported ${added} ${added === 1 ? 'build' : 'builds'}${notes.length ? ` · ${notes.join(' · ')}` : ''}`);
  };

  return (
    <div className="share-dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog builds-dialog" role="dialog" aria-modal="true" aria-labelledby="builds-dialog-title">
        <header className="share-dialog-header">
          <h2 id="builds-dialog-title">My builds</h2>
          <button type="button" className="share-dialog-close" aria-label="Close" onClick={onClose}>✕</button>
        </header>

        <div className="builds-list-header">
          <span>{builds.length} SAVED</span>
          <span className="builds-list-actions">
            <button type="button" className="utility-button" onClick={() => fileInput.current?.click()}>Import</button>
            <button type="button" className="utility-button" disabled={builds.length === 0} onClick={exportBuilds}>Export all</button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
          </span>
        </div>

        <ul className="builds-list">
          {rows.length === 0 && (
            <li className="builds-empty">No saved builds yet. Use Save build in the toolbar, or import an exported file.</li>
          )}
          {rows.map(({ build, shared, summary }) => {
            const isConfirming = confirming?.id === build.id;
            return (
              <li
                key={build.id}
                className={['builds-item', build.id === activeId ? 'is-active' : '', build.id === duplicatedId ? 'is-new' : ''].filter(Boolean).join(' ')}
                data-build-id={build.id}
              >
                <div className="builds-item-info">
                  {editing?.id === build.id ? (
                    <input
                      className="builds-rename"
                      type="text"
                      value={editing.name}
                      maxLength={80}
                      aria-label="Build name"
                      autoFocus
                      onChange={(event) => setEditing({ id: build.id, name: event.target.value })}
                      onBlur={commitRename}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitRename();
                        if (event.key === 'Escape') {
                          event.stopPropagation();
                          setEditing(null);
                        }
                      }}
                    />
                  ) : (
                    <strong>{build.name}</strong>
                  )}
                  <span className="builds-item-meta">
                    {shared && summary
                      ? `${getMechDisplayName(shared.mech)} ${shared.mech.variant} · ${summary.totalWeight.toFixed(1)} / ${shared.mech.tonnageMax} t · ${summary.firepower} volley`
                      : 'This build can no longer be opened'}
                  </span>
                  <span className="builds-item-date">Saved {formatDate(build.savedAt)}</span>
                </div>

                {isConfirming ? (
                  <div className="builds-item-actions">
                    <span className="builds-confirm">
                      {confirming.action === 'delete' ? 'Delete this build?' : 'Current build is not saved. Load anyway?'}
                    </span>
                    <button type="button" className="utility-button" onClick={() => setConfirming(null)}>Cancel</button>
                    <button
                      type="button"
                      className={confirming.action === 'delete' ? 'utility-button is-danger' : 'utility-button utility-button-primary'}
                      onClick={() => confirming.action === 'delete' ? remove(build) : shared && load(build, shared)}
                    >
                      {confirming.action === 'delete' ? 'Delete' : 'Load'}
                    </button>
                  </div>
                ) : (
                  <div className="builds-item-actions">
                    <button
                      type="button"
                      className="utility-button utility-button-primary"
                      disabled={!shared}
                      onClick={() => shared && requestLoad(build, shared)}
                    >
                      Load
                    </button>
                    <button type="button" className="utility-button" onClick={() => duplicate(build)}>
                      Duplicate
                    </button>
                    <button type="button" className="utility-button" onClick={() => setEditing({ id: build.id, name: build.name })}>Rename</button>
                    <button type="button" className="utility-button" disabled={!shared} onClick={() => onCopyLink(build.code)}>Copy link</button>
                    <button type="button" className="utility-button" onClick={() => setConfirming({ id: build.id, action: 'delete' })}>Delete</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="share-dialog-hint">
          {storageFailed
            ? 'This browser is not letting the page store data, so builds will be lost when you close it. Export them to keep a copy.'
            : 'Builds are saved in this browser only. Export them to keep a backup or to move them to another device.'}
        </p>
      </section>
    </div>
  );
}
