import type { Item } from '../types/item';
import type { EquippedItem, EquippedLoadout, Mech, Zone } from '../types/mech';
import {
  createEquippedItem,
  findHardpointForWeapon,
  getAvailableSlotType,
  getHardpointOccupancy,
  weaponFitsHardpoint
} from './equipment';
import { getTierName, isAmmoCompatibleWithWeapon, isClanTech } from './items';
import { ZONE_KEYS, ZONE_LABELS } from './zones';

// Acciones del menú contextual: reciben la build y devuelven la build nueva y un mensaje para el aviso.
export interface ActionResult {
  loadout: EquippedLoadout;
  message: string;
}

const TIER_ORDER = ['0', '1', '2', '3', '4', '5'];

export const LEGS: Zone[] = ['leftLeg', 'rightLeg'];

export const MIRROR_ZONES: Partial<Record<Zone, Zone>> = {
  leftArm: 'rightArm',
  rightArm: 'leftArm',
  leftTorso: 'rightTorso',
  rightTorso: 'leftTorso',
  leftLeg: 'rightLeg',
  rightLeg: 'leftLeg'
};

const unchanged = (loadout: EquippedLoadout, message: string): ActionResult => ({ loadout, message });

const copyOf = (item: Item, hardpointIndex?: number, slotType?: string): EquippedItem => {
  const copy = createEquippedItem(item, slotType, hardpointIndex);
  if (hardpointIndex === undefined) delete copy.hardpointIndex;
  if (slotType === undefined) delete copy.equippedSlotType;
  return copy;
};

const findItem = (loadout: EquippedLoadout, zone: Zone, instanceId: string) =>
  loadout[zone].find(item => item.instanceId === instanceId);

export const summarizeZones = (zones: Zone[]): string => {
  const counts = new Map<Zone, number>();
  zones.forEach(zone => counts.set(zone, (counts.get(zone) ?? 0) + 1));
  return [...counts].map(([zone, count]) => `${ZONE_LABELS[zone]}${count > 1 ? ` ×${count}` : ''}`).join(', ');
};

const formatTons = (tons: number) => `${Number.isInteger(tons) ? tons : tons.toFixed(1)} t`;

// ─── Tiers ───────────────────────────────────────────────────────────────────

const getTierSteps = (item: Item): string[] =>
  isClanTech(item) || !item.tiers ? [] : TIER_ORDER.filter(tier => item.tiers?.[tier]);

export const getAdjacentTier = (item: Item, delta: 1 | -1): string | null => {
  const steps = getTierSteps(item);
  const index = steps.indexOf(item.tier ?? '1');
  return index === -1 ? null : steps[index + delta] ?? null;
};

export const getSameWeapons = (loadout: EquippedLoadout, weapon: Item): EquippedItem[] =>
  Object.values(loadout).flat().filter(item => item.type === 'weapon' && item.id === weapon.id);

const tierLabel = (item: Item, tier: string) => getTierName({ ...item, tier }) ?? `Tier ${tier}`;

export const changeWeaponTier = (
  loadout: EquippedLoadout,
  zone: Zone,
  instanceId: string,
  delta: 1 | -1
): ActionResult => {
  const weapon = findItem(loadout, zone, instanceId);
  const tier = weapon && getAdjacentTier(weapon, delta);
  if (!weapon || !tier) return unchanged(loadout, 'No tier available');

  return {
    loadout: { ...loadout, [zone]: loadout[zone].map(item => item.instanceId === instanceId ? { ...item, tier } : item) },
    message: `${weapon.name} → ${tierLabel(weapon, tier)}`
  };
};

// Pone todas las armas iguales en el tier siguiente o anterior al del arma elegida.
export const changeAllWeaponsTier = (
  loadout: EquippedLoadout,
  zone: Zone,
  instanceId: string,
  delta: 1 | -1
): ActionResult => {
  const weapon = findItem(loadout, zone, instanceId);
  const tier = weapon && getAdjacentTier(weapon, delta);
  if (!weapon || !tier) return unchanged(loadout, 'No tier available');

  const count = getSameWeapons(loadout, weapon).length;
  const next = Object.fromEntries(ZONE_KEYS.map(key => [
    key,
    loadout[key].map(item => item.type === 'weapon' && item.id === weapon.id ? { ...item, tier } : item)
  ])) as EquippedLoadout;

  return { loadout: next, message: `${count}× ${weapon.name} → ${tierLabel(weapon, tier)}` };
};

// ─── Duplicar armas ──────────────────────────────────────────────────────────

export const countFreeHardpointsFor = (mech: Mech, loadout: EquippedLoadout, zones: Zone[], weapon: Item): number =>
  zones.reduce((total, zone) => {
    const hardpoints = mech.components[zone].hardpoints;
    const { occupiedIndices } = getHardpointOccupancy(hardpoints, loadout[zone]);
    return total + hardpoints.filter((hardpoint, index) =>
      !occupiedIndices.has(index) && weaponFitsHardpoint(hardpoint, weapon)).length;
  }, 0);

