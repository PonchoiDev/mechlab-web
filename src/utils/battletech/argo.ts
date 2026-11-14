import type { ArgoCategory, ArgoData, ArgoUpgrade } from '../../types/battletech-argo';

// Árbol de mejoras de la Argo, planificador de compras y estado de la URL.

export type ArgoViewMode = 'tree' | 'list';

export interface ArgoView {
  view: ArgoViewMode;
  owned: ReadonlySet<string>;
}

export interface ArgoPathCost {
  upgrades: string[];
  cost: number;
  upkeep: number;
}

export interface ArgoPlanTotals {
  owned: number;
  bought: number;
  cost: number;
  upgradesUpkeep: number;
  monthly: number;
}

export interface ArgoPlanEffect {
  stat: string;
  name: string;
  details: string;
  text: string;
}

export interface ArgoTreeRow {
  category: ArgoCategory;
  cells: ArgoUpgrade[][];
}

export type ArgoStatus = 'starting' | 'owned' | 'available' | 'locked';

// Los índices se calculan una vez por juego de datos: la página los consulta en cada render.
const indexes = new WeakMap<ArgoData, { byId: Map<string, ArgoUpgrade>; unlocks: Map<string, string[]> }>();

const getIndex = (data: ArgoData) => {
  let index = indexes.get(data);
  if (!index) {
    const byId = new Map(data.upgrades.map(upgrade => [upgrade.id, upgrade]));
    const unlocks = new Map<string, string[]>(data.upgrades.map(upgrade => [upgrade.id, []]));
    for (const upgrade of data.upgrades) {
      for (const id of upgrade.requires) unlocks.get(id)?.push(upgrade.id);
    }
    index = { byId, unlocks };
    indexes.set(data, index);
  }
  return index;
};

export const hasUpgrade = (data: ArgoData, id: string) => getIndex(data).byId.has(id);

export const getUpgrade = (data: ArgoData, id: string): ArgoUpgrade => {
  const upgrade = getIndex(data).byId.get(id);
  if (!upgrade) throw new Error(`La Argo no tiene la mejora ${id}`);
  return upgrade;
};

// Lo que una mejora abre directamente: las que la piden.
export const getUnlocks = (data: ArgoData, id: string): string[] => getIndex(data).unlocks.get(id) ?? [];

// Recorre el árbol desde una mejora, hacia sus requisitos o hacia lo que abre, y devuelve lo
// encontrado en el orden de los datos (por categoría y nivel).
const walk = (data: ArgoData, id: string, next: (id: string) => string[]) => {
  const found = new Set<string>();
  const pending = [...next(id)];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (found.has(current)) continue;
    found.add(current);
    pending.push(...next(current));
  }
  return data.upgrades.filter(upgrade => found.has(upgrade.id)).map(upgrade => upgrade.id);
};

// Todos los requisitos de una mejora, directos o no.
export const getAncestors = (data: ArgoData, id: string) => walk(data, id, current => getUpgrade(data, current).requires);

// Todo lo que una mejora abre, directa o indirectamente.
export const getDescendants = (data: ArgoData, id: string) => walk(data, id, current => getUnlocks(data, current));

// La nave al empezar, en la campaña y en la carrera.
export const getStartingPlan = (data: ArgoData): Set<string> =>
  new Set(data.upgrades.filter(upgrade => upgrade.starting).map(upgrade => upgrade.id));

export const getAllPlan = (data: ArgoData): Set<string> => new Set(data.upgrades.map(upgrade => upgrade.id));

// Marcar una mejora la compra junto con lo que le falte para poder comprarla.
export const addToPlan = (data: ArgoData, owned: ReadonlySet<string>, id: string): Set<string> =>
  new Set([...owned, id, ...getAncestors(data, id)]);

// Desmarcarla quita también lo que depende de ella. Las iniciales vienen con la nave y no se quitan.
export const removeFromPlan = (data: ArgoData, owned: ReadonlySet<string>, id: string): Set<string> => {
  if (getUpgrade(data, id).starting) return new Set(owned);
  const removed = new Set([id, ...getDescendants(data, id)]);
  return new Set([...owned].filter(current => !removed.has(current)));
};

export const getStatus = (data: ArgoData, owned: ReadonlySet<string>, id: string): ArgoStatus => {
  const upgrade = getUpgrade(data, id);
  if (upgrade.starting) return 'starting';
  if (owned.has(id)) return 'owned';
  return upgrade.requires.every(requirement => owned.has(requirement)) ? 'available' : 'locked';
};

// Lo que falta comprar para tener una mejora con el plan actual: ella y sus requisitos pendientes.
export const getPathCost = (data: ArgoData, owned: ReadonlySet<string>, id: string): ArgoPathCost => {
  const upgrades = [...getAncestors(data, id), id].filter(current => !owned.has(current));
  const sum = (field: 'cost' | 'upkeep') => upgrades.reduce((total, current) => total + getUpgrade(data, current)[field], 0);
  return { upgrades, cost: sum('cost'), upkeep: sum('upkeep') };
};

