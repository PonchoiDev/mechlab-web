import type { Campaign, GameDate, StarmapData } from '../types/starmap';
import { normalize } from './starmap';

// Busca por el nombre de la campaña, por los sistemas por los que pasa, por los títulos de sus
// misiones, por quien las encarga y por sus recompensas ('Mechs y pilotos hero). Sin texto, todas, en
// el orden de los DLC.
export const searchCampaigns = (data: StarmapData, query: string): Campaign[] => {
  const needle = normalize(query);
  if (!needle) return data.campaigns;
  const names = new Map(data.systems.map(system => [system.id, normalize(system.name)]));
  const textsOf = (campaign: Campaign) => [
    names.get(campaign.start) ?? '',
    ...campaign.missions.flatMap(mission => [
      names.get(mission.system) ?? '',
      mission.title,
      mission.employer ?? '',
      ...mission.mechs.map(mech => `${mech.name} ${mech.id}`),
      ...mission.pilots.map(pilot => pilot.name)
    ]),
    ...(campaign.completion?.mechs ?? []).map(mech => `${mech.name} ${mech.id}`)
  ].map(normalize);
  const inName = data.campaigns.filter(campaign => normalize(campaign.name).includes(needle));
  const elsewhere = data.campaigns.filter(campaign => !inName.includes(campaign) && textsOf(campaign).some(text => text.includes(needle)));
  return [...inName, ...elsewhere];
};

export const getCampaignsForSystem = (data: StarmapData, systemId: number): { starting: Campaign[]; played: Campaign[] } => ({
  starting: data.campaigns.filter(campaign => campaign.start === systemId),
  played: data.campaigns.filter(campaign => campaign.missions.some(mission => mission.system === systemId))
});

// Sistemas por los que pasa la campaña, en orden: el de inicio y después cada misión, sin repetir el
// mismo sistema dos veces seguidas.
export const getCampaignRoute = (campaign: Campaign): number[] =>
  [campaign.start, ...campaign.missions.map(mission => mission.system)]
    .filter((system, index, route) => index === 0 || system !== route[index - 1]);

// Una campaña se ofrece desde su fecha. No se marca como caducada: los DLC 6, 7 y 9 traen una
// transmisión para cuando la fecha ya ha pasado (DLCn_PastStartDate_Transmission).
export const getCampaignAvailability = (campaign: Campaign, date: GameDate): { state: 'available' } | { state: 'upcoming'; date: GameDate } =>
  campaign.from !== null && campaign.from > date ? { state: 'upcoming', date: campaign.from } : { state: 'available' };

export const parseCampaignQuery = (search: string, data: StarmapData): string | null => {
  const id = new URLSearchParams(search).get('campaign');
  return id && data.campaigns.some(campaign => campaign.id === id) ? id : null;
};
