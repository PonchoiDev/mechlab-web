import type { YamlBuild, YamlMech } from '../../types/yaml-mechlab';
import type { SavedBuild } from '../savedBuildsCore';
import { countWeaponTypes, type BuildListConfig, type BuildListRow, type BuildTag } from '../savedBuildsList';
import { getInternalLabel } from './board';
import { decodeYamlBuild } from './buildCode';
import { getYamlMechStats } from './combat';
import { findYamlMech, getYamlItem } from './data';
import { getWeightClass, getYamlHardpointCounts, getYamlMechDisplayName, isClanMech, isOmniMech, YAML_HARDPOINT_FILTER_TYPES } from './mechList';
import { getBuildTonnage } from './stats';

// Una build guardada del MechLab de YAML resumida para la ventana My builds, como las de MW5 (utils/savedBuildRows.ts)
// y BATTLETECH (utils/battletech/savedBuildRows.ts), con los datos de YAML (docs/specs/builds-guardadas-yaml.md).

const SHORT: Record<string, string> = { energy: 'E', ballistic: 'B', missile: 'M', omni: 'Omni', artillery: 'ART', ams: 'AMS', melee: 'MEL' };
const WEAPON_TYPES = YAML_HARDPOINT_FILTER_TYPES.filter(type => type !== 'omni');

export const YAML_BUILD_LIST: BuildListConfig = {
  // Los contadores del selector de 'Mechs de YAML: los omni cuentan como comodín.
  hardpointTypes: YAML_HARDPOINT_FILTER_TYPES.map(id => ({ id, short: SHORT[id], label: id === 'ams' ? 'AMS' : id })),
  // El equipo montado, por la etiqueta del juego de cada pieza, y lo que es la variante, como en el selector.
  featureOptions: [
    { id: 'jumpJets', label: 'Jump jets', title: 'Builds that carry jump jets' },
    { id: 'ecm', label: 'ECM', title: 'Builds that carry an ECM' },
    { id: 'ams', label: 'AMS', title: 'Builds that carry an AMS' },
    { id: 'probe', label: 'Active probe', title: 'Builds that carry an active probe' },
    { id: 'motive', label: 'Motive', title: 'Builds that carry a MASC or a supercharger' },
    { id: 'tsm', label: 'TSM', title: 'Builds that carry Triple Strength Myomer' },
    { id: 'tc', label: 'Targeting computer', title: 'Builds that carry a targeting computer' },
    { id: 'upgrades', label: 'Cantina upgrades', title: 'Builds with cantina upgrades installed' },
    { id: 'hero', label: 'Hero', title: 'Hero variants' },
    { id: 'omni', label: 'Omni', title: 'OmniMechs' },
    { id: 'superheavy', label: 'Superheavy', title: "Superheavy 'Mechs" }
  ],
  hasTechBase: true,
  weaponShort: Object.fromEntries(WEAPON_TYPES.map(type => [type, SHORT[type]])),
  weaponLabels: Object.fromEntries(WEAPON_TYPES.map(type => [type, type === 'ams' ? 'AMS' : type])),
  orderRoles: roles => [...roles].sort(),
  partGroups: [
    { id: 'engine', label: 'Engine', title: 'Engine type' },
    { id: 'structure', label: 'Structure', title: 'Internal structure' },
    { id: 'armor', label: 'Armor', title: 'Armor type' },
    { id: 'cooling', label: 'Heat sinks', title: 'Heat sink kit of the engine' }
  ]
};

// Las piezas internas de cada grupo del filtro, con el nombre del mechlab (las estándar también).
const PART_SLOTS: Record<string, string> = { engine: 'EngineTypeSlot', structure: 'Structureslot', armor: 'Armorslot', cooling: 'enginecooling' };

export interface YamlSavedBuildEntry {
  build: SavedBuild;
  // null si la build ya no se puede abrir.
  decoded: { mech: YamlMech; build: YamlBuild } | null;
  listRow: BuildListRow;
  weaponCounts: { type: string; count: number }[];
  tags: BuildTag[];
  meta: string;
}

// El equipo montado por su etiqueta del juego (EquipmentType).
const EQUIPMENT_FEATURES: { feature: string; prefixes: string[] }[] = [
  { feature: 'jumpJets', prefixes: ['Equipment.JumpJets'] },
  { feature: 'ecm', prefixes: ['Equipment.ECM'] },
  { feature: 'probe', prefixes: ['Equipment.BAP'] },
  { feature: 'motive', prefixes: ['Equipment.MASC', 'Equipment.SuperCharger', 'Equipment.ArenaSuperCharger'] },
  { feature: 'tsm', prefixes: ['Equipment.TripleStrengthMyomer'] },
  { feature: 'tc', prefixes: ['Equipment.TargetingComputer'] }
];

const hasCategory = (categories: string[], prefix: string) => categories.some(category => category === prefix || category.startsWith(`${prefix}.`));

