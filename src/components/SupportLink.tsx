const KOFI_URL = 'https://ko-fi.com/ponchoidev';

interface SupportLinkProps {
  // Compacto para la cabecera; completo para el pie.
  compact?: boolean;
}

export function SupportLink({ compact = false }: SupportLinkProps) {
  return (
    <a
      className={compact ? 'support-link is-compact' : 'support-link'}
      href={KOFI_URL}
      target="_blank"
      rel="noreferrer"
      title="Life in the Inner Sphere is rough. Consider supporting this merc!"
    >
      <span className="support-link-icon" aria-hidden="true">☕</span> {compact ? 'Support' : 'Support on Ko-fi'}
    </a>
  );
}
