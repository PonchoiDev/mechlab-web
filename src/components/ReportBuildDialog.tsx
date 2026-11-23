import { useEffect, useState } from 'react';
import { REPORT_MESSAGE_MAX, REPORT_REASONS, type ReportReason } from '../utils/publishedBuilds';

interface ReportBuildDialogProps {
  buildName: string;
  sending: boolean;
  onReport: (reason: ReportReason, message: string) => void;
  onClose: () => void;
}

// Denunciar una build publicada, como el feedback: el motivo y, si se quiere, un mensaje que lo explique.
// Los dos llegan en el aviso por correo al dueño de la web.
export function ReportBuildDialog({ buildName, sending, onReport, onClose }: ReportBuildDialogProps) {
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="share-dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
        <header className="share-dialog-header">
          <h2 id="report-dialog-title">Report build</h2>
          <button type="button" className="share-dialog-close" aria-label="Close" onClick={onClose}>✕</button>
        </header>

        <form
          className="feedback-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!sending) onReport(reason, message);
          }}
        >
          <p className="share-dialog-hint">
            Report <strong>{buildName}</strong> if it should not be here. It is hidden for you, and the report goes straight to the
            developer. Builds with several reports are hidden for everyone.
          </p>

          <span className="builds-save-label" id="report-reason">REASON</span>
          <div className="feedback-categories" role="radiogroup" aria-labelledby="report-reason">
            {REPORT_REASONS.map(option => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={reason === option}
                className={reason === option ? 'utility-button utility-button-primary' : 'utility-button'}
                onClick={() => setReason(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <label className="builds-save-label" htmlFor="report-message">MESSAGE (OPTIONAL)</label>
          <textarea
            id="report-message"
            value={message}
            maxLength={REPORT_MESSAGE_MAX}
            rows={4}
            autoFocus
            placeholder="What is wrong with this build?"
            onChange={(event) => setMessage(event.target.value)}
          />

          <footer className="share-dialog-actions">
            <button type="button" className="utility-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="utility-button is-danger" disabled={sending}>
              {sending ? 'Sending…' : 'Report'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
