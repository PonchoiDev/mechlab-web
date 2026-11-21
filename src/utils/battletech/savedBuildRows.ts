import type { BtBuild } from '../../types/battletech-mechlab';
import type { SavedBuild } from '../savedBuildsCore';
import { countWeaponTypes, type BuildListConfig, type BuildListRow, type BuildTag } from '../savedBuildsList';
import { decodeBtBuild } from './buildCode';
import { getBtBuildTags } from './buildTags';
import { HARDPOINT_LABELS, HARDPOINT_SHORT, HARDPOINTS } from './catalog';
import { getAllItems, getHardpointCount } from './fitting';
import { getItem, getMechDisplayName, MECH_TAGS } from './mechlabData';
import { getBuildSummary, type BtSummary } from './stats';

// Una build guardada de BATTLETECH resumida para las listas de builds, como la de MW5 (utils/savedBuildRows.ts).

export const BT_BUILD_LIST: BuildListConfig = {
  // Los mismos contadores que el selector de 'Mechs de BATTLETECH.
  hardpointTypes: HARDPOINTS.map(id => ({ id, short: HARDPOINT_SHORT[id], label: HARDPOINT_LABELS[id].toLowerCase() })),
  // BATTLETECH no tiene ECM, AMS ni variantes hero en el selector de 'Mechs: solo los jump jets montados.
  featureOptions: [{ id: 'jumpJets', label: 'Jump jets', title: 'Builds that carry jump jets' }],
  hasTechBase: false,
  weaponShort: HARDPOINT_SHORT,
  weaponLabels: Object.fromEntries(HARDPOINTS.map(id => [id, HARDPOINT_LABELS[id].toLowerCase()])),
  // En el orden de las etiquetas del selector de 'Mechs.
  orderRoles: roles => MECH_TAGS.filter(tag => roles.includes(tag))
};

export interface BtSavedBuildEntry {
  build: SavedBuild;
  // null si la build ya no se puede abrir.
  decoded: BtBuild | null;
  summary: BtSummary | null;
  listRow: BuildListRow;
  weaponCounts: { type: string; count: number }[];
  tags: BuildTag[];
  meta: string;
}

export const summarizeBtSavedBuild = (build: SavedBuild): BtSavedBuildEntry => {
  const decoded = decodeBtBuild(build.code);
  const summary = decoded ? getBuildSummary(decoded) : null;
  // Solo las armas: la munición también tiene tipo de anclaje en BATTLETECH.
  const weaponCounts = decoded
    ? countWeaponTypes(Object.values(decoded.loadout).flat().map(getItem).filter(item => item?.kind === 'weapon').map(item => item?.hardpoint), HARDPOINTS)
    : [];
  const allItems = decoded ? getAllItems(decoded.mech, decoded.loadout) : [];
  // La potencia de fuego de BATTLETECH es el daño de un ataque con todas las armas.
  const listRow: BuildListRow = {
    id: build.id,
    name: build.name,
    savedAt: build.savedAt,
    chassis: decoded?.mech.name ?? null,
    variant: decoded?.mech.variant ?? null,
    weightClass: decoded?.mech.weightClass ?? null,
    tonnage: summary?.tonnage ?? null,
    firepower: summary?.alphaDamage ?? null,
    hardpoints: decoded ? Object.fromEntries(HARDPOINTS.map(type => [type, getHardpointCount(decoded.mech, type)])) : null,
    weapons: decoded ? Object.fromEntries(weaponCounts.map(({ type, count }) => [type, count])) : null,
    techBase: null,
    roles: decoded?.mech.tags ?? [],
    features: allItems.some(item => item.kind === 'jumpJet') ? ['jumpJets'] : []
  };
  const meta = decoded && summary
    ? `${getMechDisplayName(decoded.mech)} · ${summary.tonnage} / ${decoded.mech.tonnage} t · ${summary.alphaDamage} alpha`
    : 'This build can no longer be opened';
  return { build, decoded, summary, listRow, weaponCounts, tags: getBtBuildTags(allItems), meta };
};
