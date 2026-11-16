import type { Campaign, GameDate, Quest, StarmapData } from '../types/starmap';
import { searchCampaigns } from './campaigns';
import { BASE_GAME } from './mechs';
import { searchQuests } from './quests';
import { toMapQuery } from './starmap';

// Ruta del mapa estelar de Mercenaries, la misma que enlaza la cabecera.
const STARMAP_PATH = '/mercs/starmap/';

export type GuideTab = 'quests' | 'campaigns';
// Juego base (0) o un DLC; 'all', todos.
export type SourceFilter = 'all' | number;

export interface GuideView {
  tab: GuideTab;
  query: string;
  source: SourceFilter;
  // Id de la HRQ o de la campaña desplegada, según la pestaña.
  open: string | null;
}

type MechRef = { id: string; name: string };

// Las HRQ sin DLC son del juego base; las de carrera del DLC1 (Return of the Rangers…) cuentan como del DLC1.
export const getQuestSource = (quest: Quest): number => quest.dlc ?? BASE_GAME;

export const getQuestSources = (data: StarmapData): number[] =>
  [...new Set(data.quests.map(getQuestSource))].sort((a, b) => a - b);

// Call to Arms y Chaos Reign cuentan su historia con cadenas de HRQ en vez de con una campaña. Las del DLC1
// son cacerías de 'Mechs hero sueltas, no una historia, y las del DLC2 acompañan a su campaña.
const QUEST_STORY_DLCS = [3, 8];

// La pestaña de campañas tiene las campañas y las historias contadas con cadenas de HRQ.
export const getCampaignSources = (data: StarmapData): number[] => [...new Set([
  ...data.campaigns.map(campaign => campaign.dlc),
  ...QUEST_STORY_DLCS.filter(dlc => data.quests.some(quest => quest.dlc === dlc))
])].sort((a, b) => a - b);

// Grupos por origen, del juego base al último DLC, con las HRQ en el orden en que llegan.
export const groupQuestsBySource = (quests: Quest[]): { source: number; quests: Quest[] }[] => {
  const groups = new Map<number, Quest[]>();
  for (const quest of quests) {
    const source = getQuestSource(quest);
    groups.set(source, [...(groups.get(source) ?? []), quest]);
  }
  return [...groups].sort(([a], [b]) => a - b).map(([source, list]) => ({ source, quests: list }));
};

export const filterQuests = (data: StarmapData, query: string, source: SourceFilter): Quest[] =>
  searchQuests(data, query).filter(quest => source === 'all' || getQuestSource(quest) === source);

export const filterCampaigns = (data: StarmapData, query: string, source: SourceFilter): Campaign[] =>
  searchCampaigns(data, query).filter(campaign => source === 'all' || campaign.dlc === source);

// La primera fecha en que se ofrece: si algún modo no tiene fecha de inicio, desde el principio del mapa.
// Con esa fecha el mapa no la enseña como «Not offered until…».
const getQuestDate = (data: StarmapData, quest: Quest): GameDate => {
  const dates = quest.requirements.map(requirement => requirement.from);
  if (dates.length === 0 || dates.some(date => date === null)) return data.range.start;
  return (dates as GameDate[]).sort()[0];
};

// El mapa con la HRQ elegida (su ruta numerada) y, si se pasa, uno de sus sistemas abierto.
export const getQuestMapUrl = (data: StarmapData, quest: Quest, systemId: number | null = null): string =>
  STARMAP_PATH + toMapQuery({ date: getQuestDate(data, quest), systemId, questId: quest.id }, data);

export const getCampaignMapUrl = (data: StarmapData, campaign: Campaign, systemId: number | null = null): string =>
  STARMAP_PATH + toMapQuery({ date: campaign.from ?? data.range.start, systemId, campaignId: campaign.id }, data);

const uniqueMechs = (mechs: MechRef[]): MechRef[] =>
  mechs.filter((mech, index) => mechs.findIndex(other => other.id === mech.id) === index);

// 'Mechs que da la HRQ en cualquiera de sus modos, sin repetir.
export const getQuestMechs = (quest: Quest): MechRef[] => uniqueMechs(quest.rewards.flatMap(reward => reward.mechs));

