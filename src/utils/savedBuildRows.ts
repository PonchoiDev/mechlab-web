import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { decodeBuild, type SharedBuild } from './buildCode';
import { getBuildTags } from './buildTags';
import { getBuildSummary } from './calculators';
import { getItemWeaponType } from './items';
import { getHardpointCounts, getMechDisplayName, getMechWeightClass, HARDPOINT_ABBREVIATIONS } from './mechs';
import type { SavedBuild } from './savedBuildsCore';
import { countWeaponTypes, type BuildListConfig, type BuildListRow, type BuildTag } from './savedBuildsList';
import { getUpgrades } from './upgrades';

// Una build guardada de MW5 resumida para las listas de builds: la ventana My builds y el comparador.

export const WEAPON_TYPE_ORDER = ['energy', 'ballistic', 'missile', 'artillery', 'ams', 'melee'];

export const MERCS_BUILD_LIST: BuildListConfig = {
  // Los mismos contadores que el selector de 'Mechs: los omni cuentan como comodín.
  hardpointTypes: (['energy', 'ballistic', 'missile', 'omni'] as const).map(id => ({
    id,
    short: HARDPOINT_ABBREVIATIONS[id].trim(),
    label: id
  })),
  // Los botones de Equipment del selector de 'Mechs, más Hero. Aquí miran lo que lleva montado cada build.
  featureOptions: [
    { id: 'jumpJets', label: 'Jump jets', title: 'Builds that carry jump jets' },
    { id: 'ecm', label: 'ECM', title: 'Builds that carry an ECM' },
    { id: 'ams', label: 'AMS', title: 'Builds that carry an AMS' },
    { id: 'probe', label: 'Active probe', title: 'Builds with an active probe, built in or mounted' },
    { id: 'motive', label: 'Motive', title: 'Builds that carry a MASC or a Supercharger' },
    { id: 'hero', label: 'Hero', title: 'Hero variants' }
  ],
  hasTechBase: true,
  weaponShort: { energy: 'E', ballistic: 'B', missile: 'M', artillery: 'ART', ams: 'AMS', melee: 'MEL' },
  weaponLabels: { energy: 'energy', ballistic: 'ballistic', missile: 'missile', artillery: 'artillery', ams: 'AMS', melee: 'melee' },
  orderRoles: roles => [...roles].sort()
};

export interface SavedBuildEntry {
  build: SavedBuild;
  // null si la build ya no se puede abrir.
  shared: SharedBuild | null;
  summary: ReturnType<typeof getBuildSummary> | null;
  listRow: BuildListRow;
  weaponCounts: { type: string; count: number }[];
  tags: BuildTag[];
  // La línea de cifras bajo el nombre.
  meta: string;
}

// La build se reconstruye con los datos actuales del juego, para enseñar su 'Mech y sus cifras de ahora.
export const summarizeSavedBuild = (build: SavedBuild, mechs: Mech[], catalog: Item[]): SavedBuildEntry => {
  const shared = decodeBuild(build.code, mechs, catalog);
  const summary = shared ? getBuildSummary(shared.mech, shared.loadout, shared.armor, getUpgrades(shared.upgrades)) : null;
  const items = shared ? Object.values(shared.loadout).flat() : [];
  const weaponCounts = countWeaponTypes(items.filter(item => item.type === 'weapon').map(getItemWeaponType), WEAPON_TYPE_ORDER);
  const weapons: Partial<Record<string, number>> = Object.fromEntries(weaponCounts.map(({ type, count }) => [type, count]));
  // Lo que lleva montado, no lo que admite el chasis: en una lista de builds importa lo que tiene cada una.
  const features = shared ? [
    items.some(item => item.equipmentType === 'jumpJet') && 'jumpJets',
    items.some(item => item.ecm) && 'ecm',
    (weapons.ams ?? 0) > 0 && 'ams',
    // Como la etiqueta AP: la sonda de serie del chasis también cuenta.
    (shared.mech.activeProbe || items.some(item => item.probe)) && 'probe',
    items.some(item => item.masc) && 'motive',
    shared.mech.hero && 'hero'
  ].filter((feature): feature is string => typeof feature === 'string') : [];
  const listRow: BuildListRow = {
    id: build.id,
    name: build.name,
    savedAt: build.savedAt,
    chassis: shared ? getMechDisplayName(shared.mech) : null,
    variant: shared?.mech.variant ?? null,
    weightClass: shared ? getMechWeightClass(shared.mech) : null,
    tonnage: summary?.totalWeight ?? null,
    firepower: summary?.firepower ?? null,
    hardpoints: shared ? getHardpointCounts(shared.mech) : null,
    weapons: shared ? weapons : null,
    techBase: shared ? (shared.mech.techBase === 'Clan' ? 'Clan' : 'InnerSphere') : null,
    roles: shared?.mech.role ? [shared.mech.role] : [],
    features
  };
  const meta = shared && summary
    ? `${getMechDisplayName(shared.mech)} ${shared.mech.variant} · ${summary.totalWeight.toFixed(1)} / ${shared.mech.tonnageMax} t · ${summary.firepower} volley`
    : 'This build can no longer be opened';
  return { build, shared, summary, listRow, weaponCounts, tags: shared ? getBuildTags(shared.mech, items) : [], meta };
};
