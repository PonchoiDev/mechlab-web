import mechsData from '../../data/battletech/mechs.json';
import itemsData from '../../data/battletech/items.json';
import constantsData from '../../data/battletech/constants.json';
import type {
  BtConstants,
  BtHardpoint,
  BtItem,
  BtItemKind,
  BtMech,
  BtWeightClass
} from '../../types/battletech-mechlab';

export const BT_MECHS = mechsData as unknown as BtMech[];
export const BT_ITEMS = itemsData as unknown as BtItem[];
export const BT_CONSTANTS = constantsData as unknown as BtConstants;

const itemsById = new Map(BT_ITEMS.map(item => [item.id, item]));
const mechsById = new Map(BT_MECHS.map(mech => [mech.id.toLowerCase(), mech]));
const mechsByVariant = new Map(BT_MECHS.map(mech => [mech.variant.toLowerCase(), mech]));

// Las etiquetas de fuente y anclaje están en catalog.ts, que no carga los 'Mechs (la página de equipo
// las usa sin el resto del MechLab).
export { HARDPOINT_LABELS, HARDPOINT_SHORT, HARDPOINTS, SOURCE_LABELS, SOURCES } from './catalog';

export const getItem = (id: string): BtItem | undefined => itemsById.get(id);

// Los enlaces usan el id del mechdef sin «mechdef_» (hunchback_HBK-4G), pero también se acepta el
// nombre de la variante (HBK-4G), que es el que se escribe a mano.
export const findMech = (idOrVariant: string): BtMech | undefined => {
  const key = idOrVariant.trim().toLowerCase().replace(/^mechdef_/, '');
  return mechsById.get(key) ?? mechsByVariant.get(key);
};

export const WEIGHT_CLASS_LABELS: Record<BtWeightClass, string> = {
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
  assault: 'Assault'
};

export const WEIGHT_CLASSES = Object.keys(WEIGHT_CLASS_LABELS) as BtWeightClass[];

export const KIND_LABELS: Record<BtItemKind, string> = {
  weapon: 'Weapon',
  ammo: 'Ammo',
  heatSink: 'Heat sink',
  jumpJet: 'Jump jet',
  upgrade: 'Upgrade'
};

// Etiquetas de rol de las variantes (los nombres que les da generar_mechlab_battletech.py), en el
// orden del filtro: papel, tipo de lanza y estilo.
const TAG_ORDER = [
  'Brawler', 'Sniper', 'Scout', 'Flanker', 'Electronic warfare', 'Tank', 'Assassin', 'Support', 'Vanguard',
  'Short range', 'Medium range', 'Long range', 'Fast', 'Slow', 'Heavy armor', 'Light armor', 'Runs hot', 'Indirect fire'
];
const usedTags = new Set(BT_MECHS.flatMap(mech => mech.tags));
export const MECH_TAGS = [...TAG_ORDER.filter(tag => usedTags.has(tag)), ...[...usedTags].filter(tag => !TAG_ORDER.includes(tag))];

// La munición toma el color del anclaje de las armas que la usan, como en el MechLab de MW5.
const ammoHardpoints = new Map<string, BtHardpoint>();
for (const item of BT_ITEMS) {
  const category = item.weapon?.ammoCategory;
  if (category && item.hardpoint && !ammoHardpoints.has(category)) ammoHardpoints.set(category, item.hardpoint);
}

// El tipo de anclaje con el que se pinta un objeto: el suyo en las armas, el de sus armas en la munición.
export const getItemWeaponType = (item: BtItem): BtHardpoint | undefined =>
  item.hardpoint ?? (item.ammo?.category ? ammoHardpoints.get(item.ammo.category) : undefined);

// Categoría del equipo con las clases del MechLab de MW5 (component-card-item[data-category]).
export const getEquipmentCategory = (item: BtItem): 'ammo' | 'heat-sink' | 'jump-jet' | 'module' =>
  item.kind === 'ammo' ? 'ammo' : item.kind === 'heatSink' ? 'heat-sink' : item.kind === 'jumpJet' ? 'jump-jet' : 'module';

export const getMechDisplayName =(mech: BtMech) => `${mech.name} ${mech.variant}`;
