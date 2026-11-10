import { describe, expect, it } from 'vitest';
import starmapData from '../data/starmap.json';
import type { Campaign, StarmapData } from '../types/starmap';
import { getCampaignAvailability, getCampaignRoute, getCampaignsForSystem, parseCampaignQuery, searchCampaigns } from './campaigns';
import { toMapQuery } from './starmap';

// Criterios de aceptación de docs/specs/campanas-dlc.md (issue #96).
const data = starmapData as unknown as StarmapData;
const systemId = (name: string) => {
  const found = data.systems.find(system => system.name === name);
  if (!found) throw new Error(`${name} no existe en starmap.json`);
  return found.id;
};
const systemName = (id: number) => data.systems.find(system => system.id === id)?.name;
const campaign = (name: string): Campaign => {
  const found = data.campaigns.find(candidate => candidate.name === name);
  if (!found) throw new Error(`La campaña ${name} no existe en starmap.json`);
  return found;
};
const mission = (found: Campaign, title: string) => {
  const match = found.missions.find(candidate => candidate.title === title);
  if (!match) throw new Error(`${found.name} no tiene la misión ${title}`);
  return match;
};
const names = (campaigns: Campaign[]) => campaigns.map(candidate => candidate.name);

describe('campañas de los DLC', () => {
  it('CA1: seis campañas con sus misiones y títulos limpios', () => {
    expect(data.campaigns.map(candidate => [candidate.dlc, candidate.name, candidate.missions.length])).toEqual([
      [2, 'Legend of the Kestrel Lancers', 14],
      [4, 'Rise of Rasalhague', 12],
      [5, "The Dragon's Gambit", 15],
      [6, 'Solaris Showdown', 7],
      [7, 'Shadow of Kerensky', 12],
      [9, 'Ashes & Ascension', 18]
    ]);
    const titles = data.campaigns.flatMap(candidate => candidate.missions.map(entry => entry.title));
    expect(titles.every(title => title.trim() !== '' && !title.includes('[*]') && !/\bpt\./.test(title))).toBe(true);
  });

  it('CA2: Shadow of Kerensky, con sus misiones en orden y sus recompensas', () => {
    const kerensky = campaign('Shadow of Kerensky');
    expect(kerensky).toMatchObject({ id: 'dlc7', dlc: 7, start: systemId('Alleghe'), from: '3049-09-15' });
    expect(kerensky.missions[0]).toMatchObject({ title: 'Hunting Party', system: systemId('Alleghe') });
    expect(kerensky.missions[6]).toMatchObject({ title: 'Out of The Fire', system: systemId('Last Frontier') });
    expect(kerensky.missions.at(-1)).toMatchObject({ title: 'Loose Ends', system: systemId('HD-438297') });
    expect(mission(kerensky, 'Leading the Charge').pilots.map(pilot => pilot.name)).toEqual(['Morgan Trensky']);
    expect(mission(kerensky, 'Smoke and Mirrors').pilots.map(pilot => pilot.name)).toEqual(['Sam Hagel']);
    expect(mission(kerensky, 'Battle at New Starburg').mechs.map(mech => mech.id)).toEqual(['HBR-A']);
  });

  it("CA3: The Dragon's Gambit empieza en Dieron y acaba en Trolloc Prime", () => {
    const gambit = campaign("The Dragon's Gambit");
    expect(gambit).toMatchObject({ start: systemId('Dieron'), from: '3038-07-01' });
    expect(gambit.missions[0]).toMatchObject({ title: 'Rat Infested Shores', system: systemId('Dieron') });
    expect(gambit.missions.at(-1)).toMatchObject({
      title: 'Checkmate', system: systemId('Trolloc Prime'), cbills: 7575000, reputation: 2500
    });
    expect(gambit.missions.at(-1)?.mechs.map(mech => mech.id)).toEqual(['HTM-26T-S']);
  });

  it('CA4: Rise of Rasalhague empieza en Kirchbach, sin el prólogo que no se usa', () => {
    const rasalhague = campaign('Rise of Rasalhague');
    expect(rasalhague).toMatchObject({ start: systemId('Kirchbach'), from: '3031-01-01' });
    expect(rasalhague.missions[0].title).toBe('False Promises');
    expect(rasalhague.missions.some(entry => /ASEIR/i.test(entry.title))).toBe(false);
  });

  it('CA5: la ruta de Ashes & Ascension y lo que da completarla', () => {
    const ashes = campaign('Ashes & Ascension');
    expect(ashes.from).toBe('3058-04-01');
    expect(getCampaignRoute(ashes).map(systemName)).toEqual(['Tharkad', 'Matamoras', 'Jeanette', 'Hanover', 'Bangor', 'Albiero']);
    expect(ashes.completion).toMatchObject({ title: 'Promises Kept' });
    expect(ashes.completion?.mechs.map(mech => mech.id)).toEqual(['SNV-BR', 'HBK-IIC-DW']);
  });
});

describe('pilotos de las HRQ', () => {
  it('CA10: la HRQ de Adam Steiner da a Valten Ryder', () => {
    const steiner = data.quests.find(quest => quest.id === 'adam-steiner');
    expect(steiner?.dlc).toBe(8);
    expect(steiner?.rewards.flatMap(reward => reward.pilots.map(pilot => pilot.name))).toEqual(['Valten Ryder']);
  });
});

describe('búsqueda y sistemas', () => {
  it('CA6: se busca por nombre, sistema, piloto o recompensa', () => {
    expect(names(searchCampaigns(data, 'kerensky'))).toEqual(['Shadow of Kerensky']);
    expect(names(searchCampaigns(data, 'sarna'))).toEqual(['Legend of the Kestrel Lancers']);
    expect(names(searchCampaigns(data, 'morgan'))).toEqual(['Shadow of Kerensky']);
    expect(names(searchCampaigns(data, 'SOLARIS'))[0]).toBe('Solaris Showdown');
    expect(searchCampaigns(data, '')).toHaveLength(6);
  });

  it('CA7: las campañas que empiezan o pasan por un sistema', () => {
    expect(names(getCampaignsForSystem(data, systemId('Galatea')).starting)).toEqual(['Solaris Showdown']);
    expect(names(getCampaignsForSystem(data, systemId('Rodigo')).played)).toEqual(['Shadow of Kerensky']);
    expect(getCampaignsForSystem(data, systemId('Rodigo')).starting).toEqual([]);
  });

  it('CA8: una campaña no se ofrece antes de su fecha', () => {
    const kerensky = campaign('Shadow of Kerensky');
    expect(getCampaignAvailability(kerensky, '3049-01-01')).toEqual({ state: 'upcoming', date: '3049-09-15' });
    expect(getCampaignAvailability(kerensky, '3050-01-01')).toEqual({ state: 'available' });
  });

  it('CA9: la campaña elegida va en la URL', () => {
    expect(parseCampaignQuery('?campaign=dlc7', data)).toBe('dlc7');
    expect(parseCampaignQuery('?campaign=dlc3', data)).toBeNull();
    expect(toMapQuery({ date: '3050-01-01', systemId: null, campaignId: 'dlc7' }, data)).toContain('campaign=dlc7');
    expect(toMapQuery({ date: '3050-01-01', systemId: null, campaignId: 'nope' }, data)).not.toContain('campaign');
  });
});
