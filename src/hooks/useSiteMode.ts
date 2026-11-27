import { useEffect, useState } from 'react';
import { parseSiteMode, SITE_MODE_KEY, type SiteMode } from '../utils/siteNav';

const readSiteMode = (): SiteMode => {
  try {
    return parseSiteMode(window.localStorage.getItem(SITE_MODE_KEY));
  } catch {
    return 'vanilla';
  }
};

// El modo de la cabecera. Las páginas que tienen versión YAML (MechLab y equipo) lo fijan al abrirse; las demás
// usan el que se guardó la última vez.
export function useSiteMode(fixed?: SiteMode): SiteMode {
  const [stored] = useState(readSiteMode);

  useEffect(() => {
    if (!fixed) return;
    try {
      window.localStorage.setItem(SITE_MODE_KEY, fixed);
    } catch {
      // Sin almacenamiento, las demás páginas llevan al MechLab y al equipo del juego.
    }
  }, [fixed]);

  return fixed ?? stored;
}
