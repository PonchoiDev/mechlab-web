import { useSiteMode } from '../hooks/useSiteMode';
import { getSiteLinks, SITE_GAME_LABELS, type SiteGame, type SiteMode, type SitePage } from '../utils/siteNav';

interface SiteNavProps {
  game: SiteGame;
  current: SitePage;
  // La clase de la cabecera de cada tipo de página: units-links, topbar-links (MechLabs) o starmap-links (mapas).
  className: string;
  // Solo en las páginas de MW5 con versión YAML (MechLab y equipo): la versión que es la página, que pasa a ser
  // la de la cabecera en las demás.
  mode?: SiteMode;
}

// Los enlaces de la cabecera a las páginas del juego, iguales en todas: la actual sale en su sitio, marcada.
export function SiteNav({ game, current, className, mode }: SiteNavProps) {
  const siteMode = useSiteMode(game === 'mercs' ? mode : undefined);
  return (
    <nav className={className} aria-label={game === 'mercs' ? 'MW Builder' : 'BATTLETECH'}>
      {getSiteLinks(game, siteMode).map((link, index) => (
        <a key={link.id} href={link.href} aria-current={link.id === current ? 'page' : undefined}>
          {index === 0 && <small>{SITE_GAME_LABELS[game]}</small>}
          {index === 0 && ' '}
          {link.label}
          {link.yaml && <span className="site-nav-mod">YAML</span>}
        </a>
      ))}
    </nav>
  );
}
