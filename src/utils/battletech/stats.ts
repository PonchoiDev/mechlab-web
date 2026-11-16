import type { Zone } from '../../types/mech';
import type { BtBuild, BtHardpoint, BtItem } from '../../types/battletech-mechlab';
import { ZONE_KEYS } from '../zones';
import { getArmorPoints, getArmorTonnage, getEquipmentTonnage, getMaxArmorPoints, roundTonnage } from './armor';
import { countJumpJets, getAllItems, getFixedItems, getZoneItems } from './fitting';
import { BT_CONSTANTS } from './mechlabData';

// Distancias a las que se mide el daño de la salva: los alcances del juego van de 90 en 90 m.
export const RANGE_DISTANCES = [90, 180, 270, 360, 450, 540, 630, 720];

export const getBuildTonnage = (build: BtBuild): number =>
  roundTonnage(getEquipmentTonnage(build.mech, build.loadout) + getArmorTonnage(getArmorPoints(build.armor)));

export interface WeaponLine {
  item: BtItem;
  count: number;
  zones: Zone[];
  // Por arma, con los efectos del equipo: daño e inestabilidad por ataque y calor que genera.
  damage: number;
  instability: number;
  heat: number;
  heatDamage: number;
}

export interface AmmoLine {
  category: string;
  label: string;
  weapons: number;
  boxes: number;
  // Munición por ataque de todas las armas que la comparten (un LRM 20 gasta 20).
  perAttack: number;
  rounds: number;
  attacks: number;
}

export interface RangeEntry {
  distance: number;
  damage: number;
  // Daño de las armas que a esa distancia están por debajo de su alcance mínimo: disparan con penalización.
  belowMin: number;
}

export interface BonusLine {
  item: BtItem;
  count: number;
  fixed: boolean;
}

export interface BtSummary {
  tonnage: number;
  maxTonnage: number;
  freeTonnage: number;
  armorPoints: number;
  maxArmorPoints: number;
  armorTonnage: number;
  structure: number;
  heat: { dissipation: number; alpha: number; net: number; maxHeat: number; overheat: number; multiplier: number };
  alphaDamage: number;
  instability: number;
  heatDamage: number;
  maxRange: number;
  weapons: WeaponLine[];
  ammo: AmmoLine[];
  rangeProfile: RangeEntry[];
  walk: number | null;
  sprint: number | null;
  jumpJets: number;
  maxJumpJets: number;
  cost: number;
  stability: number;
  bonuses: BonusLine[];
}

const multiplierFor = (items: BtItem[], stat: string, category?: BtHardpoint) => items
  .flatMap(item => item.effects ?? [])
  .filter(effect => effect.stat === stat && effect.operation === 'Float_Multiply' && typeof effect.value === 'number'
    && (category === undefined ? effect.category === undefined : effect.category === category))
  .reduce((product, effect) => product * (effect.value as number), 1);

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

// Qué hace un arma a una distancia, como el perfil de daño por alcance: todo su daño, el que hace por
// debajo de su alcance mínimo (con penalización de precisión) o nada. Lo usa el radar para resaltar las
// armas de cada anillo.
export type BtWeaponRangeState = 'full' | 'belowMin' | 'out';

// Cada anillo cubre de la distancia del anterior a la suya (el de 90 m, de 0 a 90): un arma llega si su
// alcance máximo alcanza el borde exterior, y está por debajo de su mínimo si el borde interior queda más
// cerca, porque en parte del anillo lo está. Un PPC (90 m de mínimo) está por debajo en el de 0 a 90 m.
const ringStart = (distance: number) => Math.max(0, ...RANGE_DISTANCES.filter(other => other < distance));

export const getBtWeaponRangeState = (item: BtItem, distance: number): BtWeaponRangeState => {
  const { minRange, maxRange } = item.weapon!;
  return distance > maxRange ? 'out' : ringStart(distance) < minRange ? 'belowMin' : 'full';
};

