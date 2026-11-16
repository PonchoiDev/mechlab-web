import { describe, expect, it } from 'vitest';
import mechsJson from '../data/mechs.json';
import starmapData from '../data/starmap.json';
import type { Campaign, Quest, StarmapData } from '../types/starmap';
import { getMechLabUrl } from './markets';
import {
  filterCampaigns,
  filterQuestStories,
  filterQuests,
  getCampaignMapUrl,
  getCampaignMechs,
  getCampaignSources,
  getCampaignTotals,
  getDlcLabel,
  getQuestMapUrl,
  getQuestMechs,
  getQuestStories,
  groupQuestsBySource,
  parseGuideQuery,
  toGuideQuery
} from './questGuide';

// Criterios de aceptación de docs/specs/pagina-campanas.md.
const data = starmapData as unknown as StarmapData;
const mechIds = new Set((mechsJson as unknown as { id: string }[]).map(mech => mech.id));
const systemId = (name: string) => {
  const found = data.systems.find(system => system.name === name);
  if (!found) throw new Error(`${name} no existe en starmap.json`);
  return found.id;
};
const quest = (name: string): Quest => {
  const found = data.quests.find(candidate => candidate.name === name);
  if (!found) throw new Error(`La HRQ ${name} no existe en starmap.json`);
  return found;
};
const campaign = (name: string): Campaign => {
  const found = data.campaigns.find(candidate => candidate.name === name);
  if (!found) throw new Error(`La campaña ${name} no existe en starmap.json`);
  return found;
};
const names = (list: { name: string }[]) => list.map(item => item.name);