const placeWeaponCopies = (mech: Mech, loadout: EquippedLoadout, zones: Zone[], weapon: Item, limit = Infinity) => {
  let next = loadout;
  const placed: Zone[] = [];

  for (const zone of zones) {
    while (placed.length < limit) {
      const index = findHardpointForWeapon(mech.components[zone].hardpoints, next[zone], weapon);
      if (index === null) break;
      next = { ...next, [zone]: [...next[zone], copyOf(weapon, index)] };
      placed.push(zone);
    }
  }

  return { loadout: next, placed };
};

const duplicationResult = (loadout: EquippedLoadout, placed: Zone[], weapon: Item, fallback: string): ActionResult =>
  placed.length > 0
    ? { loadout, message: `Added ${placed.length}× ${weapon.name}: ${summarizeZones(placed)}` }
    : { loadout, message: fallback };

export const duplicateWeaponTo = (
  mech: Mech,
  loadout: EquippedLoadout,
  zone: Zone,
  instanceId: string,
  targetZone: Zone
): ActionResult => {
  const weapon = findItem(loadout, zone, instanceId);
  if (!weapon) return unchanged(loadout, 'Weapon not found');
  const result = placeWeaponCopies(mech, loadout, [targetZone], weapon, 1);
  return duplicationResult(result.loadout, result.placed, weapon, `No free hardpoint for ${weapon.name} in ${ZONE_LABELS[targetZone]}`);
};

export const fillWeaponInZones = (
  mech: Mech,
  loadout: EquippedLoadout,
  zone: Zone,
  instanceId: string,
  targetZones: Zone[]
): ActionResult => {
  const weapon = findItem(loadout, zone, instanceId);
  if (!weapon) return unchanged(loadout, 'Weapon not found');
  const result = placeWeaponCopies(mech, loadout, targetZones, weapon);
  return duplicationResult(result.loadout, result.placed, weapon, `No free hardpoints for ${weapon.name}`);
};

export interface ReplacePreview {
  added: number;
  replaced: EquippedItem[];
}

// Anclajes donde cabe el arma y que no tienen ya esa misma arma con el mismo tier.
const getReplaceTargets = (mech: Mech, loadout: EquippedLoadout, weapon: Item) =>
  ZONE_KEYS.flatMap(zone => {
    const hardpoints = mech.components[zone].hardpoints;
    const { weaponAssignments } = getHardpointOccupancy(hardpoints, loadout[zone]);
    return hardpoints
      .map((hardpoint, index) => ({ zone, index, hardpoint, occupant: weaponAssignments.get(index) as EquippedItem | undefined }))
      .filter(({ hardpoint, occupant }) =>
        weaponFitsHardpoint(hardpoint, weapon) &&
        !(occupant && occupant.id === weapon.id && (occupant.tier ?? '1') === (weapon.tier ?? '1')));
  });

export const getReplaceAllPreview = (mech: Mech, loadout: EquippedLoadout, weapon: Item): ReplacePreview => {
  const targets = getReplaceTargets(mech, loadout, weapon);
  return {
    added: targets.length,
    replaced: targets.flatMap(({ occupant }) => occupant ? [occupant] : [])
  };
};

export const replaceAllCompatible = (mech: Mech, loadout: EquippedLoadout, zone: Zone, instanceId: string): ActionResult => {
  const weapon = findItem(loadout, zone, instanceId);
  if (!weapon) return unchanged(loadout, 'Weapon not found');

  const targets = getReplaceTargets(mech, loadout, weapon);
  if (targets.length === 0) return unchanged(loadout, `${weapon.name} is already in every compatible hardpoint`);

  const removed = new Set(targets.flatMap(({ occupant }) => occupant ? [occupant.instanceId] : []));
  let next = Object.fromEntries(ZONE_KEYS.map(key => [
    key,
    loadout[key].filter(item => !removed.has(item.instanceId))
  ])) as EquippedLoadout;
  for (const { zone: targetZone, index } of targets) {
    next = { ...next, [targetZone]: [...next[targetZone], copyOf(weapon, index)] };
  }

  return {
    loadout: next,
    message: `Placed ${targets.length}× ${weapon.name}` +
      (removed.size > 0 ? `, replacing ${removed.size} ${removed.size === 1 ? 'weapon' : 'weapons'}` : '')
  };
};

export const describeReplaced = (items: EquippedItem[]): string => {
  const counts = new Map<string, number>();
  items.forEach(item => counts.set(item.name, (counts.get(item.name) ?? 0) + 1));
  return [...counts].map(([name, count]) => `${count}× ${name}`).join(', ');
};

