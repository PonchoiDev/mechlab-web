import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { BtBuild } from '../../types/battletech-mechlab';
import type { useSavedBuilds } from '../../hooks/useSavedBuilds';
import { normalizeBuildName, type SavedBuild } from '../../utils/savedBuildsCore';
import { decodeBtBuild } from '../../utils/battletech/buildCode';
import { getItem, getMechDisplayName } from '../../utils/battletech/mechlabData';
import { HARDPOINT_LABELS, HARDPOINT_SHORT, HARDPOINTS } from '../../utils/battletech/catalog';
import { getAllItems, getHardpointCount } from '../../utils/battletech/fitting';
import { createBtExportFile, parseBtImportFile } from '../../utils/battletech/savedBuilds';
import { getBuildSummary } from '../../utils/battletech/stats';
import { countBuildsByWeightClass, countWeaponTypes, filterBuildRows, sortBuildRows, type BuildListRow, type BuildMinimumsOf, type BuildWeightClass } from '../../utils/savedBuildsList';
import { getBtBuildTags } from '../../utils/battletech/buildTags';
import { BuildTagList } from '../../components/BuildTagList';
import { BT_BUILD_SORT_KEY, useBuildSort } from '../../hooks/useBuildSort';
import { BuildsListControls } from '../../components/BuildsListControls';
import { WeaponTypeCounts } from '../../components/WeaponTypeCounts';

interface BtMyBuildsDialogProps {
  saved: ReturnType<typeof useSavedBuilds>;
  currentCode: string;
  hasUnsavedChanges: boolean;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  onLoad: (build: BtBuild, name: string) => void;
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

// Las builds guardadas de BATTLETECH, con las mismas acciones que el diálogo de MW5.
// Los mismos contadores que el selector de 'Mechs de BATTLETECH.
const WEAPON_TYPE_LABELS = Object.fromEntries(HARDPOINTS.map(id => [id, HARDPOINT_LABELS[id].toLowerCase()]));
const HARDPOINT_TYPES = HARDPOINTS.map(id => ({ id, short: HARDPOINT_SHORT[id], label: HARDPOINT_LABELS[id].toLowerCase() }));

export function BtMyBuildsDialog({
  saved,
  currentCode,
  hasUnsavedChanges,
  activeId,
  onActiveChange,
  onLoad,
  onCopyLink,
  onMessage,
  onClose
}: BtMyBuildsDialogProps) {
  const { builds, storageFailed } = saved;
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; action: 'delete' | 'load' } | null>(null);
  const [duplicatedId, setDuplicatedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [weightClasses, setWeightClasses] = useState<BuildWeightClass[]>([]);
  const [minHardpoints, setMinHardpoints] = useState<Partial<Record<string, number>>>({});
  const [minimumsOf, setMinimumsOf] = useState<BuildMinimumsOf>('hardpoints');
  const [sort, setSort] = useBuildSort(BT_BUILD_SORT_KEY);
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

  const rows = useMemo(() => builds.map(build => {
    const decoded = decodeBtBuild(build.code);
    const summary = decoded ? getBuildSummary(decoded) : null;
    // La potencia de fuego de BATTLETECH es el daño de un ataque con todas las armas.
    const listRow: BuildListRow = {
      id: build.id,
      name: build.name,
      savedAt: build.savedAt,
      chassis: decoded?.mech.name ?? null,
      variant: decoded?.mech.variant ?? null,
      weightClass: decoded?.mech.weightClass ?? null,
      tonnage: summary?.tonnage ?? null,
      firepower: summary?.alphaDamage ?? null,
      hardpoints: decoded ? Object.fromEntries(HARDPOINTS.map(type => [type, getHardpointCount(decoded.mech, type)])) : null,
      weapons: null
    };
    // Solo las armas: la munición también tiene tipo de anclaje en BATTLETECH.
    const weaponCounts = decoded
      ? countWeaponTypes(Object.values(decoded.loadout).flat().map(getItem).filter(item => item?.kind === 'weapon').map(item => item?.hardpoint), HARDPOINTS)
      : [];
    if (decoded) listRow.weapons = Object.fromEntries(weaponCounts.map(({ type, count }) => [type, count]));
    const tags = decoded ? getBtBuildTags(getAllItems(decoded.mech, decoded.loadout)) : [];
    return { build, decoded, summary, listRow, weaponCounts, tags };
  }), [builds]);

  // Como en MW5: la copia recién duplicada se ve aunque el filtro la escondería.
  const shownRows = useMemo(() => {
    const listRows = rows.map(row => row.listRow);
    const shownIds = new Set(filterBuildRows(listRows, { query, weightClasses, minHardpoints, minimumsOf }).map(row => row.id));
    if (duplicatedId) shownIds.add(duplicatedId);
    const byId = new Map(rows.map(row => [row.build.id, row]));
    return sortBuildRows(listRows.filter(row => shownIds.has(row.id)), sort).map(row => byId.get(row.id)!);
  }, [rows, query, weightClasses, minHardpoints, minimumsOf, sort, duplicatedId]);
  const counts = useMemo(() => countBuildsByWeightClass(rows.map(row => row.listRow)), [rows]);
  const clearFilters = () => {
    setQuery('');
    setWeightClasses([]);
    setMinHardpoints({});
  };

  const load = (build: SavedBuild, decoded: BtBuild) => {
    setConfirming(null);
    onActiveChange(build.id);
    onLoad(decoded, build.name);
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
    const result = parseBtImportFile(await file.text());
    if (!result) {
      onMessage('That file is not a MW Builder export of BATTLETECH builds');
      return;
    }
    const { added, skipped } = saved.importBuilds(result.entries);
    const notes = [skipped > 0 ? `${skipped} already saved` : '', result.invalid > 0 ? `${result.invalid} not valid` : ''].filter(Boolean);
    onMessage(`Imported ${added} ${added === 1 ? 'build' : 'builds'}${notes.length ? ` · ${notes.join(' · ')}` : ''}`);
  };

  return (
    <div className="share-dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog builds-dialog" role="dialog" aria-modal="true" aria-labelledby="bt-builds-title">
        <header className="share-dialog-header">
          <h2 id="bt-builds-title">My builds</h2>
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
                downloadFile(createBtExportFile(builds), `mw-builder-battletech-builds-${new Date().toISOString().slice(0, 10)}.json`);
                onMessage(`Exported ${builds.length} ${builds.length === 1 ? 'build' : 'builds'}`);
              }}
            >
              Export all
            </button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
          </span>
        </div>

