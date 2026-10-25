import type { WeaponType } from './item';

export type UpgradeCategory = 'Firepower' | 'Defense' | 'Heat' | 'Mobility' | 'Targeting';

// Estadísticas de la web que cambia una mejora. Las demás (cooldown, giro, sensores...) solo se describen.
export type UpgradeStat = 'armor' | 'cooling' | 'topSpeed' | 'damage' | 'range';

export interface UpgradeEffect {
  stat: UpgradeStat;
  // Fracción: 0.05 = +5 %.
  value: number;
  // Daño y alcance: tipos de arma a los que afecta.
  weaponTypes?: WeaponType[];
}

// Mejora de la cantina. Ocupa 1 o 2 de las ranuras de mejora del mech.
export interface Upgrade {
  id: string;
  name: string;
  category: UpgradeCategory;
  slots: number;
  description: string;
  effects: UpgradeEffect[];
}