// ─── Quitar armas ────────────────────────────────────────────────────────────

const removeInstance = (loadout: EquippedLoadout, zone: Zone, instanceId: string): EquippedLoadout =>
  ({ ...loadout, [zone]: loadout[zone].filter(item => item.instanceId !== instanceId) });

export const replaceWeapon = (
  mech: Mech,
  loadout: EquippedLoadout,
  zone: Zone,
  hardpointIndex: number,
  replacement: Item
): ActionResult => {
  const hardpoint = mech.components[zone].hardpoints[hardpointIndex];
  if (!hardpoint || !weaponFitsHardpoint(hardpoint, replacement)) {
    return unchanged(loadout, `${replacement.name} does not fit this hardpoint`);
  }

  const { weaponAssignments } = getHardpointOccupancy(mech.components[zone].hardpoints, loadout[zone]);
  const occupant = weaponAssignments.get(hardpointIndex) as EquippedItem | undefined;
  const remaining = occupant ? loadout[zone].filter(item => item.instanceId !== occupant.instanceId) : loadout[zone];

  return {
    loadout: { ...loadout, [zone]: [...remaining, copyOf(replacement, hardpointIndex)] },
    message: occupant ? `Replaced ${occupant.name} with ${replacement.name}` : `Added ${replacement.name}`
  };
};

export const removeWeapon = (loadout: EquippedLoadout, zone: Zone, instanceId: string): ActionResult => {
  const weapon = findItem(loadout, zone, instanceId);
  return weapon
    ? { loadout: removeInstance(loadout, zone, instanceId), message: `Removed ${weapon.name}` }
    : unchanged(loadout, 'Weapon not found');
};

// Munición que se quedaría sin uso al quitar el arma (solo si ninguna otra la usa).
export const getAmmoOnlyUsedBy = (loadout: EquippedLoadout, zone: Zone, instanceId: string): EquippedItem[] => {
  const weapon = findItem(loadout, zone, instanceId);
  if (!weapon?.ammoType) return [];
  const others = Object.values(loadout).flat()
    .filter(item => item.type === 'weapon' && item.instanceId !== instanceId);
  const ammo = Object.values(loadout).flat().filter(item => isAmmoCompatibleWithWeapon(item, weapon));
  return ammo.filter(bin => !others.some(other => isAmmoCompatibleWithWeapon(bin, other)));
};

export const removeWeaponAndAmmo = (loadout: EquippedLoadout, zone: Zone, instanceId: string): ActionResult => {
  const weapon = findItem(loadout, zone, instanceId);
  if (!weapon) return unchanged(loadout, 'Weapon not found');

  const ammo = new Set(getAmmoOnlyUsedBy(loadout, zone, instanceId).map(item => item.instanceId));
  const tons = Object.values(loadout).flat().filter(item => ammo.has(item.instanceId))
    .reduce((total, item) => total + item.tonnage, 0);
  const next = Object.fromEntries(ZONE_KEYS.map(key => [
    key,
    loadout[key].filter(item => item.instanceId !== instanceId && !ammo.has(item.instanceId))
  ])) as EquippedLoadout;

  return { loadout: next, message: `Removed ${weapon.name} and ${formatTons(tons)} of its ammo` };
};

// ─── Munición ────────────────────────────────────────────────────────────────

export interface AmmoBins {
  full?: Item;
  half?: Item;
}

export const getAmmoBins = (catalog: Item[], weapon: Item): AmmoBins => {
  const ammo = catalog.filter(item => isAmmoCompatibleWithWeapon(item, weapon));
  return {
    full: ammo.find(item => item.tonnage === 1) ?? ammo.find(item => item.tonnage >= 1),
    half: ammo.find(item => item.tonnage === 0.5)
  };
};

export const AMMO_TONNAGE_OPTIONS = [0.5, 1, 2, 3, 4];

// Reparte la munición entre los componentes de destino por turnos (p. ej. pierna izquierda y derecha).
export const addAmmoForWeapon = (
  mech: Mech,
  loadout: EquippedLoadout,
  catalog: Item[],
  weapon: Item,
  tons: number,
  targetZones: Zone[]
): ActionResult => {
  const { full, half } = getAmmoBins(catalog, weapon);
  if (!full && !half) return unchanged(loadout, `No ammo available for ${weapon.name}`);

  const bins: Item[] = [];
  let remaining = tons;
  while (full && remaining >= full.tonnage) {
    bins.push(full);
    remaining -= full.tonnage;
  }
  if (remaining > 0 && half) bins.push(half);

  let next = loadout;
  let turn = 0;
  const placed: Zone[] = [];
  let placedTons = 0;

  for (const bin of bins) {
    for (let attempt = 0; attempt < targetZones.length; attempt++) {
      const zone = targetZones[(turn + attempt) % targetZones.length];
      const slotType = getAvailableSlotType(bin, mech.components[zone], next[zone]);
      if (!slotType) continue;
      next = { ...next, [zone]: [...next[zone], copyOf(bin, undefined, slotType)] };
      placed.push(zone);
      placedTons += bin.tonnage;
      turn = (turn + attempt + 1) % targetZones.length;
      break;
    }
  }

  const ammoName = (full ?? half)!.name.replace(/\s*Half(?=\s+Ammo$)/i, '');
  const missing = Math.round((tons - placedTons) * 10) / 10;
  if (placedTons === 0) return unchanged(loadout, `No free slots for ${ammoName}, ${formatTons(tons)} not assigned`);

  return {
    loadout: next,
    message: `Added ${formatTons(placedTons)} of ${ammoName}: ${summarizeZones(placed)}` +
      (missing > 0 ? ` · ${formatTons(missing)} did not fit` : '')
  };
};