        {builds.length > 0 && (
          <BuildsListControls
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
            weightClasses={weightClasses}
            onWeightClassesChange={setWeightClasses}
            counts={counts}
            hardpointTypes={HARDPOINT_TYPES}
            minHardpoints={minHardpoints}
            minimumsOf={minimumsOf}
            onMinimumsOfChange={setMinimumsOf}
            onMinHardpointsChange={setMinHardpoints}
          />
        )}

        <ul className="builds-list">
          {rows.length === 0 && <li className="builds-empty">No saved builds yet. Use Save build in the toolbar, or import an exported file.</li>}
          {rows.length > 0 && shownRows.length === 0 && (
            <li className="builds-empty">
              No saved builds match these filters.
              <br />
              <button type="button" className="utility-button" onClick={clearFilters}>Clear filters</button>
            </li>
          )}
          {shownRows.map(({ build, decoded, summary, weaponCounts, tags }) => (
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
                  {decoded && summary
                    ? `${getMechDisplayName(decoded.mech)} · ${summary.tonnage} / ${decoded.mech.tonnage} t · ${summary.alphaDamage} alpha`
                    : 'This build can no longer be opened'}
                </span>
                {decoded && (
                  <span className="builds-item-loadout">
                    <WeaponTypeCounts counts={weaponCounts} short={HARDPOINT_SHORT} labels={WEAPON_TYPE_LABELS} />
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
            : 'Builds are saved in this browser only, apart from your MW5 builds. Export them to keep a backup or to move them to another device.'}
        </p>
      </section>
    </div>
  );
}
