import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

const TOAST_MS = 4500;

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDismiss}>✕</button>
    </div>
  );
}