// ─── Equipo y munición ───────────────────────────────────────────────────────

export const canPlaceEquipment = (mech: Mech, loadout: EquippedLoadout, item: Item, zone: Zone): boolean =>
  getAvailableSlotType(item, mech.components[zone], loadout[zone]) !== null;

export const duplicateEquipment = (
  mech: Mech,
  loadout: EquippedLoadout,
  zone: Zone,
  instanceId: string,
  targetZone: Zone
): ActionResult => {
  const item = findItem(loadout, zone, instanceId);
  if (!item) return unchanged(loadout, 'Item not found');
  const slotType = getAvailableSlotType(item, mech.components[targetZone], loadout[targetZone]);
  if (!slotType) return unchanged(loadout, `No room for ${item.name} in ${ZONE_LABELS[targetZone]}`);

  return {
    loadout: { ...loadout, [targetZone]: [...loadout[targetZone], copyOf(item, undefined, slotType)] },
    message: `Added ${item.name} to ${ZONE_LABELS[targetZone]}`
  };
};

export const moveEquipment = (
  mech: Mech,
  loadout: EquippedLoadout,
  zone: Zone,
  instanceId: string,
  targetZone: Zone
): ActionResult => {
  const item = findItem(loadout, zone, instanceId);
  if (!item || targetZone === zone) return unchanged(loadout, 'Nothing to move');
  const slotType = getAvailableSlotType(item, mech.components[targetZone], loadout[targetZone]);
  if (!slotType) return unchanged(loadout, `No room for ${item.name} in ${ZONE_LABELS[targetZone]}`);

  const without = removeInstance(loadout, zone, instanceId);
  return {
    loadout: { ...without, [targetZone]: [...without[targetZone], copyOf(item, undefined, slotType)] },
    message: `Moved ${item.name} to ${ZONE_LABELS[targetZone]}`
  };
};

// Mueve todos los contenedores iguales de un componente a los de destino, repartiéndolos por turnos.
export const moveAllEquipment = (
  mech: Mech,
  loadout: EquippedLoadout,
  zone: Zone,
  itemName: string,
  targetZones: Zone[]
): ActionResult => {
  const items = loadout[zone].filter(item => item.name === itemName);
  let next = loadout;
  let turn = 0;
  const moved: Zone[] = [];

  for (const item of items) {
    for (let attempt = 0; attempt < targetZones.length; attempt++) {
      const targetZone = targetZones[(turn + attempt) % targetZones.length];
      if (targetZone === zone) continue;
      const slotType = getAvailableSlotType(item, mech.components[targetZone], next[targetZone]);
      if (!slotType) continue;
      next = removeInstance(next, zone, item.instanceId);
      next = { ...next, [targetZone]: [...next[targetZone], copyOf(item, undefined, slotType)] };
      moved.push(targetZone);
      turn = (turn + attempt + 1) % targetZones.length;
      break;
    }
  }

  const missing = items.length - moved.length;
  if (moved.length === 0) return unchanged(loadout, `No room to move ${itemName}`);
  return {
    loadout: next,
    message: `Moved ${moved.length}× ${itemName}: ${summarizeZones(moved)}` + (missing > 0 ? ` · ${missing} did not fit` : '')
  };
};

export const removeEquipment = (loadout: EquippedLoadout, zone: Zone, instanceId: string): ActionResult => {
  const item = findItem(loadout, zone, instanceId);
  return item
    ? { loadout: removeInstance(loadout, zone, instanceId), message: `Removed ${item.name}` }
    : unchanged(loadout, 'Item not found');
};

export const removeAllEquipment = (loadout: EquippedLoadout, zone: Zone, itemName: string): ActionResult => {
  const count = loadout[zone].filter(item => item.name === itemName).length;
  return {
    loadout: { ...loadout, [zone]: loadout[zone].filter(item => item.name !== itemName) },
    message: `Removed ${count}× ${itemName}`
  };
};