// Las piezas internas que no son las estándar, con el color de las especificaciones de MW5 (xl, endo, ferro, dhs).
const INTERNAL_TAGS: { slotType: string; kind: string; shorten: (name: string) => string }[] = [
  { slotType: 'EngineTypeSlot', kind: 'xl', shorten: name => name },
  { slotType: 'Structureslot', kind: 'endo', shorten: name => name.replace(/^Structure /, '') },
  { slotType: 'Armorslot', kind: 'ferro', shorten: name => name.replace(/^Armor /, '') },
  { slotType: 'enginecooling', kind: 'dhs', shorten: name => name }
];

function getYamlBuildTags(build: YamlBuild, categories: string[]): BuildTag[] {
  const tags: BuildTag[] = INTERNAL_TAGS.flatMap(({ slotType, kind, shorten }) => {
    const name = build.internal[slotType] && getYamlItem(build.internal[slotType])?.name;
    return name ? [{ kind, label: shorten(name), title: name }] : [];
  });
  const jumpJets = categories.filter(category => hasCategory([category], 'Equipment.JumpJets')).length;
  if (jumpJets > 0) tags.push({ kind: 'jj', label: `JJ ${jumpJets}`, title: `${jumpJets} jump ${jumpJets === 1 ? 'jet' : 'jets'}` });
  if (hasCategory(categories, 'Equipment.ECM')) tags.push({ kind: 'ecm', label: 'ECM', title: 'ECM' });
  if (hasCategory(categories, 'Equipment.BAP')) tags.push({ kind: 'ap', label: 'AP', title: 'Active probe' });
  if (hasCategory(categories, 'Equipment.MASC')) tags.push({ kind: 'masc', label: 'MASC', title: 'MASC' });
  if (hasCategory(categories, 'Equipment.SuperCharger') || hasCategory(categories, 'Equipment.ArenaSuperCharger')) {
    tags.push({ kind: 'masc', label: 'SC', title: 'Supercharger' });
  }
  if (hasCategory(categories, 'Equipment.TripleStrengthMyomer')) tags.push({ kind: 'masc', label: 'TSM', title: 'Triple Strength Myomer' });
  if (hasCategory(categories, 'Equipment.TargetingComputer')) tags.push({ kind: 'tc', label: 'TC', title: 'Targeting computer' });
  return tags;
}

export function summarizeYamlSavedBuild(saved: SavedBuild): YamlSavedBuildEntry {
  const shared = decodeYamlBuild(saved.code);
  const mech = shared ? findYamlMech(shared.mechId) : undefined;
  const decoded = shared && mech ? { mech, build: shared.build } : null;
  if (!decoded) {
    return {
      build: saved,
      decoded: null,
      listRow: {
        id: saved.id, name: saved.name, savedAt: saved.savedAt, chassis: null, variant: null, weightClass: null, tonnage: null,
        firepower: null, hardpoints: null, weapons: null, techBase: null, roles: [], features: []
      },
      weaponCounts: [],
      tags: [],
      meta: 'This build can no longer be opened'
    };
  }
  const { build } = decoded;
  const stats = getYamlMechStats(mech!, build);
  const tonnage = getBuildTonnage(mech!, build);
  // Las armas montadas por su tipo de anclaje, sin los ataques de los actuadores (manos y antebrazos).
  const weaponTypes = build.weapons.map(weapon => getYamlItem(weapon.item)).filter(item => item && !item.actuator).map(item => item?.hardpoint);
  const weaponCounts = countWeaponTypes(weaponTypes, WEAPON_TYPES);
  const categories = build.items.map(mounted => getYamlItem(mounted.item)?.category ?? '');
  const features = [
    ...EQUIPMENT_FEATURES.filter(({ prefixes }) => prefixes.some(prefix => hasCategory(categories, prefix))).map(({ feature }) => feature),
    weaponCounts.some(entry => entry.type === 'ams') && 'ams',
    (build.traits?.length ?? 0) > 0 && 'upgrades',
    mech!.hero && 'hero',
    isOmniMech(mech!) && 'omni',
    mech!.superheavy && 'superheavy'
  ].filter((feature): feature is string => typeof feature === 'string');
  const listRow: BuildListRow = {
    id: saved.id,
    name: saved.name,
    savedAt: saved.savedAt,
    chassis: getYamlMechDisplayName(mech!),
    variant: mech!.variant,
    weightClass: getWeightClass(mech!.tonnage),
    tonnage,
    firepower: stats.alphaDamage,
    hardpoints: getYamlHardpointCounts(mech!),
    weapons: Object.fromEntries(weaponCounts.map(({ type, count }) => [type, count])),
    techBase: isClanMech(mech!) ? 'Clan' : 'InnerSphere',
    roles: mech!.role ? [mech!.role] : [],
    features,
    parts: Object.fromEntries(Object.entries(PART_SLOTS).map(([group, slotType]) => [group, getInternalLabel(build, slotType)]))
  };
  return {
    build: saved,
    decoded,
    listRow,
    weaponCounts,
    tags: getYamlBuildTags(build, categories),
    meta: `${getYamlMechDisplayName(mech!)} ${mech!.variant} · ${tonnage.toFixed(2)} / ${mech!.tonnage} t · ${stats.alphaDamage} alpha`
  };
}
