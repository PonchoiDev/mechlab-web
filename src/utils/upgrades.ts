import upgradesData from '../data/traits.json';
import type { WeaponType } from '../types/item';
import type { Mech } from '../types/mech';
import type { MechUpgradeStat, Upgrade, UpgradeCategory, UpgradeStat, WeaponUpgradeStat } from '../types/upgrade';

export const UPGRADES = upgradesData as Upgrade[];

export const UPGRADE_CATEGORIES: UpgradeCategory[] = ['Firepower', 'Defense', 'Heat', 'Mobility', 'Targeting'];

const upgradesById = new Map(UPGRADES.map(upgrade => [upgrade.id, upgrade]));

export const getUpgrades = (ids: string[]): Upgrade[] =>
  ids.flatMap(id => upgradesById.get(id) ?? []);

export const getUsedUpgradeSlots = (upgrades: Upgrade[]): number =>
  upgrades.reduce((total, upgrade) => total + upgrade.slots, 0);

// En el juego cada mejora se instala una sola vez (la I y la II sí se pueden combinar) y entre
// todas no pueden pasar de las ranuras de mejora del mech.
export const canInstallUpgrade = (mech: Mech, installed: Upgrade[], upgrade: Upgrade): boolean =>
  !installed.some(current => current.id === upgrade.id) &&
  getUsedUpgradeSlots(installed) + upgrade.slots <= (mech.upgradeSlots ?? 0);

// Quita lo que ya no existe, se repite o no cabe, en el orden en que se instaló.
export const sanitizeUpgrades = (mech: Mech, ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  const installed: Upgrade[] = [];
  for (const id of ids) {
    const upgrade = typeof id === 'string' ? upgradesById.get(id) : undefined;
    if (upgrade && canInstallUpgrade(mech, installed, upgrade)) installed.push(upgrade);
  }
  return installed.map(upgrade => upgrade.id);
};

// Fracción que suma cada estadística del mech y, por tipo de arma, cada estadística de arma.
export type UpgradeModifiers = Record<MechUpgradeStat, number> & {
  weapon: Record<WeaponUpgradeStat, Partial<Record<WeaponType, number>>>;
};

const WEAPON_STATS: WeaponUpgradeStat[] = ['damage', 'range', 'cooldown', 'heat'];
const isWeaponStat = (stat: UpgradeStat): stat is WeaponUpgradeStat => (WEAPON_STATS as UpgradeStat[]).includes(stat);

const createModifiers = (): UpgradeModifiers => ({
  armor: 0,
  structure: 0,
  cooling: 0,
  heatCapacity: 0,
  heatGeneration: 0,
  topSpeed: 0,
  turnSpeed: 0,
  torsoTwist: 0,
  sensorRange: 0,
  lockRetention: 0,
  loseLockTime: 0,
  weapon: { damage: {}, range: {}, cooldown: {}, heat: {} }
});

export const NO_UPGRADE_MODIFIERS: UpgradeModifiers = createModifiers();

// Los porcentajes se suman: Enhanced Energy Output I y II juntos dan +15 % (en el juego, 7,8 -> 8,97).
export const getUpgradeModifiers = (upgrades: Upgrade[]): UpgradeModifiers => {
  const modifiers = createModifiers();
  for (const effect of upgrades.flatMap(upgrade => upgrade.effects)) {
    if (isWeaponStat(effect.stat)) {
      const byWeapon = modifiers.weapon[effect.stat];
      for (const weaponType of effect.weaponTypes ?? []) byWeapon[weaponType] = (byWeapon[weaponType] ?? 0) + effect.value;
    } else {
      modifiers[effect.stat] += effect.value;
    }
  }
  return modifiers;
};

// Bonus de una estadística de arma para un tipo de arma.
export const getWeaponBonus = (modifiers: UpgradeModifiers, stat: WeaponUpgradeStat, weaponType: WeaponType | null | undefined): number =>
  weaponType ? modifiers.weapon[stat][weaponType] ?? 0 : 0;