describe('página de HRQ y campañas', () => {
  it('CA1: las HRQ se agrupan por origen, del juego base al DLC 8', () => {
    const groups = groupQuestsBySource(data.quests);
    expect(groups.map(group => [group.source, group.quests.length])).toEqual([[0, 40], [1, 11], [2, 7], [3, 1], [8, 5]]);
    expect(groups.reduce((total, group) => total + group.quests.length, 0)).toBe(64);
  });

  it('CA2: la búsqueda de HRQ se filtra por origen', () => {
    expect(names(filterQuests(data, 'arrow', 1))).toEqual(['Bow and Arrow']);
    expect(filterQuests(data, 'arrow', 2)).toEqual([]);
    expect(names(filterQuests(data, 'gauss', 0))).toContain('Pirate Hunt');
    expect(filterQuests(data, '', 'all')).toHaveLength(64);
  });

  it('CA3: la búsqueda de campañas se filtra por DLC', () => {
    expect(names(filterCampaigns(data, '', 7))).toEqual(['Shadow of Kerensky']);
    expect(names(filterCampaigns(data, 'morgan', 'all'))).toEqual(['Shadow of Kerensky']);
    expect(filterCampaigns(data, '', 'all')).toHaveLength(6);
  });

  it('CA4: Bow and Arrow enlaza al mapa en la fecha en que se ofrece', () => {
    const bow = quest('Bow and Arrow');
    expect(getQuestMapUrl(data, bow)).toBe('/mercs/starmap/?date=3023-12-20&quest=bow-and-arrow');
    expect(getQuestMapUrl(data, bow, systemId('Ibstock'))).toBe('/mercs/starmap/?date=3023-12-20&system=Ibstock&quest=bow-and-arrow');
  });

  it('CA5: sin fecha en algún modo, el enlace empieza en 3015', () => {
    expect(getQuestMapUrl(data, quest('Pirate Hunt'))).toBe('/mercs/starmap/?date=3015-01-01&quest=pirate-hunt');
    expect(getQuestMapUrl(data, quest('Errant Signal'))).toMatch(/^\/mercs\/starmap\/\?date=3015-01-01&quest=/);
  });

  it('CA6: Shadow of Kerensky enlaza al mapa en su fecha de inicio', () => {
    const kerensky = campaign('Shadow of Kerensky');
    expect(getCampaignMapUrl(data, kerensky)).toBe('/mercs/starmap/?date=3049-09-15&campaign=dlc7');
    expect(getCampaignMapUrl(data, kerensky, systemId('Rodigo'))).toBe('/mercs/starmap/?date=3049-09-15&system=Rodigo&campaign=dlc7');
  });

  it('CA7: los Mechs de las recompensas, sin repetir y en el MechLab', () => {
    expect(getQuestMechs(quest('Bow and Arrow')).map(mech => mech.id)).toEqual(['ARC-AGC']);
    expect(getQuestMechs(quest('Pirate Hunt'))).toEqual([]);
    const ashes = getCampaignMechs(campaign('Ashes & Ascension')).map(mech => mech.id);
    expect(ashes).toEqual(expect.arrayContaining(['SNV-BR', 'HBK-IIC-DW']));
    expect(new Set(ashes).size).toBe(ashes.length);
    const all = [...data.quests.flatMap(getQuestMechs), ...data.campaigns.flatMap(getCampaignMechs)];
    expect(all.length).toBeGreaterThan(0);
    for (const mech of all) {
      expect(mechIds.has(mech.id), mech.id).toBe(true);
      expect(getMechLabUrl(mech.id)).toBe(`/mercs/?mech=${encodeURIComponent(mech.id)}`);
    }
  });

  it("CA8: el pago total de The Dragon's Gambit", () => {
    const gambit = campaign("The Dragon's Gambit");
    expect(gambit.missions).toHaveLength(15);
    expect(getCampaignTotals(gambit)).toEqual({ cbills: 67931715, reputation: 18485 });
  });

  it('CA9: la vista va en la URL', () => {
    expect(parseGuideQuery('', data)).toEqual({ tab: 'quests', query: '', source: 'all', open: null });
    expect(toGuideQuery(parseGuideQuery('', data))).toBe('');

    const campaigns = parseGuideQuery('?tab=campaigns&dlc=7&q=kerensky', data);
    expect(campaigns).toEqual({ tab: 'campaigns', query: 'kerensky', source: 7, open: null });
    expect(toGuideQuery(campaigns)).toBe('?tab=campaigns&dlc=7&q=kerensky');

    expect(parseGuideQuery('?quest=bow-and-arrow', data)).toEqual({ tab: 'quests', query: '', source: 'all', open: 'bow-and-arrow' });
    expect(toGuideQuery({ tab: 'quests', query: '', source: 'all', open: 'bow-and-arrow' })).toBe('?quest=bow-and-arrow');
    expect(parseGuideQuery('?campaign=dlc7', data)).toEqual({ tab: 'campaigns', query: '', source: 'all', open: 'dlc7' });
    expect(toGuideQuery({ tab: 'campaigns', query: '', source: 'all', open: 'dlc7' })).toBe('?campaign=dlc7');

    expect(parseGuideQuery('?tab=nope&dlc=5&quest=nope', data)).toEqual({ tab: 'quests', query: '', source: 'all', open: null });
    expect(parseGuideQuery('?campaign=dlc3', data)).toEqual({ tab: 'quests', query: '', source: 'all', open: null });
    expect(parseGuideQuery('?dlc=0', data).source).toBe(0);
  });

  it('CA10: cada DLC con su número y su nombre', () => {
    expect(getDlcLabel(data, 0)).toBe('Base game');
    expect(getDlcLabel(data, 1)).toBe('DLC 1 · Heroes of the Inner Sphere');
    expect(getDlcLabel(data, 8)).toBe('DLC 8 · Chaos Reign');
  });

  it('CA11: las historias contadas con cadenas de HRQ', () => {
    expect(getQuestStories(data).map(story => ({ dlc: story.dlc, name: story.name, quests: story.quests.map(item => item.name) }))).toEqual([
      { dlc: 3, name: 'Call to Arms', quests: ['Those in Need'] },
      { dlc: 8, name: 'Chaos Reign', quests: ['Adam Steiner', 'Testing Ground', 'Ideals of War', 'Thumb War', 'New Home, Old Enemies'] }
    ]);
    expect(getCampaignSources(data)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(filterQuestStories(data, 'steiner', 'all').map(story => story.name)).toEqual(['Chaos Reign']);
    expect(filterQuestStories(data, 'chaos', 8).map(story => story.name)).toEqual(['Chaos Reign']);
    expect(filterQuestStories(data, '', 7)).toEqual([]);
    expect(parseGuideQuery('?campaign=dlc8', data)).toEqual({ tab: 'campaigns', query: '', source: 'all', open: 'dlc8' });
    expect(toGuideQuery({ tab: 'campaigns', query: '', source: 'all', open: 'dlc8' })).toBe('?campaign=dlc8');
  });
});
