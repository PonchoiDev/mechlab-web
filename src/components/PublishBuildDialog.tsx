import { useEffect, useState } from 'react';
import {
  BUILD_AUTHOR_MAX,
  BUILD_DESCRIPTION_MAX,
  BUILD_NAME_MAX,
  getBuildsPageUrl,
  publishBuild,
  readAuthor,
  saveAuthor,
  saveOwnedKey,
  type BuildGame,
  type PublishedBuild
} from '../utils/publishedBuilds';

interface PublishBuildDialogProps {
  game: BuildGame;
  code: string;
  defaultName: string;
  onCopyLink: (url: string) => void;
  onClose: () => void;
}

// Publica la build abierta en la página de builds del juego. Es común a los dos MechLabs: solo cambia el juego.
export function PublishBuildDialog({ game, code, defaultName, onCopyLink, onClose }: PublishBuildDialogProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState(readAuthor);
  const [status, setStatus] = useState<{ sending: boolean; error: string | null }>({ sending: false, error: null });
  const [published, setPublished] = useState<PublishedBuild | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const submit = async () => {
    setStatus({ sending: true, error: null });
    const result = await publishBuild(game, code, { name: name.trim() || defaultName, description, author });
    if (!result.ok) {
      setStatus({ sending: false, error: result.message });
      return;
    }
    saveOwnedKey(game, result.data.build.id, result.data.editKey);
    saveAuthor(author);
    setPublished(result.data.build);
    setStatus({ sending: false, error: null });
  };

  const pageUrl = published ? getBuildsPageUrl(game, { build: published.id }) : '';

  return (
    <div className="share-dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog publish-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title">
        <header className="share-dialog-header">
          <h2 id="publish-dialog-title">Publish build</h2>
          <button type="button" className="share-dialog-close" aria-label="Close" onClick={onClose}>✕</button>
        </header>

        {published ? (
          <div className="builds-save">
            <span className="builds-save-label">PUBLISHED</span>
            <p className="publish-done">
              <strong>{published.name}</strong> is now in the community builds. You can edit or delete it from this browser.
            </p>
            <div className="publish-actions">
              <button type="button" className="utility-button" onClick={() => onCopyLink(new URL(pageUrl, window.location.origin).href)}>
                Copy link
              </button>
              <a className="utility-button utility-button-primary" href={pageUrl}>View in Builds</a>
            </div>
          </div>
        ) : (
          <form
            className="builds-save publish-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!status.sending) submit();
            }}
          >
            <label className="builds-save-label" htmlFor="publish-name">BUILD NAME</label>
            <input
              id="publish-name"
              type="text"
              value={name}
              maxLength={BUILD_NAME_MAX}
              placeholder={defaultName}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setName(event.target.value)}
            />
            <label className="builds-save-label" htmlFor="publish-description">DESCRIPTION (OPTIONAL)</label>
            <textarea
              id="publish-description"
              value={description}
              maxLength={BUILD_DESCRIPTION_MAX}
              rows={4}
              placeholder="How to play it, what it is good at"
              onChange={(event) => setDescription(event.target.value)}
            />
            <label className="builds-save-label" htmlFor="publish-author">AUTHOR (OPTIONAL)</label>
            <input
              id="publish-author"
              type="text"
              value={author}
              maxLength={BUILD_AUTHOR_MAX}
              placeholder="Your name or callsign"
              onChange={(event) => setAuthor(event.target.value)}
            />
            {status.error && <p className="publish-error" role="alert">{status.error}</p>}
            <div className="publish-actions">
              <button type="button" className="utility-button" onClick={onClose}>Cancel</button>
              <button type="submit" className="utility-button utility-button-primary" disabled={status.sending}>
                {status.sending ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </form>
        )}

        <p className="share-dialog-hint">
          Published builds are public: anyone can see, open and vote them. Only this browser can edit or delete yours.
        </p>
      </section>
    </div>
  );
}
