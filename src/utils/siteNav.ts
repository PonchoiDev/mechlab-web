// Las páginas de cada juego, en el orden de su lista de herramientas en la portada (site/index.html; un test lo
// comprueba). Todas las cabeceras enlazan a todas, con la actual marcada en su sitio: antes cada página llevaba
// su lista a mano, unas se incluían a sí mismas y otras no, y el orden cambiaba de una a otra.
export type SiteGame = 'mercs' | 'battletech';

export type SitePage = 'mechlab' | 'builds' | 'chassis' | 'campaigns' | 'flashpoints' | 'starmap' | 'units' | 'pilots' | 'argo' | 'equipment';

// Con qué versión de MW5 se trabaja: la del juego o la del mod YAML. Se recuerda en el navegador para que la
// cabecera de las demás páginas devuelva al MechLab y al equipo de esa versión, y no siempre a los del juego.
export type SiteMode = 'vanilla' | 'yaml';

export const SITE_MODE_KEY = 'mw-builder:mercs-mode';

export const parseSiteMode = (value: string | null): SiteMode => value === 'yaml' ? 'yaml' : 'vanilla';

export interface SiteLink {
  id: SitePage;
  href: string;
  label: string;
  // El enlace lleva a la versión YAML de la página.
  yaml?: boolean;
}

// Las páginas de MW5 que tienen versión YAML.
const YAML_HREFS: Partial<Record<SitePage, string>> = { mechlab: '/mercs/yaml/', equipment: '/mercs/yaml/equipment/' };

const PAGES: Record<SiteGame, [SitePage, string][]> = {
  mercs: [
    ['mechlab', 'MechLab'],
    ['builds', 'Builds'],
    ['chassis', 'Chassis'],
    ['equipment', 'Equipment'],
    ['campaigns', 'HRQ & Campaigns'],
    ['starmap', 'Star map'],
    ['units', 'Enemy units'],
    ['pilots', 'Pilots']
  ],
  battletech: [
    ['mechlab', 'MechLab'],
    ['builds', 'Builds'],
    ['chassis', 'Chassis'],
    ['equipment', 'Equipment'],
    ['flashpoints', 'Flashpoints'],
    ['starmap', 'Star map'],
    ['units', 'Enemy units'],
    ['argo', 'Argo']
  ]
};

export const SITE_GAME_LABELS: Record<SiteGame, string> = { mercs: 'MW5 Mercenaries', battletech: 'BATTLETECH' };

export const getSiteLinks = (game: SiteGame, mode: SiteMode = 'vanilla'): SiteLink[] =>
  PAGES[game].map(([id, label]) => {
    const yamlHref = game === 'mercs' && mode === 'yaml' ? YAML_HREFS[id] : undefined;
    if (yamlHref) return { id, label, href: yamlHref, yaml: true };
    return { id, label, href: id === 'mechlab' ? `/${game}/` : `/${game}/${id}/` };
  });
