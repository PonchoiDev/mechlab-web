import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  // Un botón en el aviso, como Undo tras reemplazar un arma.
  action?: { label: string; onSelect: () => void };
}

const TOAST_MS = 4500;
// Con un botón, el aviso dura más para dar tiempo a pulsarlo.
const TOAST_ACTION_MS = 8000;

export function Toast({ message, onDismiss, action }: ToastProps) {
  const hasAction = action !== undefined;
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, hasAction ? TOAST_ACTION_MS : TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, hasAction]);

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{message}</span>
      {action && <button type="button" className="toast-action" onClick={action.onSelect}>{action.label}</button>}
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDismiss}>✕</button>
    </div>
  );
}
