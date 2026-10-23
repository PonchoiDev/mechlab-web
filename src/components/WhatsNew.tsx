import { useEffect, useRef, useState } from 'react';
import { CHANGELOG } from '../data/changelog';

const STORAGE_KEY = 'mw-builder:mercs:last-seen-update';

const readLastSeen = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// Campana de novedades: muestra un punto hasta que se abre después de la última entrada.
export function WhatsNew() {
  const [isOpen, setIsOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(readLastSeen);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const latestId = CHANGELOG[0]?.id ?? null;
  const hasUnread = latestId !== null && latestId !== lastSeen;

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggle = () => {
    if (!isOpen && latestId) {
      setLastSeen(latestId);
      try {
        window.localStorage.setItem(STORAGE_KEY, latestId);
      } catch {
        // Sin almacenamiento, el punto volverá a salir en la próxima visita.
      }
    }
    setIsOpen(current => !current);
  };

  return (
    <div className="whats-new" ref={rootRef}>
      <button
        type="button"
        className={hasUnread ? 'whats-new-button has-unread' : 'whats-new-button'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={hasUnread ? "What's new (new updates)" : "What's new"}
        title="What's new"
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <path
            d="M12 3a6 6 0 0 0-6 6v3.6L4.4 15.4A1 1 0 0 0 5.3 17h13.4a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6Zm-2.5 15.5a2.5 2.5 0 0 0 5 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {hasUnread && <span className="whats-new-dot" aria-hidden="true" />}
      </button>

      {isOpen && (
        <section className="whats-new-panel" role="dialog" aria-label="What's new">
          <header className="whats-new-header">
            <h2>What's new</h2>
          </header>
          <ol className="whats-new-list">
            {CHANGELOG.map(entry => (
              <li key={entry.id} className="whats-new-entry">
                <time dateTime={entry.date}>{dateFormat.format(new Date(entry.date))}</time>
                <h3>{entry.title}</h3>
                <ul>
                  {entry.items.map(item => <li key={item}>{item}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
