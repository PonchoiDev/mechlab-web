import type { Zone } from '../../types/mech';
import type { BtArmor, BtBuild, BtHardpoint, BtItem, BtItemKind, BtLoadout, BtMech } from '../../types/battletech-mechlab';
import { ZONE_KEYS, ZONE_LABELS, mapZones } from '../zones';
import { getItem, HARDPOINT_LABELS, HARDPOINTS } from './mechlabData';

// Reglas de montaje del mechlab de BATTLETECH: a diferencia de MW5 Mercenaries, aquí todo ocupa
// ranuras (también las armas) y solo las armas necesitan además un anclaje libre de su tipo.

export const createEmptyBtLoadout = (): BtLoadout => mapZones(() => []);

export const createStockArmor = (mech: BtMech): BtArmor =>
  mapZones(zone => ({ front: mech.stock.armor[zone][0], rear: mech.stock.armor[zone][1] }));

// La build de serie: el inventario del mechdef. El equipo fijo del chasis no va en el inventario.
export const createStockBuild = (mech: BtMech): BtBuild => {
  const loadout = createEmptyBtLoadout();
  for (const [zone, id] of mech.stock.items) loadout[zone].push(id);
  return { mech, loadout, armor: createStockArmor(mech) };
};

const toItems = (ids: string[]): BtItem[] => ids.flatMap(id => {
  const item = getItem(id);
  return item ? [item] : [];
});

export const getFixedItems = (mech: BtMech, zone: Zone): BtItem[] =>
  toItems(mech.fixed.filter(([fixedZone]) => fixedZone === zone).map(([, id]) => id));

export const getZoneItems = (loadout: BtLoadout, zone: Zone): BtItem[] => toItems(loadout[zone]);

// Todo lo que lleva el 'Mech, el equipo fijo incluido.
export const getAllItems = (mech: BtMech, loadout: BtLoadout): BtItem[] =>
  ZONE_KEYS.flatMap(zone => [...getFixedItems(mech, zone), ...getZoneItems(loadout, zone)]);

export interface Usage {
  used: number;
  capacity: number;
}

export interface LocationUsage {
  slots: Usage;
  hardpoints: Record<BtHardpoint, Usage>;
}

export const getLocationUsage = (mech: BtMech, loadout: BtLoadout, zone: Zone): LocationUsage => {
  const location = mech.locations[zone];
  const items = [...getFixedItems(mech, zone), ...getZoneItems(loadout, zone)];
  const hardpoints = Object.fromEntries(HARDPOINTS.map(type => [type, {
    used: items.filter(item => item.kind === 'weapon' && item.hardpoint === type).length,
    capacity: location.hardpoints.filter(hardpoint => hardpoint === type).length
  }])) as Record<BtHardpoint, Usage>;
  return {
    slots: { used: items.reduce((total, item) => total + item.slots, 0), capacity: location.slots },
    hardpoints
  };
};

export const countJumpJets = (mech: BtMech, loadout: BtLoadout): number =>
  getAllItems(mech, loadout).filter(item => item.kind === 'jumpJet').length;

export const getHardpointCount = (mech: BtMech, type: BtHardpoint): number =>
  ZONE_KEYS.reduce((total, zone) => total + mech.locations[zone].hardpoints.filter(hardpoint => hardpoint === type).length, 0);

export type MountProblem = 'builtIn' | 'location' | 'jumpJetTonnage' | 'hardpoint' | 'slots' | 'jumpJetLimit';

// Por qué no cabe un componente en una ubicación, o null si cabe. El orden es el de lo que antes
// descarta el juego: lo que nunca cabe (equipo de serie, ubicación, tonelaje) antes que lo que
// depende de lo ya montado.
export const getMountProblem = (mech: BtMech, loadout: BtLoadout, zone: Zone, item: BtItem): MountProblem | null => {
  if (item.builtIn) return 'builtIn';
  if (!item.locations.includes(zone)) return 'location';
  if (item.jumpJet && (mech.tonnage < item.jumpJet.minTonnage || mech.tonnage > item.jumpJet.maxTonnage)) return 'jumpJetTonnage';
  const usage = getLocationUsage(mech, loadout, zone);
  if (item.kind === 'weapon' && item.hardpoint) {
    const hardpoint = usage.hardpoints[item.hardpoint];
    if (hardpoint.used >= hardpoint.capacity) return 'hardpoint';
  }
  if (usage.slots.used + item.slots > usage.slots.capacity) return 'slots';
  if (item.kind === 'jumpJet' && countJumpJets(mech, loadout) >= mech.maxJumpJets) return 'jumpJetLimit';
  return null;
};

export const describeMountProblem = (problem: MountProblem, mech: BtMech, zone: Zone, item: BtItem): string => {
  switch (problem) {
    case 'builtIn': return `${item.name} is built into some chassis and cannot be mounted`;
    case 'location': return `${item.name} cannot go in the ${ZONE_LABELS[zone].toLowerCase()}`;
    case 'jumpJetTonnage': return `${item.name} is for ${item.jumpJet!.minTonnage} to ${item.jumpJet!.maxTonnage} t 'Mechs`;
    case 'hardpoint': return mech.locations[zone].hardpoints.includes(item.hardpoint!)
      ? `No free ${HARDPOINT_LABELS[item.hardpoint!]} hardpoint in the ${ZONE_LABELS[zone].toLowerCase()}`
      : `The ${ZONE_LABELS[zone].toLowerCase()} has no ${HARDPOINT_LABELS[item.hardpoint!]} hardpoint`;
    case 'slots': return `Not enough free slots in the ${ZONE_LABELS[zone].toLowerCase()}`;
    case 'jumpJetLimit': return `This chassis takes ${mech.maxJumpJets} jump jets at most`;
  }
};

