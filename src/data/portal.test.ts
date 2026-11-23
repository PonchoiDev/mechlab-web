import { describe, expect, it } from 'vitest';
import portal from '../../site/index.html?raw';
import type { Item } from '../types/item';
import type { BtItem } from '../types/battletech-mechlab';
import { getWeaponRows, groupEquipment } from '../utils/arsenal';
import { getBtWeaponRows, groupBtEquipment } from '../utils/battletech/equipment';
import itemsJson from './items.json';
import mechs from './mechs.json';
import pilots from './pilots.json';
import starmap from './starmap.json';
import units from './units.json';
import btArgo from './battletech/argo.json';
import btFlashpoints from './battletech/flashpoints.json';
import btItemsJson from './battletech/items.json';
import btMechs from './battletech/mechs.json';
import btStarmap from './battletech/starmap.json';
import btUnits from './battletech/units.json';

// La portada es HTML estático (site/index.html): sus cifras se escriben a mano. Estos tests las comparan con
// los datos que usa la página de cada herramienta, para que no se queden atrás cuando se regeneran.

// &amp; va la última: decodificada antes, un «&amp;#39;» acabaría como «'» en lugar de «&#39;».
const decode = (text: string) => text.replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();

const toolList = (game: string): string => {
  const match = portal.match(new RegExp(`<ul class="tool-list"[^>]*data-game="${game}"[^>]*>([\\s\\S]*?)</ul>`));
  if (!match) throw new Error(`No hay lista de herramientas de ${game}`);
  return match[1];
};

// Dentro de las carátulas, que son botones, las cifras van en un span en lugar de un p.
const metaOf = (html: string, className: string): string[] => {
  const match = html.match(new RegExp(`<(?:p|span) class="${className}">((?:\\s*<span>[^<]*</span>)*)\\s*</(?:p|span)>`));
  if (!match) throw new Error(`No hay ${className}`);
  return [...match[1].matchAll(/<span>([^<]*)<\/span>/g)].map(span => decode(span[1]));
};

// Cada fila de herramienta, como {enlace: cifras}, en el orden de la portada.
const toolRows = (game: string): [string, string[]][] =>
  [...toolList(game).matchAll(/<a class="tool[^"]*" href="([^"]+)">([\s\S]*?)<\/a>/g)].map(row => [row[1], metaOf(row[2], 'tool-meta')]);

const gameCover = (game: string): string => {
  const match = portal.match(new RegExp(`<button[^>]*class="game-cover[^"]*"[^>]*data-game="${game}"[^>]*>([\\s\\S]*?)</button>`));
  if (!match) throw new Error(`No hay carátula de ${game}`);
  return match[1];
};

const year = (date: string) => date.slice(0, 4);
const items = Object.values(itemsJson as unknown as Record<string, Item>);
const btItems = btItemsJson as unknown as BtItem[];
const equipmentCount = groupEquipment(items, { category: 'all', query: '', tech: 'all', dlc: 'all' })
  .reduce((total, group) => total + group.items.length, 0);
const btEquipmentCount = groupBtEquipment(btItems, { category: 'all', query: '', plus: 'all', source: 'all', rarity: 'all' })
  .reduce((total, group) => total + group.items.length, 0);

describe('portada', () => {
  it('tiene una carátula por juego, cada una con su lista de herramientas', () => {
    const covers = [...portal.matchAll(/<button[^>]*class="game-cover[^"]*"[^>]*data-game="([^"]+)"/g)].map(match => match[1]);
    expect(covers).toEqual(['mw5', 'battletech']);
    expect(portal).toMatch(/data-game="mw5"[^>]*aria-controls="tools-mw5"/);
    expect(portal).toMatch(/data-game="battletech"[^>]*aria-controls="tools-battletech"/);
    expect(portal).toContain('id="tools-mw5"');
    expect(portal).toContain('id="tools-battletech"');
  });

  it('enlaza a las siete herramientas de cada juego, con el MechLab primero', () => {
    expect(toolRows('mw5').map(([href]) => href)).toEqual([
      '/mercs/', '/mercs/chassis/', '/mercs/campaigns/', '/mercs/starmap/', '/mercs/units/', '/mercs/pilots/', '/mercs/equipment/'
    ]);
    expect(toolRows('battletech').map(([href]) => href)).toEqual([
      '/battletech/', '/battletech/chassis/', '/battletech/flashpoints/', '/battletech/starmap/', '/battletech/units/',
      '/battletech/argo/', '/battletech/equipment/'
    ]);
  });

  it('no tiene etiquetas NEW ni la franja de más juegos', () => {
    expect(portal).not.toMatch(/>\s*NEW\s*</);
    expect(portal).not.toMatch(/More games/i);
  });

  it('da las cifras de los datos de MW5, cada una en su elemento', () => {
    expect(Object.fromEntries(toolRows('mw5'))).toEqual({
      '/mercs/': [`${mechs.length} variants`, 'Save & share builds'],
      '/mercs/chassis/': ['Stats', 'Filters', 'Builds'],
      '/mercs/campaigns/': [`${starmap.quests.length} quests`, `${starmap.campaigns.length} DLC campaigns`],
      '/mercs/starmap/': [`${year(starmap.range.start)} to ${year(starmap.range.end)}`, 'Borders by date'],
      '/mercs/units/': [`${units.units.length} units`, 'Tanks', 'VTOLs', 'Turrets'],
      '/mercs/pilots/': [`${pilots.traits.length} traits`, `${pilots.heroes.length} hero pilots`, `${starmap.academies.length} academies`],
      '/mercs/equipment/': [`${getWeaponRows(items, '1').length} weapons`, `${equipmentCount} equipment`, 'Stats']
    });
    expect(metaOf(gameCover('mw5'), 'game-meta')).toEqual([`${mechs.length} variants`, `${starmap.campaigns.length} DLC campaigns`, 'DLC 9 ready']);
  });

  it('da las cifras de los datos de BATTLETECH, cada una en su elemento', () => {
    expect(Object.fromEntries(toolRows('battletech'))).toEqual({
      '/battletech/': [`${btMechs.length} variants`, 'Save & share builds'],
      '/battletech/chassis/': ['Stats', 'Filters', 'Builds'],
      '/battletech/flashpoints/': [`${btFlashpoints.flashpoints.length} flashpoints`, '3 DLC'],
      '/battletech/starmap/': [`${btStarmap.systems.length} systems`, 'Career mode'],
      '/battletech/units/': [`${btUnits.units.length} units`, 'Tanks', 'Turrets'],
      '/battletech/argo/': [`${btArgo.upgrades.length} upgrades`, 'Refit planner'],
      '/battletech/equipment/': [`${getBtWeaponRows(btItems).length} weapons`, `${btEquipmentCount} equipment`, 'Stats']
    });
    expect(metaOf(gameCover('battletech'), 'game-meta')).toEqual([
      `${btMechs.length} variants`, `${btFlashpoints.flashpoints.length} flashpoints`, '3 DLC'
    ]);
  });

  it('no usa rayas en los textos', () => {
    // Los textos que se ven: lo que hay entre etiquetas desde <body> hasta los scripts, que van al final. Los
    // estilos quedan en <head>, y los «--» de sus variables y de los comentarios no cuentan.
    const body = portal.slice(portal.indexOf('<body>'), portal.indexOf('<script>'));
    const texts = [...body.matchAll(/>([^<]+)</g)].map(match => match[1]);
    expect(texts.filter(text => /—|--/.test(text))).toEqual([]);
  });
});
