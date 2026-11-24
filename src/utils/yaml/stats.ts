import type { Zone } from '../../types/mech';
import type { YamlBuild, YamlItem, YamlMech } from '../../types/yaml-mechlab';
import { getYamlItem, getYamlQuirk } from './data';

// Peso, motor, refrigeración, velocidad, armadura y estructura como los calcula YAML, leídos de sus blueprints
// (desensamblados con tools/kismet.py): CalculateMechTonnage y GetEquipmentWeightInternal (MechlabArmorHandling),
// DLCGetInstalledInternals y MechCalculateCoolingCapacity (MechlabFunctionLibrary_79), GetCoolingMultisForLoadout,
// GetTotalArmorWithBonuses y GetASBonusesFromLoadout (MechSetup). Las cifras de referencia, en
// gameReference.test.ts y combat.test.ts.

export const GENERAL_SLOT = 'General_SlotType';
// CalculateMechTonnage: la cabina estándar pesa 3 t (las demás suman su peso) y la armadura, 32 puntos por
// tonelada si la pieza de armadura no dice otra cosa.
const COCKPIT_TONS = 3;
const STANDARD_ARMOR_PER_TON = 32;
// MechCalculateCoolingCapacity: capacidad sin disipadores (yamlDefaultHeatCapacity) y lo que da cada disipador
// del motor sin kit (0,1 de refrigeración y 1 de capacidad).
const BASE_HEAT_CAPACITY = 30;
const ENGINE_HEAT_SINK_COOLING = 0.1;
// DLCGetInstalledInternals: un disipador por cada 25 de potencia, como mucho 10; cada uno que falta pesa −1 t.
const RATING_PER_ENGINE_HEAT_SINK = 25;
const FREE_HEAT_SINKS = 10;
const SPEED_FACTOR = 16.2;
// Los motores primitivos rinden como uno de potencia / 1,2, redondeada al múltiplo de 5 superior.
const PRIMITIVE_RATING_DIVISOR = 1.2;

// El juego y YAML calculan en float32; Round de Unreal redondea .5 hacia arriba (FloorToInt(x + 0.5)).
const f = Math.fround;
const ueRound = (value: number) => Math.floor(value + 0.5);
const hasTag = (tag: string | undefined, parent: string) => !!tag && (tag === parent || tag.startsWith(`${parent}.`));
const tagContains = (tag: string | undefined, text: string) => !!tag && tag.toLowerCase().includes(text.toLowerCase());

// RoundToHalfTon, RoundToQuarterTon y RoundToFullTon de MechlabArmorHandling.
function roundTo(value: number, steps: number, alwaysUp: boolean): number {
  const scaled = f(value * steps);
  return (alwaysUp ? Math.ceil(scaled) : ueRound(scaled)) / steps;
}

// AddMulti de YAML: los multiplicadores se suman (a + b − 1), como mínimo 0,001.
export function addMulti(a: number, b: number): number {
  return Math.max(0.001, f(a + f(b - 1)));
}

export interface InstalledEquipment {
  zone: Zone;
  item: YamlItem;
}

// GetAllEquipment del juego: lo montado en las ranuras, también las piezas internas, cada una en la ubicación de su
// ranura propia. Una ranura interna vacía no monta nada.
export function getInstalledEquipment(mech: YamlMech, build: YamlBuild): InstalledEquipment[] {
  const zones = Object.keys(mech.zones) as Zone[];
  const internals = Object.entries(build.internal).map(([slotType, id]) => ({
    zone: zones.find(zone => (mech.zones[zone].special[slotType] ?? 0) > 0) ?? 'centerTorso',
    item: getYamlItem(id)
  }));
  const slotted = build.items.map(mounted => ({ zone: mounted.zone, item: getYamlItem(mounted.item) }));
  return [...internals, ...slotted].filter((entry): entry is InstalledEquipment => !!entry.item);
}

export function getQuirkProperties(mech: YamlMech): Record<string, unknown>[] {
  return mech.quirks.map(id => getYamlQuirk(id)?.properties ?? {});
}

// GetAllLoadoutProperties de YAML: las propiedades de todo lo montado y las de los quirks.
export function getLoadoutProperties(mech: YamlMech, build: YamlBuild): Record<string, unknown>[] {
  return [...getInstalledEquipment(mech, build).map(({ item }) => item as unknown as Record<string, unknown>), ...getQuirkProperties(mech)];
}

