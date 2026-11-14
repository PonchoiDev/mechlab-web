import type { Zone } from '../../types/mech';
import type { BtLoadout, BtMech } from '../../types/battletech-mechlab';
import type { MenuEntry } from '../../components/ContextMenu';
import type { MenuDefinition } from '../../components/menus';
import { ZONE_KEYS, ZONE_LABELS } from '../../utils/zones';
import {
  addAmmoFor,
  canMountIn,
  countFreeFor,
  duplicateItemTo,
  fillWeapon,
  getAmmoBoxesFor,
  getAmmoOnlyUsedBy,
  LEGS,
  MIRROR_ZONES,
  moveAllTo,
  moveItemTo,
  removeAllOf,
  removeWeaponAndAmmo,
  type ActionResult
} from '../../utils/battletech/actions';
import { getHardpointViews, getLocationUsage, removeItem } from '../../utils/battletech/fitting';
import { getItem, HARDPOINT_LABELS } from '../../utils/battletech/mechlabData';

// Menús del clic derecho (o de la pulsación larga) del MechLab de BATTLETECH, con las entradas del de
// MW5 (components/menus.ts) que tienen sentido en este juego: no hay niveles de arma.
export interface BtMenuContext {
  mech: BtMech;
  loadout: BtLoadout;
  run: (action: (loadout: BtLoadout) => ActionResult) => void;
  openEditor: (zone: Zone, hardpointIndex: number | null) => void;
}

const freeSlots = (context: BtMenuContext, zone: Zone) => {
  const { slots } = getLocationUsage(context.mech, context.loadout, zone);
  return Math.max(0, slots.capacity - slots.used);
};

export const getBtHardpointMenu = (context: BtMenuContext, zone: Zone, hardpointIndex: number): MenuDefinition | null => {
  const { mech, loadout } = context;
  const view = getHardpointViews(mech, loadout, zone)[hardpointIndex];
  if (!view) return null;
  const hardpointName = `${HARDPOINT_LABELS[view.type]} hardpoint`;
  if (!view.item || view.index === null) {
    return {
      title: `${hardpointName} · ${ZONE_LABELS[zone]}`,
      entries: [{ kind: 'action', label: 'Choose weapon…', onSelect: () => context.openEditor(zone, hardpointIndex) }]
    };
  }

  const weapon = view.item;
  const index = view.index;
  const freeIn = (zones: Zone[]) => countFreeFor(mech, loadout, weapon, zones);
  const copyTo = (target: Zone) => () => context.run(current => duplicateItemTo(mech, current, zone, index, target));
  const mirror = MIRROR_ZONES[zone];
  const destinations = ZONE_KEYS.filter(target => freeIn([target]) > 0);
  const duplicate: MenuEntry[] = [
    { kind: 'section', label: 'One copy' },
    { kind: 'action', label: 'Here', hint: ZONE_LABELS[zone], disabled: freeIn([zone]) === 0, onSelect: copyTo(zone) },
    ...(mirror ? [{ kind: 'action' as const, label: 'Mirror', hint: ZONE_LABELS[mirror], disabled: freeIn([mirror]) === 0, onSelect: copyTo(mirror) }] : []),
    {
      kind: 'submenu',
      label: 'To…',
      disabled: destinations.length === 0,
      entries: destinations.map(target => ({ kind: 'action' as const, label: ZONE_LABELS[target], hint: `${freeIn([target])} free`, onSelect: copyTo(target) }))
    },
    { kind: 'section', label: 'Fill free hardpoints' },
    { kind: 'action', label: 'Fill this location', hint: `(${freeIn([zone])})`, disabled: freeIn([zone]) === 0, onSelect: () => context.run(current => fillWeapon(mech, current, weapon, [zone])) },
    { kind: 'action', label: 'Fill all free hardpoints', hint: `(${freeIn(ZONE_KEYS)})`, disabled: freeIn(ZONE_KEYS) === 0, onSelect: () => context.run(current => fillWeapon(mech, current, weapon, ZONE_KEYS)) }
  ];

  const boxes = getAmmoBoxesFor(weapon);
  const ammoRow = (label: string, zones: Zone[]): MenuEntry => {
    const free = zones.reduce((total, target) => total + freeSlots(context, target), 0);
    return {
      kind: 'options',
      label,
      hint: `${free} free slots`,
      options: boxes.map(box => ({
        label: box.tonnage === 0.5 ? '½ t' : `${box.tonnage} t`,
        disabled: !zones.some(target => canMountIn(mech, loadout, box, target)),
        onSelect: () => context.run(current => addAmmoFor(mech, current, weapon, box, zones))
      }))
    };
  };
  const others = ZONE_KEYS.filter(target => !LEGS.includes(target) && target !== zone && freeSlots(context, target) > 0);
  const ammo: MenuEntry | null = boxes.length === 0 ? null : {
    kind: 'submenu',
    label: 'Add ammo',
    hint: boxes[0].name,
    entries: [
      ammoRow('Legs', LEGS),
      ...(!LEGS.includes(zone) ? [ammoRow(`Here · ${ZONE_LABELS[zone]}`, [zone])] : []),
      ...(others.length > 0 ? [{ kind: 'section' as const, label: 'Other locations' }] : []),
      ...others.map(target => ammoRow(ZONE_LABELS[target], [target]))
    ]
  };
  const ownAmmo = getAmmoOnlyUsedBy(mech, loadout, zone, index);

  return {
    title: weapon.name,
    entries: [
      { kind: 'submenu', label: 'Duplicate weapon', entries: duplicate },
      ...(ammo ? [ammo] : []),
      { kind: 'section', label: 'Hardpoint' },
      { kind: 'action', label: 'Change weapon…', hint: hardpointName, onSelect: () => context.openEditor(zone, hardpointIndex) },
      { kind: 'action', label: 'Remove weapon', danger: true, onSelect: () => context.run(current => ({ loadout: removeItem(current, zone, index), message: `Removed ${weapon.name}` })) },
      ...(ownAmmo.length > 0 ? [{
        kind: 'action' as const,
        label: 'Remove weapon and its ammo',
        hint: `${ownAmmo.reduce((total, entry) => total + entry.item.tonnage, 0)} t`,
        danger: true,
        onSelect: () => context.run(current => removeWeaponAndAmmo(mech, current, zone, index))
      }] : [])
    ]
  };
};

