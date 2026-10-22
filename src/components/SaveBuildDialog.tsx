import { useEffect, useState } from 'react';
import type { SavedBuild } from '../utils/savedBuilds';

interface SaveBuildDialogProps {
  defaultName: string;
  // Build guardada que se está editando: solo existe si se abrió o guardó en el chasis actual.
  activeBuild: SavedBuild | null;
  isActiveUpToDate: boolean;
  onSaveNew: (name: string) => void;
  onUpdate: () => void;
  onClose: () => void;
}

export function SaveBuildDialog({ defaultName, activeBuild, isActiveUpToDate, onSaveNew, onUpdate, onClose }: SaveBuildDialogProps) {
  const [name, setName] = useState(activeBuild ? `${activeBuild.name} (copy)` : defaultName);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="share-dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-dialog-title">
        <header className="share-dialog-header">
          <h2 id="save-dialog-title">Save build</h2>
          <button type="button" className="share-dialog-close" aria-label="Close" onClick={onClose}>✕</button>
        </header>

        {activeBuild && (
          <div className="builds-save">
            <span className="builds-save-label">EDITING SAVED BUILD</span>
            <div className="builds-active">
              <strong>{activeBuild.name}</strong>
              {isActiveUpToDate ? (
                <span>No changes since it was saved.</span>
              ) : (
                <button type="button" className="utility-button utility-button-primary" onClick={onUpdate}>
                  Update “{activeBuild.name}”
                </button>
              )}
            </div>
          </div>
        )}

        <form
          className="builds-save"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveNew(name);
          }}
        >
          <label className="builds-save-label" htmlFor="build-name">{activeBuild ? 'OR SAVE AS A NEW BUILD' : 'BUILD NAME'}</label>
          <div className="builds-save-row">
            <input
              id="build-name"
              type="text"
              value={name}
              maxLength={80}
              placeholder={defaultName}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" className={activeBuild ? 'utility-button' : 'utility-button utility-button-primary'}>Save as new</button>
          </div>
        </form>

        <p className="share-dialog-hint">Saved builds stay in this browser. Manage, export or import them from My builds.</p>
      </section>
    </div>
  );
}