const numberOf = (entry: Record<string, unknown>, key: string): number | undefined =>
  typeof entry[key] === 'number' ? entry[key] as number : undefined;

function sumMultiplier(properties: Record<string, unknown>[], key: string): number {
  return properties.reduce((total, entry) => {
    const value = numberOf(entry, key);
    return value === undefined ? total : addMulti(value, total);
  }, 1);
}

function internal(build: YamlBuild, slotType: string): YamlItem | undefined {
  return getYamlItem(build.internal[slotType]);
}

// El núcleo del motor (Equipment.Engine.Core) y su tipo (Equipment.Engine.Type).
function engineCore(build: YamlBuild): YamlItem | undefined {
  const core = internal(build, 'Engine');
  return core && hasTag(core.category, 'Equipment.Engine.Core') ? core : undefined;
}

function engineType(build: YamlBuild): YamlItem | undefined {
  const type = internal(build, 'EngineTypeSlot');
  return type && hasTag(type.category, 'Equipment.Engine.Type') ? type : undefined;
}

// El kit de refrigeración del motor: lo montado con Equipment.Cooling en su etiqueta.
function coolingKit(mech: YamlMech, build: YamlBuild): YamlItem | undefined {
  return getInstalledEquipment(mech, build).filter(({ item }) => tagContains(item.category, 'Equipment.Cooling')).at(-1)?.item;
}

export function getEngineRating(build: YamlBuild): number {
  return engineCore(build)?.rating ?? 0;
}

// DLCGetInstalledInternals: los disipadores del motor (bundledHeatsinks del kit por cada 25 de potencia, como mucho
// 10, más internalHeatsinkBonus) y los que faltan hasta 10, que restan 1 t cada uno.
function engineInternals(mech: YamlMech, build: YamlBuild): { heatSinks: number; missing: number; cores: number } {
  const core = engineCore(build);
  if (!core) return { heatSinks: 0, missing: 0, cores: 0 };
  const kit = getInstalledEquipment(mech, build).filter(({ zone, item }) => zone === 'centerTorso' && tagContains(item.category, 'Equipment.Cooling')).at(-1)?.item;
  const bundled = kit?.bundledHeatsinks ?? 1;
  const bonus = getLoadoutProperties(mech, build).reduce((total, entry) => total + (numberOf(entry, 'internalHeatsinkBonus') ?? 0), 0);
  const perRating = bundled * Math.trunc((core.rating ?? 0) / RATING_PER_ENGINE_HEAT_SINK);
  let heatSinks = perRating >= FREE_HEAT_SINKS ? FREE_HEAT_SINKS : perRating;
  let missing: number;
  if (bonus > 0) {
    heatSinks += bonus;
    missing = Math.max(FREE_HEAT_SINKS - heatSinks, 0);
  } else {
    const room = FREE_HEAT_SINKS + bonus - heatSinks;
    missing = Math.max(room, 0);
    heatSinks += Math.min(room, 0);
  }
  return { heatSinks, missing, cores: 1 };
}

export function getEngineHeatSinks(build: YamlBuild, mech?: YamlMech): number {
  if (!mech) {
    const rating = getEngineRating(build);
    return rating ? Math.min(Math.trunc(rating / RATING_PER_ENGINE_HEAT_SINK), FREE_HEAT_SINKS) : 0;
  }
  return engineInternals(mech, build).heatSinks;
}

// GetTypedEngineWeight: el peso del núcleo más el de su tipo (engineRelativeWeight × núcleo, hacia arriba a 0,5 t).
function typedEngineWeight(core: YamlItem, type: YamlItem | undefined): number {
  const relative = type?.engineRelativeWeight;
  return core.tons + (relative === undefined ? 0 : roundTo(f(relative * core.tons), 2, true));
}

// GetRelativeEquipmentWeight: relativeWeight × tonelaje máximo, redondeado a cuartos (o a medias o a toneladas
// enteras, según roundWeightType; hacia arriba si la pieza tiene roundWeightUp), con un mínimo de ±0,25 (±0,5, ±1).
function relativeEquipmentWeight(item: YamlItem, maxTonnage: number): number {
  const relative = item.relativeWeight ?? 0;
  const alwaysUp = item.roundWeightUp !== undefined;
  const type = (item.roundWeightType ?? 'quarterTon').toLowerCase();
  const steps = type === 'halfton' ? 2 : type === 'fullton' ? 1 : 4;
  const rounded = roundTo(f(relative * maxTonnage), steps, alwaysUp);
  const minimum = 1 / steps;
  return relative < 0 ? Math.min(rounded, -minimum) : Math.max(rounded, minimum);
}