export const getBtEquipmentMenu = (context: BtMenuContext, zone: Zone, itemId: string): MenuDefinition | null => {
  const { mech, loadout } = context;
  const item = getItem(itemId);
  const index = loadout[zone].lastIndexOf(itemId);
  if (!item || index === -1) return null;
  const count = loadout[zone].filter(id => id === itemId).length;
  const withoutOne = removeItem(loadout, zone, index);
  const duplicateTargets = ZONE_KEYS.filter(target => canMountIn(mech, loadout, item, target));
  const moveTargets = ZONE_KEYS.filter(target => target !== zone && canMountIn(mech, withoutOne, item, target));
  const zoneEntry = (target: Zone, action: (current: BtLoadout) => ActionResult, hint?: string): MenuEntry =>
    ({ kind: 'action', label: ZONE_LABELS[target], hint, onSelect: () => context.run(action) });
  const freeHint = (target: Zone) => `${freeSlots(context, target)} free slots`;

  const entries: MenuEntry[] = [];
  if (!LEGS.includes(zone) && LEGS.some(leg => canMountIn(mech, withoutOne, item, leg))) {
    entries.push({
      kind: 'action',
      label: count > 1 ? `Move all ${count} to legs` : 'Move to legs',
      onSelect: () => context.run(current => moveAllTo(mech, current, zone, itemId, LEGS))
    });
  }
  entries.push(
    {
      kind: 'submenu',
      label: 'Duplicate',
      disabled: duplicateTargets.length === 0,
      entries: duplicateTargets.map(target => zoneEntry(target, current => duplicateItemTo(mech, current, zone, index, target), target === zone ? 'here' : freeHint(target)))
    },
    {
      kind: 'submenu',
      label: count > 1 ? 'Move one to…' : 'Move to…',
      disabled: moveTargets.length === 0,
      entries: moveTargets.map(target => zoneEntry(target, current => moveItemTo(mech, current, zone, index, target), freeHint(target)))
    }
  );
  if (count > 1) {
    entries.push({
      kind: 'submenu',
      label: `Move all ${count} to…`,
      disabled: moveTargets.length === 0,
      entries: moveTargets.map(target => zoneEntry(target, current => moveAllTo(mech, current, zone, itemId, [target]), freeHint(target)))
    });
  }
  entries.push(
    { kind: 'section', label: 'Remove' },
    { kind: 'action', label: count > 1 ? 'Remove one' : 'Remove', danger: true, onSelect: () => context.run(current => ({ loadout: removeItem(current, zone, current[zone].lastIndexOf(itemId)), message: `Removed ${item.name}` })) }
  );
  if (count > 1) {
    entries.push({ kind: 'action', label: `Remove all ${count}`, danger: true, onSelect: () => context.run(current => removeAllOf(current, zone, itemId)) });
  }
  return { title: `${item.name}${count > 1 ? ` ×${count}` : ''} · ${ZONE_LABELS[zone]}`, entries };
};
