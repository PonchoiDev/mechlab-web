// La Argo de BATTLETECH (src/data/battletech/argo.json, de tools/generar_argo_battletech.py).

export interface ArgoEffect {
  stat: string;
  value: number;
  // true si la mejora fija la estadística (12 'Mechs); false si la suma o la resta (+3 Tech Points).
  set: boolean;
}

export interface ArgoUpgrade {
  id: string;
  name: string;
  details: string;
  category: string;
  location: string;
  tier: number;
  cost: number;
  upkeep: number;
  requires: string[];
  starting: boolean;
  image: string;
  crew: string | null;
  pitch: string | null;
  effects: ArgoEffect[];
}

// La frase con la que el juego explica el cambio, con {value} o {percent} en el hueco de la cifra.
export interface ArgoStat {
  id: string;
  name: string;
  details: string;
  set: string | null;
  positive: string | null;
  negative: string | null;
}

export interface ArgoCategory {
  id: string;
  name: string;
}

export interface ArgoLocation {
  id: string;
  name: string;
}

export interface ArgoCrew {
  id: string;
  name: string;
  rank: string;
}

export interface ArgoData {
  baseUpkeep: number;
  monthLength: number;
  careerCostMultiplier: number;
  careerUpkeepMultiplier: number;
  startingTechPoints: number;
  startingMedPoints: number;
  startingMorale: number;
  maxMorale: number;
  locations: ArgoLocation[];
  categories: ArgoCategory[];
  crew: ArgoCrew[];
  stats: ArgoStat[];
  upgrades: ArgoUpgrade[];
}