// GetEquipmentWeightInternal: el giroscopio pesa la diferencia con el estándar; lo que tiene relativeWeight, una
// parte del tonelaje; lo que tiene engineRelativeWeight, una parte del motor; el resto, su peso.
function equipmentWeight(item: YamlItem, build: YamlBuild, maxTonnage: number, standardGyro: number, cores: number): number {
  if (hasTag(item.category, 'Equipment.Gyro')) {
    if (cores === 0) return 0;
    if (item.relativeWeight !== undefined) return roundTo(f(Math.abs(f(item.relativeWeight * standardGyro)) - standardGyro), 2, false);
  } else if (item.relativeWeight !== undefined) {
    return relativeEquipmentWeight(item, maxTonnage);
  }
  if (item.engineRelativeWeight !== undefined) {
    const core = engineCore(build);
    if (cores === 0 || !core) return 0;
    const type = hasTag(item.category, 'Equipment.Engine.Type') ? undefined : engineType(build);
    return cores * roundTo(f(item.engineRelativeWeight * typedEngineWeight(core, type)), 2, true);
  }
  return item.tons;
}

// CalculateStructureWeightMulti: structureWeightMulti, o el TechLevel / 100 del Endo (1 + TechLevel / 100 la
// reforzada).
function structureWeightMulti(item: YamlItem): number | undefined {
  if (!tagContains(item.category, 'Internal.Structure')) return undefined;
  if (item.structureWeightMulti !== undefined) return item.structureWeightMulti;
  if (tagContains(item.category, 'Internal.Structure.Endo')) return (item.techLevel ?? 0) / 100;
  if (tagContains(item.category, 'Internal.Structure.Reinforced')) return 1 + (item.techLevel ?? 0) / 100;
  return undefined;
}

// CalculateArmorPerTon: armorPerTon, o 32 / armorWeightMulti, o el TechLevel / 100.
function armorPerTon(item: YamlItem): number | undefined {
  if (!tagContains(item.category, 'Internal.Armor')) return undefined;
  if (item.armorPerTon !== undefined) return item.armorPerTon;
  if (item.armorWeightMulti !== undefined) return 32 / item.armorWeightMulti;
  return (item.techLevel ?? 0) / 100;
}

function getArmorPerTon(mech: YamlMech, build: YamlBuild): number {
  let perTon = STANDARD_ARMOR_PER_TON;
  for (const { item } of getInstalledEquipment(mech, build)) perTon = armorPerTon(item) ?? perTon;
  return perTon;
}

// La armadura pesa sus puntos / armorPerTon, por el componentArmorWeightMulti de lo montado en cada ubicación.
export function getArmorTons(build: YamlBuild, mech?: YamlMech): number {
  if (!mech) {
    const points = Object.values(build.armor).reduce((sum, side) => sum + side.front + side.rear, 0);
    return points / STANDARD_ARMOR_PER_TON;
  }
  const equipment = getInstalledEquipment(mech, build);
  const tonsPerPoint = f(1 / getArmorPerTon(mech, build));
  return (Object.keys(build.armor) as Zone[]).reduce((sum, zone) => {
    const multi = equipment.filter(entry => entry.zone === zone && entry.item.componentArmorWeightMulti !== undefined)
      .reduce((total, entry) => addMulti(entry.item.componentArmorWeightMulti!, total), 1);
    return f(sum + f(f((build.armor[zone].front + build.armor[zone].rear) * tonsPerPoint) * multi));
  }, 0);
}

export function getBuildTonnage(mech: YamlMech, build: YamlBuild): number {
  const maxTonnage = mech.tonnage;
  const core = engineCore(build);
  const { missing, cores } = engineInternals(mech, build);
  let tons = build.weapons.reduce((sum, weapon) => sum + (getYamlItem(weapon.item)?.tons ?? 0), 0);
  tons += COCKPIT_TONS;
  // GetStandardGyroWeightFromEngine: potencia / 100 hacia arriba.
  const standardGyro = core ? Math.ceil(f((core.rating ?? 0) / 100)) : 0;
  tons += standardGyro;
  let structureMulti = 1;
  for (const { item } of getInstalledEquipment(mech, build)) {
    tons += equipmentWeight(item, build, maxTonnage, standardGyro, cores);
    structureMulti = structureWeightMulti(item) ?? structureMulti;
  }
  tons -= missing;
  tons += roundTo(f(f(maxTonnage / 10) * structureMulti), 2, false);
  tons += getArmorTons(build, mech);
  // Si falta menos de lo que pesa un punto de armadura para el máximo, el juego da el máximo; después redondea a
  // centésimas.
  if (tons < maxTonnage && maxTonnage - tons < 1 / getArmorPerTon(mech, build)) tons = maxTonnage;
  return ueRound(tons * 100) / 100;
}

