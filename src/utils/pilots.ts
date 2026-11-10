import type { HeroPilot, PilotTrait, ProgramFamily, TrainingProgramEntry, TraitCategory, TraitEffect, TraitEffectGroup } from '../types/pilots';

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

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

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

export interface TraitSection {
  category: TraitCategory;
  label: string;
  count: number;
  groups: { label: string | null; traits: PilotTrait[] }[];
}

// Los rasgos por categoría y subgrupo, en el orden en que vienen (pilots.json ya los ordena así).
export const groupTraits = (traits: PilotTrait[]): TraitSection[] => TRAIT_CATEGORIES.flatMap(({ id, label }) => {
  const inCategory = traits.filter(trait => trait.category === id);
  if (inCategory.length === 0) return [];
  const groups: TraitSection['groups'] = [];
  for (const trait of inCategory) {
    const last = groups.at(-1);
    if (last && last.label === trait.group) last.traits.push(trait);
    else groups.push({ label: trait.group, traits: [trait] });
  }
  return [{ category: id, label, count: inCategory.length, groups }];
});

// Grupo de efectos en la columna de combate; scope null cuando dónde se aplica es obvio.
export interface TraitEffectLine {
  scope: string | null;
  note?: string;
  effects: TraitEffect[];
}

const PILOT_SCOPE = 'Pilot';
// «In combat» no añade nada en la columna de combate, y «While piloting Atlas 'Mechs» repite el
// nombre de la afinidad. Con un arma, contra una facción o en sus contratos sí hay que decirlo.
const isObviousScope = (scope: string) => scope === 'In combat' || scope.startsWith('While piloting ');

export const getTraitEffectColumns = (trait: { groups: TraitEffectGroup[] }) => ({
  combat: trait.groups
    .filter(group => group.scope !== PILOT_SCOPE)
    .map((group): TraitEffectLine => ({
      scope: isObviousScope(group.scope) ? null : group.scope,
      ...(group.note ? { note: group.note } : {}),
      effects: group.effects
    })),
  pilot: trait.groups.filter(group => group.scope === PILOT_SCOPE).flatMap(group => group.effects)
});

export const splitHeroPilots = (heroes: HeroPilot[]) => ({
  hiringHall: heroes.filter(pilot => pilot.hiringHall),
  rewards: heroes.filter(pilot => !pilot.hiringHall)
});

export const groupPrograms = (programs: TrainingProgramEntry[], families: ProgramFamily[]) =>
  families
    .map(family => ({ family, programs: programs.filter(program => program.family === family.id) }))
    .filter(entry => entry.programs.length > 0);

// Los cursos largos duran años exactos (365, 730, 1460 días): se leen mejor en años.
export const formatProgramLength = (days: number) => {
  if (days >= 365 && days % 365 === 0) {
    const years = days / 365;
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }
  return `${days} days`;
};

export type PilotsTab = 'heroes' | 'traits' | 'programs';
const TABS: PilotsTab[] = ['heroes', 'traits', 'programs'];

export interface PilotsView extends TraitFilter {
  tab: PilotsTab;
}

// La vista va en la URL (?tab=programs, ?tab=traits&category=weapon&hero=1&q=laser); sin pestaña,
// la de los pilotos hero. Lo que no se reconoce se ignora.
export const parsePilotsQuery = (search: string): PilotsView => {
  const params = new URLSearchParams(search);
  const category = TRAIT_CATEGORIES.find(candidate => candidate.id === params.get('category'))?.id ?? 'all';
  return {
    tab: TABS.find(candidate => candidate === params.get('tab')) ?? 'heroes',
    category,
    heroOnly: params.get('hero') === '1',
    query: params.get('q') ?? ''
  };
};

export const toPilotsQuery = ({ tab, category, heroOnly, query }: PilotsView): string => {
  const params = new URLSearchParams();
  if (tab !== 'heroes') params.set('tab', tab);
  if (category !== 'all') params.set('category', category);
  if (heroOnly) params.set('hero', '1');
  if (query.trim()) params.set('q', query.trim());
  const text = params.toString();
  return text ? `?${text}` : '';
};

// Retrato de un piloto hero, en public/pilots/portraits/ (de tools/extraer_pilotos.py).
export const getPortraitUrl = (file: string) => `${import.meta.env.BASE_URL}pilots/portraits/${encodeURIComponent(file)}`;

// Ficha de la academia en el mapa estelar.
export const getAcademyMapUrl = (academyId: string) => `/mercs/starmap/?academy=${encodeURIComponent(academyId)}`;
