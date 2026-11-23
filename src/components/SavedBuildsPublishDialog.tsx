import { useEffect } from 'react';
import type { SavedBuild } from '../utils/savedBuildsCore';
import type { BuildListConfig } from '../utils/savedBuildsList';
import { BuildTagList } from './BuildTagList';
import type { PublishedBuildSummary } from './PublishedBuildsPage';
import { WeaponTypeCounts } from './WeaponTypeCounts';

interface SavedBuildsPublishDialogProps {
  entries: { build: SavedBuild; summary: PublishedBuildSummary }[];
  config: BuildListConfig;
  // Códigos de las builds ya publicadas desde este navegador.
  publishedCodes: Set<string>;
  buildUrl: (code: string) => string;
  mechlabUrl: string;
  onPublish: (build: SavedBuild) => void;
  onClose: () => void;
}

// My builds desde la página de builds: las builds guardadas en este navegador, para publicarlas sin entrar en el
// MechLab. Guardarlas, renombrarlas o borrarlas sigue siendo cosa del MechLab.
export function SavedBuildsPublishDialog({ entries, config, publishedCodes, buildUrl, mechlabUrl, onPublish, onClose }: SavedBuildsPublishDialogProps) {
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
          <span>{entries.length} SAVED</span>
        </div>

        <ul className="builds-list">
          {entries.length === 0 && (
            <li className="builds-empty">
              No saved builds in this browser yet. Save them in the MechLab with Save build.
              <br />
              <a className="utility-button utility-button-primary" href={mechlabUrl}>Open the MechLab</a>
            </li>
          )}
          {entries.map(({ build, summary }) => {
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
