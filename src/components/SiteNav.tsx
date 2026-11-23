import { getSiteLinks, SITE_GAME_LABELS, type SiteGame, type SitePage } from '../utils/siteNav';

interface SiteNavProps {
  game: SiteGame;
  current: SitePage;
  // La clase de la cabecera de cada tipo de página: units-links, topbar-links (MechLabs) o starmap-links (mapas).
  className: string;
}

// Los enlaces de la cabecera a las páginas del juego, iguales en todas: la actual sale en su sitio, marcada.
export function SiteNav({ game, current, className }: SiteNavProps) {
  return (
    <nav className={className} aria-label={game === 'mercs' ? 'MW Builder' : 'BATTLETECH'}>
      {getSiteLinks(game).map((link, index) => (
        <a key={link.id} href={link.href} aria-current={link.id === current ? 'page' : undefined}>
          {index === 0 && <small>{SITE_GAME_LABELS[game]}</small>}
          {index === 0 && ' '}
          {link.label}
        </a>
      ))}
    </nav>
  );
}
