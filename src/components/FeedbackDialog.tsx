import { useEffect, useState } from 'react';

const FEEDBACK_URL = `${import.meta.env.BASE_URL}api/feedback`;
const CATEGORIES = ['Bug', 'Wrong game data', 'Idea', 'Other'];

interface FeedbackDialogProps {
  // Enlace de la build abierta, que se puede adjuntar para reproducir un fallo.
  buildUrl: string | null;
  onMessage: (message: string) => void;
  onClose: () => void;
}

type SendState = 'idle' | 'sending' | 'failed' | 'unavailable';

export function FeedbackDialog({ buildUrl, onMessage, onClose }: FeedbackDialogProps) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [attachBuild, setAttachBuild] = useState(buildUrl !== null);
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<SendState>('idle');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const send = async () => {
    setState('sending');
    try {
      const response = await fetch(FEEDBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message, contact, website, buildUrl: attachBuild ? buildUrl : '' })
      });
      // 503: el envío de correo aún no está configurado en Cloudflare.
      if (response.status === 503) {
        setState('unavailable');
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      onMessage('Thanks! Your message was sent');
      onClose();
    } catch {
      setState('failed');
    }
  };

  const canSend = message.trim().length >= 5 && state !== 'sending';

  return (
    <div className="share-dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
        <header className="share-dialog-header">
          <h2 id="feedback-dialog-title">Send feedback</h2>
          <button type="button" className="share-dialog-close" aria-label="Close" onClick={onClose}>✕</button>
        </header>

        <form
          className="feedback-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend) send();
          }}
        >
          <p className="share-dialog-hint">
            Found a bug, a wrong number or have an idea? Tell me here. Messages go straight to the developer.
          </p>

          <span className="builds-save-label" id="feedback-topic">TOPIC</span>
          <div className="feedback-categories" role="radiogroup" aria-labelledby="feedback-topic">
            {CATEGORIES.map(option => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={category === option}
                className={category === option ? 'utility-button utility-button-primary' : 'utility-button'}
                onClick={() => setCategory(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <label className="builds-save-label" htmlFor="feedback-message">MESSAGE</label>
          <textarea
            id="feedback-message"
            value={message}
            maxLength={4000}
            rows={6}
            autoFocus
            placeholder="What happened, or what would you like to see?"
            onChange={(event) => setMessage(event.target.value)}
          />

          <label className="builds-save-label" htmlFor="feedback-contact">CONTACT (OPTIONAL)</label>
          <input
            id="feedback-contact"
            type="text"
            value={contact}
            maxLength={200}
            placeholder="Email or Reddit username, if you want an answer"
            onChange={(event) => setContact(event.target.value)}
          />

          {/* Campo trampa: invisible para las personas, los bots suelen rellenarlo. */}
          <input
            className="feedback-trap"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />

          {buildUrl && (
            <label className="feedback-attach">
              <input type="checkbox" checked={attachBuild} onChange={(event) => setAttachBuild(event.target.checked)} />
              Attach a link to the current build
            </label>
          )}

          {state === 'failed' && (
            <p className="feedback-error">The message could not be sent. Please try again in a moment.</p>
          )}
          {state === 'unavailable' && (
            <p className="feedback-error">Feedback is not available right now. Please try again later.</p>
          )}

          <footer className="share-dialog-actions">
            <button type="button" className="utility-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="utility-button utility-button-primary" disabled={!canSend}>
              {state === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