// DLCGetInstalledInternals: potencia (la de los primitivos, rebajada) / tonelaje × 16,2, × (1 + TopSpeedPercent),
// con TopSpeedPercent = topSpeedMulti de lo montado y los quirks − 1.
export function getTopSpeed(mech: YamlMech, build: YamlBuild): number {
  const core = engineCore(build);
  if (!core) return 0;
  const rating = core.rating ?? 0;
  const primitive = engineType(build)?.engineHealthType?.toLowerCase() === 'primitive';
  const effectiveRating = primitive ? Math.ceil(Math.trunc(f(rating / PRIMITIVE_RATING_DIVISOR)) / 5) * 5 : rating;
  const maxSpeed = f(f(effectiveRating / mech.tonnage) * f(SPEED_FACTOR));
  const topSpeedPercent = f(sumMultiplier(getLoadoutProperties(mech, build), 'topSpeedMulti') - 1);
  return f(maxSpeed + f(maxSpeed * topSpeedPercent));
}

// GetCoolingMultisForLoadout: 1 en cada ubicación; coolingMulti del equipo con coolingMultiScope «component» en la
// suya, y el resto (equipo y quirks) en todo el 'Mech.
function getCoolingMultis(mech: YamlMech, build: YamlBuild): Record<Zone, number> {
  const zones = Object.keys(mech.zones) as Zone[];
  const multis = Object.fromEntries(zones.map(zone => [zone, 1])) as Record<Zone, number>;
  for (const { zone, item } of getInstalledEquipment(mech, build)) {
    if (item.coolingMulti !== undefined && item.coolingMultiScope === 'component') multis[zone] = addMulti(multis[zone], item.coolingMulti);
  }
  const mechWide = getLoadoutProperties(mech, build).reduce((total, entry) => {
    const value = numberOf(entry, 'coolingMulti');
    return value === undefined || entry.coolingMultiScope === 'component' ? total : addMulti(total, value);
  }, 1);
  for (const zone of zones) multis[zone] = addMulti(multis[zone], mechWide);
  return multis;
}

// MechCalculateCoolingCapacity: los disipadores del motor dan la refrigeración y la capacidad de su kit
// (engineHeatsinkEfficiency / 0,1 y engineHeatsinkCapacity, o su TechLevel / 100), por el multiplicador del torso
// central; los disipadores montados (Equipment.HeatSinks), la suya por el de su ubicación; el resto de piezas
// de disipador (los kits), la suya; y la capacidad suma 30 y los heatCapacityBonus.
export function getHeat(mech: YamlMech, build: YamlBuild): { cooling: number; capacity: number } {
  const { heatSinks } = engineInternals(mech, build);
  const multis = getCoolingMultis(mech, build);
  const kit = coolingKit(mech, build);
  const coolingMulti = kit ? (kit.engineHeatsinkEfficiency !== undefined ? f(kit.engineHeatsinkEfficiency / f(ENGINE_HEAT_SINK_COOLING)) : f((kit.techLevel ?? 0) / 100)) : 1;
  const capacityMulti = kit ? (kit.engineHeatsinkCapacity ?? f((kit.techLevel ?? 0) / 100)) : 1;
  let cooling = f(f(f(heatSinks * f(ENGINE_HEAT_SINK_COOLING)) * coolingMulti) * multis.centerTorso);
  let capacity = f(f(heatSinks * capacityMulti) + BASE_HEAT_CAPACITY);
  for (const { zone, item } of getInstalledEquipment(mech, build)) {
    if (!item.heatSinkAsset) continue;
    const efficiency = item.cooling ?? 0;
    cooling = f(cooling + (hasTag(item.category, 'Equipment.HeatSinks') ? f(efficiency * multis[zone]) : efficiency));
    capacity = f(capacity + (item.heatCapacity ?? 0));
  }
  for (const entry of getLoadoutProperties(mech, build)) capacity = f(capacity + (numberOf(entry, 'heatCapacityBonus') ?? 0));
  return { cooling, capacity };
}

