import { describe, expect, it } from 'vitest';
import portal from '../../site/index.html?raw';
import { getSiteLinks, parseSiteMode } from './siteNav';

// Las herramientas de cada juego en el orden de su lista en la portada.
const portalTools = (game: string): string[] => {
  const list = portal.match(new RegExp(`<ul class="tool-list"[^>]*data-game="${game}"[^>]*>([\\s\\S]*?)</ul>`));
  if (!list) throw new Error(`No hay lista de herramientas de ${game}`);
  return [...list[1].matchAll(/<a class="tool[^"]*" href="([^"]+)">/g)].map(match => match[1]);
};

describe('navegación de las cabeceras', () => {
  it('enlaza a todas las páginas de cada juego en el orden de la portada', () => {
    expect(getSiteLinks('mercs').map(link => link.href)).toEqual(portalTools('mw5'));
    expect(getSiteLinks('battletech').map(link => link.href)).toEqual(portalTools('battletech'));
  });

  it('cada enlace tiene su nombre y uno solo es el MechLab', () => {
    for (const game of ['mercs', 'battletech'] as const) {
      const links = getSiteLinks(game);
      expect(links.every(link => link.label.length > 0)).toBe(true);
      expect(links.filter(link => link.id === 'mechlab')).toHaveLength(1);
      expect(new Set(links.map(link => link.id)).size).toBe(links.length);
    }
  });

  it('en modo YAML lleva el MechLab y el equipo de MW5 a sus versiones YAML, marcadas', () => {
    const vanilla = getSiteLinks('mercs');
    const yaml = getSiteLinks('mercs', 'yaml');
    expect(yaml.map(link => link.id)).toEqual(vanilla.map(link => link.id));
    expect(yaml.filter(link => link.yaml).map(link => link.href)).toEqual(['/mercs/yaml/', '/mercs/yaml/equipment/']);
    expect(yaml.filter(link => !link.yaml)).toEqual(vanilla.filter(link => link.id !== 'mechlab' && link.id !== 'equipment'));
    expect(vanilla.some(link => link.yaml)).toBe(false);
  });

  it('la cabecera de BATTLETECH no cambia en modo YAML', () => {
    expect(getSiteLinks('battletech', 'yaml')).toEqual(getSiteLinks('battletech'));
  });

  it('solo lee el modo YAML si se guardó YAML', () => {
    expect(parseSiteMode('yaml')).toBe('yaml');
    expect(parseSiteMode('vanilla')).toBe('vanilla');
    expect(parseSiteMode(null)).toBe('vanilla');
    expect(parseSiteMode('YAML ')).toBe('vanilla');
    expect(parseSiteMode('{}')).toBe('vanilla');
  });
});
