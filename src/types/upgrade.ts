import type { WeaponType } from './item';

export type UpgradeCategory = 'Firepower' | 'Defense' | 'Heat' | 'Mobility' | 'Targeting';

// Estadísticas que cambia una mejora. Las demás (aceleración, saltos, duración del láser, dispersión)
// solo se describen. heatGeneration es el multiplicador de calor generado de todo el mech.
export type MechUpgradeStat =
  | 'armor'
  | 'structure'
  | 'cooling'
  | 'heatCapacity'
  | 'heatGeneration'
  | 'topSpeed'
  | 'turnSpeed'
  | 'torsoTwist'
  | 'sensorRange'
  | 'lockRetention'
  | 'loseLockTime';

// Por tipo de arma. range sube también la velocidad del proyectil.
export type WeaponUpgradeStat = 'damage' | 'range' | 'cooldown' | 'heat';

export type UpgradeStat = MechUpgradeStat | WeaponUpgradeStat;

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
