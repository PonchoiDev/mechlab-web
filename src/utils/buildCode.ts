import type { Item } from '../types/item';
import type { ArmorState, EquippedLoadout, Mech } from '../types/mech';
import { clampArmorValue } from './calculators';
import {
  createEquippedItem,
  findHardpointForWeapon,
  getAvailableSlotType,
  getHardpointOccupancy,
  weaponFitsHardpoint
} from './equipment';
import { createEmptyArmor, createEmptyLoadout, ZONE_KEYS } from './zones';

// Versión del formato del enlace, para poder cambiarlo sin romper los enlaces ya compartidos.
const BUILD_CODE_VERSION = 1;
export const BUILD_PARAM = 'b';

// Las armas guardan su anclaje y, si no es el de catálogo, su tier. El resto solo su id.
type CodedItem = string | [id: string, hardpointIndex: number, tier?: string];
type CodedBuild = [version: number, mechId: string, armor: number[], zones: CodedItem[][]];

export interface SharedBuild {
  mech: Mech;
  loadout: EquippedLoadout;
  armor: ArmorState;
}

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (code: string) => {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
};

export const encodeBuild = (mech: Mech, loadout: EquippedLoadout, armor: ArmorState, catalog: Item[]): string => {
  const catalogTiers = new Map(catalog.map(item => [item.id, item.tier]));
  const zones = ZONE_KEYS.map(zone => loadout[zone].map((item): CodedItem => {
    if (item.type !== 'weapon' || item.hardpointIndex === undefined) return item.id;
    return item.tier && item.tier !== catalogTiers.get(item.id)
      ? [item.id, item.hardpointIndex, item.tier]
      : [item.id, item.hardpointIndex];
  }));
  const build: CodedBuild = [
    BUILD_CODE_VERSION,
    mech.id,
    ZONE_KEYS.flatMap(zone => [armor[zone].front, armor[zone].rear]),
    zones
  ];
  return toBase64Url(JSON.stringify(build));
};

// Reconstruye la build comprobando cada pieza con las reglas del taller: lo que ya no existe o
// no cabe (por ejemplo, tras actualizar los datos del juego) se descarta en lugar de fallar.
export const decodeBuild = (code: string, mechs: Mech[], catalog: Item[]): SharedBuild | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed[0] !== BUILD_CODE_VERSION) return null;

  const [, mechId, codedArmor, codedZones] = parsed as CodedBuild;
  const mech = mechs.find(candidate => candidate.id === mechId);
  if (!mech || !Array.isArray(codedArmor) || !Array.isArray(codedZones)) return null;

  const itemsById = new Map(catalog.map(item => [item.id, item]));
  const loadout = createEmptyLoadout();
  const armor = createEmptyArmor();

  ZONE_KEYS.forEach((zone, zoneIndex) => {
    const component = mech.components[zone];
    const toNumber = (value: unknown) => Number.isFinite(value) ? Math.round(value as number) : 0;
    const front = clampArmorValue(toNumber(codedArmor[zoneIndex * 2]), 0, component.maxArmor);
    const rear = component.hasRearArmor ? clampArmorValue(toNumber(codedArmor[zoneIndex * 2 + 1]), front, component.maxArmor) : 0;
    armor[zone] = { front, rear };

    const codedItems = Array.isArray(codedZones[zoneIndex]) ? codedZones[zoneIndex] : [];
    for (const coded of codedItems) {
      const [id, hardpointIndex, tier] = Array.isArray(coded) ? coded : [coded];
      const item = typeof id === 'string' ? itemsById.get(id) : undefined;
      if (!item) continue;
      const zoneItems = loadout[zone];

      if (item.type === 'weapon') {
        const index = typeof hardpointIndex === 'number'
          ? hardpointIndex
          : findHardpointForWeapon(component.hardpoints, zoneItems, item);
        const hardpoint = index === null ? undefined : component.hardpoints[index];
        if (index === null || !hardpoint || !weaponFitsHardpoint(hardpoint, item)) continue;
        if (getHardpointOccupancy(component.hardpoints, zoneItems).occupiedIndices.has(index)) continue;
        const tiered = typeof tier === 'string' && item.tiers?.[tier] ? { ...item, tier } : item;
        zoneItems.push(createEquippedItem(tiered, undefined, index));
        continue;
      }

      const slotType = getAvailableSlotType(item, component, zoneItems);
      if (slotType) zoneItems.push(createEquippedItem(item, slotType));
    }
  });

  return { mech, loadout, armor };
};

// Build de fábrica del mech (su loadout del juego), con las mismas reglas que un enlace compartido.
export const getStockBuild = (mech: Mech, mechs: Mech[], catalog: Item[]): SharedBuild | null =>
  mech.stockBuild ? decodeBuild(mech.stockBuild, mechs, catalog) : null;

export const getBuildUrl = (code: string): string => {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set(BUILD_PARAM, code);
  return url.toString();
};

// Lee la build del enlace con el que se abrió la página y limpia la dirección, para que los
// cambios posteriores no queden desalineados con el código de la URL. Devuelve null si la página
// no se abrió con un enlace de build, y build null si el enlace no es válido.
export const readBuildFromLocation = (mechs: Mech[], catalog: Item[]): { build: SharedBuild | null } | null => {
  const url = new URL(window.location.href);
  const code = url.searchParams.get(BUILD_PARAM);
  if (code === null) return null;

  url.searchParams.delete(BUILD_PARAM);
  window.history.replaceState(window.history.state, '', url);
  return { build: decodeBuild(code, mechs, catalog) };
};