export const getBuildSummary = (build: BtBuild): BtSummary => {
  const { mech, loadout, armor } = build;
  const items = getAllItems(mech, loadout);
  const heatSinks = items.filter(item => item.heatSink);
  const heatMultiplier = heatSinks.reduce((product, item) => product * item.heatSink!.weaponHeatMultiplier, 1);

  const lines = new Map<string, WeaponLine>();
  for (const zone of ZONE_KEYS) {
    for (const item of [...getFixedItems(mech, zone), ...getZoneItems(loadout, zone)]) {
      if (!item.weapon) continue;
      const existing = lines.get(item.id);
      if (existing) {
        existing.count += 1;
        if (!existing.zones.includes(zone)) existing.zones.push(zone);
        continue;
      }
      // Los capacitadores optimizados (+20 % a las de energía), el BSC (+20 % a las balísticas) y el
      // sistema de misiles mejorado (+50 % de inestabilidad) multiplican por categoría.
      const damageMultiplier = multiplierFor(items, 'DamagePerShot', item.hardpoint);
      const instabilityMultiplier = multiplierFor(items, 'Instability', item.hardpoint);
      lines.set(item.id, {
        item,
        count: 1,
        zones: [zone],
        damage: round(item.weapon.damage * item.weapon.shots * damageMultiplier),
        instability: round(item.weapon.instability * item.weapon.shots * instabilityMultiplier),
        heat: round(item.weapon.heat * heatMultiplier),
        heatDamage: item.weapon.heatDamage * item.weapon.shots
      });
    }
  }
  const weapons = [...lines.values()];
  const sum = (pick: (line: WeaponLine) => number) => round(weapons.reduce((total, line) => total + pick(line) * line.count, 0));

  const ammoByCategory = new Map<string, AmmoLine>();
  const ammoLine = (category: string, label: string) => {
    const line = ammoByCategory.get(category) ?? { category, label, weapons: 0, boxes: 0, perAttack: 0, rounds: 0, attacks: 0 };
    ammoByCategory.set(category, line);
    return line;
  };
  for (const line of weapons) {
    const category = line.item.weapon!.ammoCategory;
    if (!category) continue;
    const entry = ammoLine(category, line.item.baseName);
    entry.weapons += line.count;
    entry.perAttack += line.item.weapon!.shots * line.count;
    entry.rounds += line.item.weapon!.internalAmmo * line.count;
  }
  for (const item of items) {
    if (!item.ammo?.category) continue;
    const entry = ammoLine(item.ammo.category, item.baseName.replace(/ Ammo$/, '').replace(/ \(Half\)$/, ''));
    entry.boxes += 1;
    entry.rounds += item.ammo.capacity;
  }
  for (const line of ammoByCategory.values()) line.attacks = line.perAttack > 0 ? Math.floor(line.rounds / line.perAttack) : 0;

  const rangeProfile = RANGE_DISTANCES.map(distance => {
    let damage = 0;
    let belowMin = 0;
    for (const line of weapons) {
      const state = getBtWeaponRangeState(line.item, distance);
      if (state === 'belowMin') belowMin += line.damage * line.count;
      else if (state === 'full') damage += line.damage * line.count;
    }
    return { distance, damage: round(damage), belowMin: round(belowMin) };
  });

  const bonuses = new Map<string, BonusLine>();
  const fixedIds = new Set(mech.fixed.map(([, id]) => id));
  for (const item of items) {
    if (item.kind === 'weapon' || item.kind === 'ammo' || item.bonuses.length === 0) continue;
    const entry = bonuses.get(item.id) ?? { item, count: 0, fixed: fixedIds.has(item.id) };
    entry.count += 1;
    bonuses.set(item.id, entry);
  }

  const tonnage = getBuildTonnage(build);
  const armorPoints = getArmorPoints(armor);
  const dissipation = BT_CONSTANTS.internalHeatSinks * BT_CONSTANTS.internalHeatSinkDissipation
    + heatSinks.reduce((total, item) => total + item.heatSink!.dissipation, 0);
  const alpha = sum(line => line.heat);
  const maxHeat = BT_CONSTANTS.maxHeat + heatSinks.reduce((total, item) => total + item.heatSink!.maxHeat, 0);
  const walkMultiplier = multiplierFor(items, 'WalkSpeed');
  const runMultiplier = multiplierFor(items, 'RunSpeed');

  return {
    tonnage,
    maxTonnage: mech.tonnage,
    freeTonnage: roundTonnage(mech.tonnage - tonnage),
    armorPoints,
    maxArmorPoints: getMaxArmorPoints(mech),
    armorTonnage: getArmorTonnage(armorPoints),
    structure: ZONE_KEYS.reduce((total, zone) => total + mech.locations[zone].structure, 0),
    heat: {
      dissipation,
      alpha,
      net: round(alpha - dissipation),
      maxHeat,
      // El umbral de sobrecalentamiento empieza en el 60 % del calor máximo base y los bancos le suman lo suyo.
      overheat: Math.round(BT_CONSTANTS.maxHeat * BT_CONSTANTS.overheatLevel)
        + heatSinks.reduce((total, item) => total + item.heatSink!.overheat, 0),
      multiplier: heatMultiplier
    },
    alphaDamage: sum(line => line.damage),
    instability: sum(line => line.instability),
    heatDamage: sum(line => line.heatDamage),
    maxRange: weapons.reduce((max, line) => Math.max(max, line.item.weapon!.maxRange), 0),
    weapons,
    ammo: [...ammoByCategory.values()],
    rangeProfile,
    walk: mech.walk === null ? null : round(mech.walk * walkMultiplier),
    sprint: mech.sprint === null ? null : round(mech.sprint * runMultiplier),
    jumpJets: countJumpJets(mech, loadout),
    maxJumpJets: mech.maxJumpJets,
    cost: mech.chassisCost
      + ZONE_KEYS.reduce((total, zone) => total + getZoneItems(loadout, zone).reduce((zoneTotal, item) => zoneTotal + item.cost, 0), 0)
      + armorPoints * BT_CONSTANTS.cbillsPerArmorPoint,
    stability: mech.stability,
    bonuses: [...bonuses.values()]
  };
};