export type MountResult = { ok: true; loadout: BtLoadout } | { ok: false; problem: MountProblem };

export const mountItem = (mech: BtMech, loadout: BtLoadout, zone: Zone, item: BtItem): MountResult => {
  const problem = getMountProblem(mech, loadout, zone, item);
  if (problem) return { ok: false, problem };
  return { ok: true, loadout: { ...loadout, [zone]: [...loadout[zone], item.id] } };
};

export const removeItem = (loadout: BtLoadout, zone: Zone, index: number): BtLoadout =>
  ({ ...loadout, [zone]: loadout[zone].filter((_, position) => position !== index) });

export const removeItemsOfKind = (loadout: BtLoadout, kinds: BtItemKind[]): BtLoadout =>
  mapZones(zone => loadout[zone].filter(id => !kinds.includes(getItem(id)?.kind ?? 'upgrade')));

// El resumen de la pantalla de reequipar del juego bajo el tonelaje («4/4 B 0/4 E 0/0 M 0/0 S 4/4 JJ»):
// anclajes usados y totales de cada tipo en todo el 'Mech, y retrorreactores montados frente al máximo.
export const getHardpointSummary = (mech: BtMech, loadout: BtLoadout): Record<BtHardpoint | 'jumpJets', Usage> => {
  const summary = Object.fromEntries(HARDPOINTS.map(type => [type, { used: 0, capacity: 0 }])) as Record<BtHardpoint, Usage>;
  for (const zone of ZONE_KEYS) {
    const usage = getLocationUsage(mech, loadout, zone);
    for (const type of HARDPOINTS) {
      summary[type].used += usage.hardpoints[type].used;
      summary[type].capacity += usage.hardpoints[type].capacity;
    }
  }
  return { ...summary, jumpJets: { used: countJumpJets(mech, loadout), capacity: mech.maxJumpJets } };
};

export interface HardpointView {
  type: BtHardpoint;
  // Arma montada en el anclaje y su posición en el loadout de la ubicación, o null si está libre.
  item: BtItem | null;
  index: number | null;
  // Un arma que no tiene anclaje de su tipo (de un enlace antiguo): se enseña para poder quitarla.
  isOver?: boolean;
}

// Los anclajes de una ubicación, cada uno con el arma que lo ocupa. El juego no numera los anclajes:
// las armas de cada tipo ocupan los suyos por orden de montaje.
export const getHardpointViews = (mech: BtMech, loadout: BtLoadout, zone: Zone): HardpointView[] => {
  const weapons = loadout[zone]
    .map((id, index) => ({ item: getItem(id), index }))
    .filter((entry): entry is { item: BtItem; index: number } => entry.item?.kind === 'weapon');
  const used = new Set<number>();
  const views: HardpointView[] = mech.locations[zone].hardpoints.map(type => {
    const weapon = weapons.find(entry => entry.item.hardpoint === type && !used.has(entry.index));
    if (!weapon) return { type, item: null, index: null };
    used.add(weapon.index);
    return { type, item: weapon.item, index: weapon.index };
  });
  for (const weapon of weapons) {
    if (!used.has(weapon.index)) views.push({ type: weapon.item.hardpoint!, item: weapon.item, index: weapon.index, isOver: true });
  }
  return views;
};

export interface EquipmentGroup {
  item: BtItem;
  count: number;
  fixed: boolean;
  // Posiciones en el loadout de la ubicación (vacío en el equipo fijo).
  indices: number[];
}

// El equipo que no es un arma, agrupado por objeto como en las tarjetas de MW5 (Heat Sink ×2): primero
// el fijo del chasis y después el montado, en el orden de montaje.
export const groupZoneEquipment = (mech: BtMech, loadout: BtLoadout, zone: Zone): EquipmentGroup[] => {
  const groups: EquipmentGroup[] = [];
  for (const item of getFixedItems(mech, zone).filter(fixed => fixed.kind !== 'weapon')) {
    const group = groups.find(entry => entry.fixed && entry.item.id === item.id);
    if (group) group.count += 1;
    else groups.push({ item, count: 1, fixed: true, indices: [] });
  }
  loadout[zone].forEach((id, index) => {
    const item = getItem(id);
    if (!item || item.kind === 'weapon') return;
    const group = groups.find(entry => !entry.fixed && entry.item.id === id);
    if (group) {
      group.count += 1;
      group.indices.push(index);
    } else groups.push({ item, count: 1, fixed: false, indices: [index] });
  });
  return groups;
};

// Primera ubicación donde cabe un componente, para montarlo sin elegir dónde (por ejemplo, la
// munición o un disipador). Prefiere la ubicación indicada si cabe ahí.
export const findMountZone = (mech: BtMech, loadout: BtLoadout, item: BtItem, preferred?: Zone | null): Zone | null => {
  if (preferred && !getMountProblem(mech, loadout, preferred, item)) return preferred;
  return ZONE_KEYS.find(zone => !getMountProblem(mech, loadout, zone, item)) ?? null;
};
