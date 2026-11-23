// Las páginas de cada juego, en el orden de su lista de herramientas en la portada (site/index.html; un test lo
// comprueba). Todas las cabeceras enlazan a todas, con la actual marcada en su sitio: antes cada página llevaba
// su lista a mano, unas se incluían a sí mismas y otras no, y el orden cambiaba de una a otra.
export type SiteGame = 'mercs' | 'battletech';

export type SitePage = 'mechlab' | 'builds' | 'chassis' | 'campaigns' | 'flashpoints' | 'starmap' | 'units' | 'pilots' | 'argo' | 'equipment';

export interface SiteLink {
  id: SitePage;
  href: string;
  label: string;
}

const PAGES: Record<SiteGame, [SitePage, string][]> = {
  mercs: [
    ['mechlab', 'MechLab'],
    ['builds', 'Builds'],
    ['chassis', 'Chassis'],
    ['campaigns', 'HRQ & Campaigns'],
    ['starmap', 'Star map'],
    ['units', 'Enemy units'],
    ['pilots', 'Pilots'],
    ['equipment', 'Equipment']
  ],
  battletech: [
    ['mechlab', 'MechLab'],
    ['builds', 'Builds'],
    ['chassis', 'Chassis'],
    ['flashpoints', 'Flashpoints'],
    ['starmap', 'Star map'],
    ['units', 'Enemy units'],
    ['argo', 'Argo'],
    ['equipment', 'Equipment']
  ]
};

export const SITE_GAME_LABELS: Record<SiteGame, string> = { mercs: 'MW5 Mercenaries', battletech: 'BATTLETECH' };

export const getSiteLinks = (game: SiteGame): SiteLink[] =>
  PAGES[game].map(([id, label]) => ({ id, label, href: id === 'mechlab' ? `/${game}/` : `/${game}/${id}/` }));
