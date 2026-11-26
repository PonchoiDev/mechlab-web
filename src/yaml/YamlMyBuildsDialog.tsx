import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { YamlBuild, YamlMech } from '../types/yaml-mechlab';
import type { useSavedBuilds } from '../hooks/useSavedBuilds';
import { normalizeBuildName, type SavedBuild } from '../utils/savedBuildsCore';
import { createYamlExportFile, parseYamlImportFile } from '../utils/yaml/savedBuilds';
import { YAML_BUILD_LIST, summarizeYamlSavedBuild } from '../utils/yaml/savedBuildRows';
import { showBuildEntries } from '../utils/savedBuildsList';
import { BuildTagList } from '../components/BuildTagList';
import { YAML_BUILD_SORT_KEY } from '../hooks/useBuildSort';
import { useBuildListFilters } from '../hooks/useBuildListFilters';
import { BuildsListControls } from '../components/BuildsListControls';
import { WeaponTypeCounts } from '../components/WeaponTypeCounts';

interface YamlMyBuildsDialogProps {
  saved: ReturnType<typeof useSavedBuilds>;
  currentCode: string;
  hasUnsavedChanges: boolean;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  onLoad: (mech: YamlMech, build: YamlBuild, name: string) => void;
  onCopyLink: (code: string) => void;
  onMessage: (message: string) => void;
  onClose: () => void;
}