// El mantenimiento mensual es el base de la nave más lo que suma cada mejora.
export const getPlanTotals = (data: ArgoData, owned: ReadonlySet<string>): ArgoPlanTotals => {
  const upgrades = data.upgrades.filter(upgrade => owned.has(upgrade.id));
  const upgradesUpkeep = upgrades.reduce((total, upgrade) => total + upgrade.upkeep, 0);
  return {
    owned: upgrades.length,
    bought: upgrades.filter(upgrade => !upgrade.starting).length,
    cost: upgrades.reduce((total, upgrade) => total + upgrade.cost, 0),
    upgradesUpkeep,
    monthly: data.baseUpkeep + upgradesUpkeep
  };
};

// La frase del juego con la cifra: «+3 Tech Points», «The Barracks support up to 16 MechWarriors» o,
// para las probabilidades, «… is 5% less likely». El juego pone el signo en la frase, así que la
// cifra va sin él.
export const formatEffect = (data: ArgoData, statId: string, value: number, set: boolean): string => {
  const stat = data.stats.find(candidate => candidate.id === statId);
  if (!stat) throw new Error(`La Argo no explica la estadística ${statId}`);
  const template = (set ? stat.set : value < 0 ? stat.negative : stat.positive) ?? `${stat.name} {value}`;
  const magnitude = Math.abs(value);
  return template
    .replace('{value}', String(Math.round(magnitude * 1000) / 1000))
    .replace('{percent}', `${Math.round(magnitude * 1000) / 10}%`);
};

// El efecto conjunto del plan. Las mejoras que fijan una estadística se sustituyen unas a otras
// (Mech Bay 3 deja la bahía en 18 'Mechs, no en 6 + 12 + 18): vale la del nivel más alto, que es la
// última que se compra porque pide las anteriores. Las que suman, se suman.
export const getPlanEffects = (data: ArgoData, owned: ReadonlySet<string>): ArgoPlanEffect[] => {
  const totals = new Map<string, { value: number; set: boolean; tier: number }>();
  for (const upgrade of data.upgrades) {
    if (!owned.has(upgrade.id)) continue;
    for (const effect of upgrade.effects) {
      const current = totals.get(effect.stat);
      if (effect.set) {
        if (!current || upgrade.tier >= current.tier) totals.set(effect.stat, { value: effect.value, set: true, tier: upgrade.tier });
      } else {
        totals.set(effect.stat, { value: (current?.value ?? 0) + effect.value, set: false, tier: upgrade.tier });
      }
    }
  }
  return data.stats.filter(stat => totals.has(stat.id)).map(stat => {
    const { value, set } = totals.get(stat.id)!;
    return { stat: stat.id, name: stat.name, details: stat.details, text: formatEffect(data, stat.id, value, set) };
  });
};

// Las mejoras de cada categoría, en el orden del juego.
export const groupByCategory = (data: ArgoData) =>
  data.categories
    .map(category => ({ category, upgrades: data.upgrades.filter(upgrade => upgrade.category === category.id) }))
    .filter(group => group.upgrades.length > 0);

// El árbol: una fila por categoría y una columna por nivel.
export const getTreeLayout = (data: ArgoData): { tiers: number; rows: ArgoTreeRow[] } => {
  const tiers = Math.max(...data.upgrades.map(upgrade => upgrade.tier)) + 1;
  return {
    tiers,
    rows: groupByCategory(data).map(({ category, upgrades }) => ({
      category,
      cells: Array.from({ length: tiers }, (_, tier) => upgrades.filter(upgrade => upgrade.tier === tier))
    }))
  };
};

// En la URL basta con las mejoras del plan que no son requisito de otra del plan: el resto se deduce.
export const parseArgoQuery = (data: ArgoData, search: string): ArgoView => {
  const params = new URLSearchParams(search);
  let owned = getStartingPlan(data);
  for (const id of (params.get('own') ?? '').split(',')) {
    if (hasUpgrade(data, id)) owned = addToPlan(data, owned, id);
  }
  return { view: params.get('view') === 'list' ? 'list' : 'tree', owned };
};

export const toArgoQuery = (data: ArgoData, { view, owned }: ArgoView): string => {
  const required = new Set([...owned].flatMap(id => getAncestors(data, id)));
  const leaves = data.upgrades.filter(upgrade => owned.has(upgrade.id) && !upgrade.starting && !required.has(upgrade.id));
  const params = new URLSearchParams();
  if (leaves.length > 0) params.set('own', leaves.map(upgrade => upgrade.id).join(','));
  if (view !== 'tree') params.set('view', view);
  // Las comas se quedan legibles: los ids no las llevan.
  const text = params.toString().replaceAll('%2C', ',');
  return text ? `?${text}` : '';
};

// Ilustración de una mejora y retrato de un tripulante, en battletech/public/argo/
// (de tools/extraer_argo_battletech.py).
export const getImageUrl = (image: string) => `${import.meta.env.BASE_URL}argo/${encodeURIComponent(image)}.png`;
export const getCrewPortraitUrl = (crew: string) => `${import.meta.env.BASE_URL}argo/crew/${encodeURIComponent(crew)}.png`;
