import type { PilotTrait, TraitCategory } from '../types/pilots';

export const TRAIT_CATEGORIES: { id: TraitCategory; label: string }[] = [
  { id: 'mech', label: "'Mech affinity" },
  { id: 'weapon', label: 'Weapons' },
  { id: 'faction', label: 'Factions' },
  { id: 'career', label: 'Career' },
  { id: 'graduate', label: 'Academy graduates' }
];

export interface TraitFilter {
  category: TraitCategory | 'all';
  heroOnly: boolean;
  query: string;
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Se busca en el nombre, la descripción, dónde se aplica y qué cambia: «jam» encuentra Trigger
// Discipline aunque su nombre no lo diga.
const searchText = (trait: PilotTrait) => normalize([
  trait.name,
  trait.description ?? '',
  ...trait.groups.flatMap(group => [group.scope, group.note ?? '', ...group.effects.map(effect => effect.label)])
].join(' '));

export const filterTraits = (traits: PilotTrait[], { category, heroOnly, query }: TraitFilter): PilotTrait[] => {
  const text = normalize(query.trim());
  return traits.filter(trait =>
    (category === 'all' || trait.category === category) &&
    (!heroOnly || trait.hero) &&
    (!text || searchText(trait).includes(text)));
};

export type PilotsTab = 'traits' | 'programs';

export interface PilotsView extends TraitFilter {
  tab: PilotsTab;
}

// La vista va en la URL (?tab=programs, ?category=weapon&hero=1&q=laser); lo que no se reconoce se ignora.
export const parsePilotsQuery = (search: string): PilotsView => {
  const params = new URLSearchParams(search);
  const category = TRAIT_CATEGORIES.find(candidate => candidate.id === params.get('category'))?.id ?? 'all';
  return {
    tab: params.get('tab') === 'programs' ? 'programs' : 'traits',
    category,
    heroOnly: params.get('hero') === '1',
    query: params.get('q') ?? ''
  };
};

export const toPilotsQuery = ({ tab, category, heroOnly, query }: PilotsView): string => {
  const params = new URLSearchParams();
  if (tab !== 'traits') params.set('tab', tab);
  if (category !== 'all') params.set('category', category);
  if (heroOnly) params.set('hero', '1');
  if (query.trim()) params.set('q', query.trim());
  const text = params.toString();
  return text ? `?${text}` : '';
};

// Ficha de la academia en el mapa estelar.
export const getAcademyMapUrl = (academyId: string) => `/mercs/starmap/?academy=${encodeURIComponent(academyId)}`;