// 'Mechs de las misiones de la campaña y los de completarla, sin repetir.
export const getCampaignMechs = (campaign: Campaign): MechRef[] =>
  uniqueMechs([...campaign.missions.flatMap(mission => mission.mechs), ...(campaign.completion?.mechs ?? [])]);

// Pago base de todas las misiones de la campaña.
export const getCampaignTotals = (campaign: Campaign): { cbills: number; reputation: number } => ({
  cbills: campaign.missions.reduce((total, mission) => total + mission.cbills, 0),
  reputation: campaign.missions.reduce((total, mission) => total + mission.reputation, 0)
});

// El briefing de cada misión de la HRQ, en su orden (quest-briefings.json); el primero es el de la oferta.
export const getQuestBriefings = (briefings: Record<string, (string | null)[]>, quest: Quest): (string | null)[] =>
  quest.missions.map((_, index) => briefings[quest.id]?.[index] ?? null);

// El origen con su nombre: «Base game» o «DLC 8 · Chaos Reign».
export const getDlcLabel = (data: StarmapData, source: number): string =>
  source === BASE_GAME ? 'Base game' : [`DLC ${source}`, data.dlcs[String(source)]].filter(Boolean).join(' · ');

export interface QuestStory {
  dlc: number;
  name: string;
  // En el orden en que se ofrecen.
  quests: Quest[];
}

export const getQuestStories = (data: StarmapData): QuestStory[] => QUEST_STORY_DLCS.map(dlc => ({
  dlc,
  name: data.dlcs[String(dlc)] ?? `DLC ${dlc}`,
  quests: data.quests.filter(quest => quest.dlc === dlc)
    .map(quest => ({ quest, date: getQuestDate(data, quest) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.quest.name.localeCompare(b.quest.name))
    .map(({ quest }) => quest)
})).filter(story => story.quests.length > 0);

// Una historia sale si es de ese origen y su nombre o alguna de sus cadenas coinciden con la búsqueda.
export const filterQuestStories = (data: StarmapData, query: string, source: SourceFilter): QuestStory[] => {
  const matching = new Set(searchQuests(data, query).map(quest => quest.id));
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return getQuestStories(data).filter(story => (source === 'all' || story.dlc === source) &&
    (words.every(word => story.name.toLowerCase().includes(word)) || story.quests.some(quest => matching.has(quest.id))));
};

// La vista va en la URL (?tab=campaigns&dlc=7&q=kerensky, ?quest=bow-and-arrow, ?campaign=dlc7). Una ficha
// abierta elige su pestaña. Lo que no existe se ignora: un origen sin nada en la pestaña, también.
export const parseGuideQuery = (search: string, data: StarmapData): GuideView => {
  const params = new URLSearchParams(search);
  const questId = params.get('quest');
  const campaignId = params.get('campaign');
  const openQuest = questId && data.quests.some(quest => quest.id === questId) ? questId : null;
  // Las historias contadas con HRQ se abren como una campaña más, con el id de su DLC (dlc8).
  const isCampaign = (id: string) => data.campaigns.some(campaign => campaign.id === id) || getQuestStories(data).some(story => `dlc${story.dlc}` === id);
  const openCampaign = !openQuest && campaignId && isCampaign(campaignId) ? campaignId : null;
  const tab: GuideTab = openQuest ? 'quests' : openCampaign ? 'campaigns' : params.get('tab') === 'campaigns' ? 'campaigns' : 'quests';
  const sources = tab === 'quests' ? getQuestSources(data) : getCampaignSources(data);
  const dlc = params.get('dlc');
  const source = dlc !== null && /^\d+$/.test(dlc) && sources.includes(Number(dlc)) ? Number(dlc) : 'all';
  return { tab, query: params.get('q') ?? '', source, open: openQuest ?? openCampaign };
};

export const toGuideQuery = ({ tab, query, source, open }: GuideView): string => {
  const params = new URLSearchParams();
  if (open) params.set(tab === 'quests' ? 'quest' : 'campaign', open);
  else if (tab === 'campaigns') params.set('tab', tab);
  if (source !== 'all') params.set('dlc', String(source));
  if (query.trim()) params.set('q', query.trim());
  const text = params.toString();
  return text ? `?${text}` : '';
};
