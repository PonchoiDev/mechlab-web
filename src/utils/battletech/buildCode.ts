import type { BtBuild } from '../../types/battletech-mechlab';
import { ZONE_KEYS } from '../zones';
import { clampArmor, getArmorLimit, clearArmor } from './armor';
import { createEmptyBtLoadout, createStockBuild, getMountProblem } from './fitting';
import { BT_MECHS, findMech, getItem } from './mechlabData';

// Código de una build de BATTLETECH para los enlaces (?b=) y las builds guardadas. Va aparte del de
// MW5: otros 'Mechs, otros ids y otras reglas. La versión permite cambiar el formato sin romper los
// enlaces ya compartidos.
const BUILD_CODE_VERSION = 1;
export const BUILD_PARAM = 'b';
export const MECH_PARAM = 'mech';

type CodedBuild = [version: number, mechId: string, armor: number[], zones: string[][]];

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (code: string) => {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
};

export const encodeBtBuild = ({ mech, loadout, armor }: BtBuild): string => {
  const build: CodedBuild = [
    BUILD_CODE_VERSION,
    mech.id,
    ZONE_KEYS.flatMap(zone => [armor[zone].front, armor[zone].rear]),
    ZONE_KEYS.map(zone => loadout[zone])
  ];
  return toBase64Url(JSON.stringify(build));
};

// Reconstruye la build con las reglas del mechlab: lo que ya no existe o no cabe (por ejemplo, tras
// regenerar los datos) se descarta en lugar de fallar. El peso no se comprueba: pasarse es un aviso.
export const decodeBtBuild = (code: string): BtBuild | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed[0] !== BUILD_CODE_VERSION) return null;
  const [, mechId, codedArmor, codedZones] = parsed as CodedBuild;
  const mech = typeof mechId === 'string' ? findMech(mechId) : undefined;
  if (!mech || !Array.isArray(codedArmor) || !Array.isArray(codedZones)) return null;

  const loadout = createEmptyBtLoadout();
  const armor = clearArmor();
  ZONE_KEYS.forEach((zone, index) => {
    armor[zone] = {
      front: clampArmor(Number(codedArmor[index * 2]), getArmorLimit(mech, zone, 'front')),
      rear: clampArmor(Number(codedArmor[index * 2 + 1]), getArmorLimit(mech, zone, 'rear'))
    };
    const ids = Array.isArray(codedZones[index]) ? codedZones[index] : [];
    for (const id of ids) {
      const item = typeof id === 'string' ? getItem(id) : undefined;
      if (item && !getMountProblem(mech, loadout, zone, item)) loadout[zone].push(item.id);
    }
  });
  return { mech, loadout, armor };
};

// La build de un enlace: ?b= con el código, o ?mech= con el id o el nombre de una variante para abrir
// su build de serie (así enlazan el mapa estelar y la Argo). null si el enlace no trae ninguna, y
// build null si la que trae no vale.
export const getBtBuildFromParams = (params: URLSearchParams): { build: BtBuild | null } | null => {
  const code = params.get(BUILD_PARAM);
  const mechId = params.get(MECH_PARAM);
  if (code !== null) return { build: decodeBtBuild(code) };
  if (mechId !== null) {
    const mech = findMech(mechId);
    return { build: mech ? createStockBuild(mech) : null };
  }
  return null;
};

export const getBtBuildUrl = (code: string): string => {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set(BUILD_PARAM, code);
  return url.toString();
};

// Lee la build del enlace con el que se abrió la página y limpia la dirección, para que los cambios
// posteriores no queden desalineados con el código de la URL.
export const readBtBuildFromLocation = (): { build: BtBuild | null } | null => {
  const url = new URL(window.location.href);
  const result = getBtBuildFromParams(url.searchParams);
  if (!result) return null;
  url.searchParams.delete(BUILD_PARAM);
  url.searchParams.delete(MECH_PARAM);
  window.history.replaceState(window.history.state, '', url);
  return result;
};

export const DEFAULT_MECH = findMech('HBK-4G') ?? BT_MECHS[0];
