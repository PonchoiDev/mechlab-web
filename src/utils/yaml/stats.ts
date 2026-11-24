import type { Zone } from '../../types/mech';
import type { YamlBuild, YamlMech } from '../../types/yaml-mechlab';
import { getYamlItem, getYamlQuirk } from './data';

// Reglas de peso, velocidad y calor de YAML, contrastadas con capturas del mechlab del juego
// (docs/specs/mechlab-yaml.md, criterios CA1 a CA14).

export const GENERAL_SLOT = 'General_SlotType';
// La cabina estándar pesa 3 t; las demás dicen su peso respecto a ella (la Small, −1).
const COCKPIT_TONS = 3;
const STANDARD_ARMOR_PER_TON = 32;
// Capacidad de calor sin disipadores (el NSR-9J vacío marca 30 aunque su MDA diga 50).
const BASE_HEAT_CAPACITY = 30;
// El núcleo trae un disipador por cada 25 de potencia, como mucho 10; cada uno que falta hasta 10
// resta 1 t (con el núcleo 105, 4 disipadores y −6 t).
const RATING_PER_ENGINE_HEAT_SINK = 25;
const FREE_HEAT_SINKS = 10;
// Velocidad máxima = potencia / tonelaje × 16,2, como en MW5.
const SPEED_FACTOR = 16.2;
// Las piezas internas con su propia regla de peso; el resto de las ranuras propias suma su peso tal cual.
const WEIGHED_APART = new Set(['Engine', 'EngineTypeSlot', 'Gyro', 'cockpit', 'Structureslot', 'Armorslot']);