const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const downloadFile = (content: string, fileName: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

// Las builds guardadas del MechLab de YAML (docs/specs/builds-guardadas-yaml.md), con las acciones de los diálogos
// de MW5 y BATTLETECH salvo comparar y publicar, que el MechLab de YAML aún no tiene.
export function YamlMyBuildsDialog({
  saved,
  currentCode,
  hasUnsavedChanges,
  activeId,
  onActiveChange,
  onLoad,
  onCopyLink,
  onMessage,
  onClose
}: YamlMyBuildsDialogProps) {
  const { builds, storageFailed } = saved;
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; action: 'delete' | 'load' } | null>(null);
  const [duplicatedId, setDuplicatedId] = useState<string | null>(null);
  const filters = useBuildListFilters(YAML_BUILD_SORT_KEY);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // La copia queda resaltada sobre la original y a la vista, como en el diálogo de MW5.
  useEffect(() => {
    if (duplicatedId) document.querySelector(`[data-build-id="${duplicatedId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [duplicatedId]);

  const rows = useMemo(() => builds.map(build => summarizeYamlSavedBuild(build)), [builds]);
  const listRows = useMemo(() => rows.map(row => row.listRow), [rows]);
  // Como en MW5: la copia recién duplicada se ve aunque el filtro la escondería.
  const shownRows = useMemo(
    () => showBuildEntries(rows, filters.filter, filters.sort, duplicatedId),
    [rows, filters.filter, filters.sort, duplicatedId]
  );

  const load = (build: SavedBuild, decoded: { mech: YamlMech; build: YamlBuild }) => {
    setConfirming(null);
    onActiveChange(build.id);
    onLoad(decoded.mech, decoded.build, build.name);
  };

  const commitRename = () => {
    if (!editing) return;
    const build = builds.find(candidate => candidate.id === editing.id);
    if (build) saved.updateBuild(build.id, { name: normalizeBuildName(editing.name, build.name) });
    setEditing(null);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const result = parseYamlImportFile(await file.text());
    if (!result) {
      onMessage('That file is not a MW Builder export of YAML builds');
      return;
    }
    const { added, skipped } = saved.importBuilds(result.entries);
    const notes = [skipped > 0 ? `${skipped} already saved` : '', result.invalid > 0 ? `${result.invalid} not valid` : ''].filter(Boolean);
    onMessage(`Imported ${added} ${added === 1 ? 'build' : 'builds'}${notes.length ? ` · ${notes.join(' · ')}` : ''}`);
  };

  return (
    <div className="share-dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog builds-dialog" role="dialog" aria-modal="true" aria-labelledby="yaml-builds-title">
        <header className="share-dialog-header">
          <h2 id="yaml-builds-title">My builds</h2>
          <button type="button" className="share-dialog-close" aria-label="Close" onClick={onClose}>✕</button>
        </header>

        <div className="builds-list-header">
          <span>{shownRows.length === builds.length ? builds.length : `${shownRows.length} of ${builds.length}`} SAVED</span>
          <span className="builds-list-actions">
            <button type="button" className="utility-button" onClick={() => fileInput.current?.click()}>Import</button>
            <button
              type="button"
              className="utility-button"
              disabled={builds.length === 0}
              onClick={() => {
                downloadFile(createYamlExportFile(builds), `mw-builder-yaml-builds-${new Date().toISOString().slice(0, 10)}.json`);
                onMessage(`Exported ${builds.length} ${builds.length === 1 ? 'build' : 'builds'}`);
              }}
            >
              Export all
            </button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
          </span>
        </div>

        {builds.length > 0 && (
          <BuildsListControls state={filters} config={YAML_BUILD_LIST} rows={listRows} />
        )}

        <ul className="builds-list">
          {rows.length === 0 && <li className="builds-empty">No saved builds yet. Use Save build in the toolbar, or import an exported file.</li>}
          {rows.length > 0 && shownRows.length === 0 && (
            <li className="builds-empty">
              No saved builds match these filters.
              <br />
              <button type="button" className="utility-button" onClick={filters.clear}>Clear filters</button>
            </li>
          )}
          {shownRows.map(({ build, decoded, meta, weaponCounts, tags }) => (
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
                  {meta}
                </span>
                {decoded && (
                  <span className="builds-item-loadout">
                    <WeaponTypeCounts counts={weaponCounts} short={YAML_BUILD_LIST.weaponShort} labels={YAML_BUILD_LIST.weaponLabels} />
                    <BuildTagList tags={tags} />
                  </span>
                )}
                <span className="builds-item-date">Saved {dateFormat.format(new Date(build.savedAt))}</span>
              </div>

              {confirming?.id === build.id ? (
                <div className="builds-item-actions">
                  <span className="builds-confirm">{confirming.action === 'delete' ? 'Delete this build?' : 'Current build is not saved. Load anyway?'}</span>
                  <button type="button" className="utility-button" onClick={() => setConfirming(null)}>Cancel</button>
                  <button
                    type="button"
                    className={confirming.action === 'delete' ? 'utility-button is-danger' : 'utility-button utility-button-primary'}
                    onClick={() => {
                      if (confirming.action === 'load') {
                        if (decoded) load(build, decoded);
                        return;
                      }
                      setConfirming(null);
                      saved.deleteBuild(build.id);
                      if (build.id === activeId) onActiveChange(null);
                      onMessage(`Deleted “${build.name}”`);
                    }}
                  >
                    {confirming.action === 'delete' ? 'Delete' : 'Load'}
                  </button>
                </div>
              ) : (
                <div className="builds-item-actions">
                  <button
                    type="button"
                    className="utility-button utility-button-primary"
                    disabled={!decoded}
                    onClick={() => {
                      if (!decoded) return;
                      if (hasUnsavedChanges && build.code !== currentCode) setConfirming({ id: build.id, action: 'load' });
                      else load(build, decoded);
                    }}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="utility-button"
                    onClick={() => {
                      const copy = saved.duplicateBuild(build.id);
                      if (!copy) return;
                      setDuplicatedId(copy.id);
                      onMessage(`Duplicated as “${copy.name}”`);
                    }}
                  >
                    Duplicate
                  </button>
                  <button type="button" className="utility-button" onClick={() => setEditing({ id: build.id, name: build.name })}>Rename</button>
                  <button type="button" className="utility-button" disabled={!decoded} onClick={() => onCopyLink(build.code)}>Copy link</button>
                  <button type="button" className="utility-button" onClick={() => setConfirming({ id: build.id, action: 'delete' })}>Delete</button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <p className="share-dialog-hint">
          {storageFailed
            ? 'This browser is not letting the page store data, so builds will be lost when you close it. Export them to keep a copy.'
            : 'Builds are saved in this browser only, apart from your MW5 and BATTLETECH builds. Export them to keep a backup or to move them to another device.'}
        </p>
      </section>
    </div>
  );
}