type Surface = `${Zone}:${'front' | 'rear'}`;
const PART_NAMES: Record<string, Zone> = {
  Head: 'head', CenterTorso: 'centerTorso', LeftTorso: 'leftTorso', RightTorso: 'rightTorso',
  LeftArm: 'leftArm', RightArm: 'rightArm', LeftLeg: 'leftLeg', RightLeg: 'rightLeg'
};

// GetASBonusesFromLoadout: lo que suman el equipo y las armas montadas (sin los ataques de los actuadores) a cada
// superficie (armorComponentFront, armorComponentRear, structureComponent), sus multiplicadores por superficie, los
// bonus de los quirks por ubicación y su multiplicador para todo el 'Mech (armorMulti, structureMulti).
function getBonuses(mech: YamlMech, build: YamlBuild, structure: boolean) {
  const bonuses = new Map<Surface, number>();
  const multis = new Map<Surface, number>();
  const add = (surface: Surface, value: number) => bonuses.set(surface, (bonuses.get(surface) ?? 0) + value);
  const multiply = (surface: Surface, value: number) => multis.set(surface, addMulti(value, multis.get(surface) ?? 1));
  const sources: InstalledEquipment[] = [
    ...getInstalledEquipment(mech, build),
    ...build.weapons.map(weapon => ({ zone: weapon.zone, item: getYamlItem(weapon.item) }))
      .filter((entry): entry is InstalledEquipment => !!entry.item && !entry.item.actuator)
  ];
  for (const { zone, item } of sources) {
    const front = structure ? item.structureComponent : item.armorComponentFront;
    if (front !== undefined) add(`${zone}:front`, front);
    if (!structure && item.armorComponentRear !== undefined && mech.zones[zone].rear) add(`${zone}:rear`, item.armorComponentRear);
    const frontMulti = structure ? item.structureComponentMulti : item.armorComponentFrontMulti;
    if (frontMulti !== undefined) multiply(`${zone}:front`, frontMulti);
  }
  let mechMulti = 1;
  for (const properties of getQuirkProperties(mech)) {
    const perPart = properties[structure ? 'structureBonus' : 'armorBonus'] as Record<string, number> | undefined;
    for (const [part, value] of Object.entries(perPart ?? {})) if (PART_NAMES[part]) add(`${PART_NAMES[part]}:front`, value);
    const multi = numberOf(properties, structure ? 'structureMulti' : 'armorMulti');
    if (multi !== undefined) mechMulti = addMulti(multi, mechMulti);
  }
  return { bonuses, multis, mechMulti };
}

// GetTotalArmorWithBonuses: por superficie, (instalada + bonus) × su multiplicador; todo × el de los quirks. Los
// bonus no pesan ni cuentan para el máximo («24+7/30»).
export function getArmorPoints(mech: YamlMech, build: YamlBuild): { installed: number; bonus: number } {
  const { bonuses, multis, mechMulti } = getBonuses(mech, build, false);
  let installed = 0;
  let total = 0;
  for (const zone of Object.keys(build.armor) as Zone[]) {
    for (const side of ['front', 'rear'] as const) {
      const points = build.armor[zone][side];
      const surface: Surface = `${zone}:${side}`;
      installed += points;
      total = f(total + f(f(points + (bonuses.get(surface) ?? 0)) * (multis.get(surface) ?? 1)));
    }
  }
  return { installed, bonus: f(total * mechMulti) - installed };
}

// Get Total Struct With Bonuses: por ubicación, la máxima (× el structureMulti de la estructura montada) × su
// multiplicador × el de los quirks, más su bonus.
export function getStructurePoints(mech: YamlMech, build: YamlBuild): { base: number; total: number } {
  const { bonuses, multis, mechMulti } = getBonuses(mech, build, true);
  const itemMulti = internal(build, 'Structureslot')?.structureMulti ?? 1;
  let base = 0;
  let total = 0;
  for (const zone of Object.keys(mech.zones) as Zone[]) {
    const surface: Surface = `${zone}:front`;
    const bonus = bonuses.get(surface) ?? 0;
    base += mech.zones[zone].structure + bonus;
    total = f(total + f(f(f(mech.zones[zone].structure * itemMulti) * (multis.get(surface) ?? 1)) * mechMulti) + bonus);
  }
  return { base, total };
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