// YAML redondea hacia arriba a la media tonelada el motor, el giroscopio y la estructura (Endo en 95 t:
// 4,75 → 5,0), pero no la armadura (Primitive: 104,16).
function roundUpToHalf(tons: number): number {
  return Math.ceil(tons * 2 - 1e-9) / 2;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function internal(build: YamlBuild, slotType: string) {
  return getYamlItem(build.internal[slotType]);
}

export function getEngineRating(build: YamlBuild): number {
  return internal(build, 'Engine')?.rating ?? 0;
}

export function getEngineHeatSinks(build: YamlBuild): number {
  const rating = getEngineRating(build);
  return rating ? Math.min(Math.floor(rating / RATING_PER_ENGINE_HEAT_SINK), FREE_HEAT_SINKS) : 0;
}

function engineTons(build: YamlBuild): number {
  const core = internal(build, 'Engine');
  if (!core?.rating) return 0;
  return roundUpToHalf(core.tons * (1 + (internal(build, 'EngineTypeSlot')?.engineRelativeWeight ?? 0)));
}

function gyroTons(build: YamlBuild): number {
  const rating = getEngineRating(build);
  return rating ? roundUpToHalf(Math.ceil(rating / 100) * (internal(build, 'Gyro')?.relativeWeight ?? 1)) : 0;
}

function structureTons(mech: YamlMech, build: YamlBuild): number {
  return roundUpToHalf(mech.tonnage / 10 * (internal(build, 'Structureslot')?.structureWeightMulti ?? 1));
}

export function getArmorTons(build: YamlBuild): number {
  const armor = internal(build, 'Armorslot');
  const points = Object.values(build.armor).reduce((sum, side) => sum + side.front + side.rear, 0);
  return points / (armor?.armorPerTon ?? STANDARD_ARMOR_PER_TON) * (armor?.armorWeightMulti ?? 1);
}

export function getBuildTonnage(mech: YamlMech, build: YamlBuild): number {
  const otherInternals = Object.entries(build.internal)
    .filter(([slotType]) => !WEIGHED_APART.has(slotType))
    .reduce((sum, [, id]) => sum + (getYamlItem(id)?.tons ?? 0), 0);
  const mounted = [...build.items, ...build.weapons].reduce((sum, mountedItem) => sum + (getYamlItem(mountedItem.item)?.tons ?? 0), 0);
  const missingHeatSinks = getEngineRating(build) ? FREE_HEAT_SINKS - getEngineHeatSinks(build) : 0;
  return round2(engineTons(build) + gyroTons(build) + COCKPIT_TONS + (internal(build, 'cockpit')?.tons ?? 0)
    + structureTons(mech, build) + getArmorTons(build) + otherInternals + mounted - missingHeatSinks);
}

export function getTopSpeed(mech: YamlMech, build: YamlBuild): number {
  return round2(getEngineRating(build) / mech.tonnage * SPEED_FACTOR);
}

export function getHeat(_mech: YamlMech, build: YamlBuild): { cooling: number; capacity: number } {
  const kit = internal(build, 'enginecooling');
  const engineHeatSinks = getEngineHeatSinks(build);
  let cooling = engineHeatSinks * (kit?.engineHeatsinkEfficiency ?? 0.1) + (kit?.cooling ?? 0);
  let capacity = BASE_HEAT_CAPACITY + engineHeatSinks * (kit?.engineHeatsinkCapacity ?? 1);
  for (const mountedItem of build.items) {
    const item = getYamlItem(mountedItem.item);
    cooling += item?.cooling ?? 0;
    capacity += item?.heatCapacity ?? 0;
  }
  return { cooling: round2(cooling), capacity: round2(capacity) };
}

function quirkBonus(mech: YamlMech, property: 'armorBonus' | 'structureBonus'): number {
  return mech.quirks.reduce((sum, id) => {
    const bonus = getYamlQuirk(id)?.properties[property] as Record<string, number> | undefined;
    return sum + Object.values(bonus ?? {}).reduce((total, value) => total + value, 0);
  }, 0);
}

// Los puntos de armadura de los quirks no pesan ni cuentan para el máximo («24+7/30»).
export function getArmorPoints(mech: YamlMech, build: YamlBuild): { installed: number; bonus: number } {
  const installed = Object.values(build.armor).reduce((sum, side) => sum + side.front + side.rear, 0);
  return { installed, bonus: quirkBonus(mech, 'armorBonus') };
}

export function getStructurePoints(mech: YamlMech, build: YamlBuild): { base: number; total: number } {
  const base = Object.values(mech.zones).reduce((sum, zone) => sum + zone.structure, 0);
  const multiplier = internal(build, 'Structureslot')?.structureMulti ?? 1;
  const bonus = quirkBonus(mech, 'structureBonus');
  return { base: base + bonus, total: base * multiplier + bonus };
}

// Ranuras generales que necesitan, repartidas por el 'Mech, el Endo, el Ferro y demás.
export function getDynamicFillers(build: YamlBuild): number {
  return Object.values(build.internal).reduce((sum, id) => sum + (getYamlItem(id)?.fillerSlots?.dynamic ?? 0), 0);
}

// Ranuras generales fijas en una ubicación: las del motor XL en los torsos laterales.
export function getFixedFillers(build: YamlBuild, zone: Zone): number {
  return Object.values(build.internal).reduce((sum, id) => sum + (getYamlItem(id)?.fillerSlots?.[zone] ?? 0), 0);
}

// Ranuras generales libres de una ubicación, antes de colocar los rellenos dinámicos.
export function getFreeGeneralSlots(mech: YamlMech, build: YamlBuild, zone: Zone): number {
  const items = build.items.filter(item => item.zone === zone && item.slotType === GENERAL_SLOT);
  const weapons = build.weapons.filter(weapon => weapon.zone === zone);
  const used = [...items, ...weapons].reduce((sum, mounted) => sum + (getYamlItem(mounted.item)?.slots ?? 1), 0);
  return mech.zones[zone].general - getFixedFillers(build, zone) - used;
}

export function getTotalFreeGeneralSlots(mech: YamlMech, build: YamlBuild): number {
  return (Object.keys(mech.zones) as Zone[]).reduce((sum, zone) => sum + getFreeGeneralSlots(mech, build, zone), 0);
}
