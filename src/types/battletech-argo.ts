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
  // Icono de la pantalla Ship Upgrades, en battletech/public/argo/icons/.
  icon: string;
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
  // El de ShipUpgradeCategory.json («Habitat Pod»), que va en la ficha de la mejora.
  name: string;
  // El título de su caja en la pantalla Ship Upgrades («Habitat Pods»).
  label: string;
}

// Una de las tres secciones de la pantalla Ship Upgrades, con sus categorías en orden.
export interface ArgoSection {
  id: string;
  name: string;
  icon: string;
  categories: string[];
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
  // Precio y mantenimiento con la opción de carrera «Reduced Argo Upgrade Costs».
  reducedCostMultiplier: number;
  startingTechPoints: number;
  startingMedPoints: number;
  startingMorale: number;
  maxMorale: number;
  locations: ArgoLocation[];
  sections: ArgoSection[];
  categories: ArgoCategory[];
  crew: ArgoCrew[];
  stats: ArgoStat[];
  upgrades: ArgoUpgrade[];
}
