import { useEffect, useMemo } from 'react';
import { useBuildListFilters } from '../hooks/useBuildListFilters';
import type { SavedBuild } from '../utils/savedBuildsCore';
import { showBuildEntries, type BuildListConfig } from '../utils/savedBuildsList';
import { BuildsListControls } from './BuildsListControls';
import { BuildTagList } from './BuildTagList';
import type { PublishedBuildSummary } from './PublishedBuildsPage';
import { WeaponTypeCounts } from './WeaponTypeCounts';

interface SavedBuildsPublishDialogProps {
  entries: { build: SavedBuild; summary: PublishedBuildSummary }[];
  config: BuildListConfig;
  // El orden se recuerda con la misma clave que My builds en el MechLab.
  sortKey: string;
  // Códigos de las builds ya publicadas desde este navegador.
  publishedCodes: Set<string>;
  buildUrl: (code: string) => string;
  mechlabUrl: string;
  onPublish: (build: SavedBuild) => void;
  onClose: () => void;
}

// My builds desde la página de builds: las builds guardadas en este navegador, para publicarlas sin entrar en el
// MechLab. Guardarlas, renombrarlas o borrarlas sigue siendo cosa del MechLab.
export function SavedBuildsPublishDialog({ entries, config, sortKey, publishedCodes, buildUrl, mechlabUrl, onPublish, onClose }: SavedBuildsPublishDialogProps) {
  const filters = useBuildListFilters(sortKey);
  // Los mismos buscador, filtros y orden que My builds en el MechLab.
  const rows = useMemo(() => entries.map(entry => ({ ...entry, listRow: entry.summary.listRow })), [entries]);
  const listRows = useMemo(() => rows.map(row => row.listRow), [rows]);
  const shown = useMemo(() => showBuildEntries(rows, filters.filter, filters.sort), [rows, filters.filter, filters.sort]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="share-dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog builds-dialog" role="dialog" aria-modal="true" aria-labelledby="saved-builds-title">
        <header className="share-dialog-header">
          <h2 id="saved-builds-title">My builds</h2>
          <button type="button" className="share-dialog-close" aria-label="Close" onClick={onClose}>✕</button>
        </header>

        <div className="builds-list-header">
          <span>{shown.length === entries.length ? entries.length : `${shown.length} of ${entries.length}`} SAVED</span>
        </div>

        <BuildsListControls state={filters} config={config} rows={listRows} />

        <ul className="builds-list">
          {entries.length === 0 && (
            <li className="builds-empty">
              No saved builds in this browser yet. Save them in the MechLab with Save build.
              <br />
              <a className="utility-button utility-button-primary" href={mechlabUrl}>Open the MechLab</a>
            </li>
          )}
          {entries.length > 0 && shown.length === 0 && (
            <li className="builds-empty">
              No saved builds match these filters.
              <br />
              <button type="button" className="utility-button" onClick={filters.clear}>Clear filters</button>
            </li>
          )}
          {shown.map(({ build, summary }) => {
            const isPublished = publishedCodes.has(build.code);
            return (
              <li key={build.id} className="builds-item">
                <div className="builds-item-info">
                  <strong>
                    {build.name}
                    {isPublished && <span className="published-own">PUBLISHED</span>}
                  </strong>
                  <span className="builds-item-meta">{summary.meta}</span>
                  {summary.canOpen && (
                    <span className="builds-item-loadout">
                      <WeaponTypeCounts counts={summary.weaponCounts} short={config.weaponShort} labels={config.weaponLabels} />
                      <BuildTagList tags={summary.tags} />
                    </span>
                  )}
                </div>
                <div className="builds-item-actions">
                  <button
                    type="button"
                    className={isPublished ? 'utility-button' : 'utility-button utility-button-primary'}
                    disabled={!summary.canOpen}
                    title={isPublished ? 'Already published from this browser. Publish it again as a new build' : 'Publish this build in the community builds'}
                    onClick={() => onPublish(build)}
                  >
                    Publish
                  </button>
                  {summary.canOpen && <a className="utility-button" href={buildUrl(build.code)}>Open</a>}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="share-dialog-hint">
          Builds saved in this browser. Save, rename or delete them in the MechLab.
        </p>
      </section>
    </div>
  );
}
