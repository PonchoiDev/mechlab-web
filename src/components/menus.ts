import type { Item } from '../types/item';
import type { EquippedItem, EquippedLoadout, Mech, Zone } from '../types/mech';
import {
  addAmmoForWeapon,
  AMMO_TONNAGE_OPTIONS,
  canPlaceEquipment,
  changeAllWeaponsTier,
  changeWeaponTier,
  countFreeHardpointsFor,
  describeReplaced,
  duplicateEquipment,
  duplicateWeaponTo,
  fillWeaponInZones,
  getAdjacentTier,
  getAmmoBins,
  getAmmoOnlyUsedBy,
  getReplaceAllPreview,
  getSameWeapons,
  LEGS,
  MIRROR_ZONES,
  moveAllEquipment,
  moveEquipment,
  removeAllEquipment,
  removeEquipment,
  removeWeapon,
  removeWeaponAndAmmo,
  replaceAllCompatible,
  type ActionResult
} from '../utils/buildActions';
import { getComponentStatus, getHardpointViews } from '../utils/equipment';
import { getSizeName, getTierName, getWeaponTypeName } from '../utils/items';
import { ZONE_KEYS, ZONE_LABELS } from '../utils/zones';
import type { MenuEntry } from './ContextMenu';

export interface MenuContext {
  mech: Mech;
  loadout: EquippedLoadout;
  catalog: Item[];
  run: (action: (loadout: EquippedLoadout) => ActionResult) => void;
  openEditor: (zone: Zone, hardpointIndex: number | null) => void;
}

export interface MenuDefinition {
  title: string;
  entries: MenuEntry[];
}

const tonsLabel = (tons: number) => tons === 0.5 ? '½ t' : `${tons} t`;

const freeGeneralSlots = (mech: Mech, loadout: EquippedLoadout, zone: Zone) => {
  const status = getComponentStatus(mech.components[zone], loadout[zone]);
  return Math.max(0, status.maxSlots - status.usedSlots);
};

const tierEntries = (context: MenuContext, zone: Zone, weapon: EquippedItem): MenuEntry[] => {
  const up = getAdjacentTier(weapon, 1);
  const down = getAdjacentTier(weapon, -1);
  if (!up && !down) return [];

  const same = getSameWeapons(context.loadout, weapon).length;
  const name = (tier: string | null) => tier ? getTierName({ ...weapon, tier }) ?? undefined : undefined;
  const entries: MenuEntry[] = [
    { kind: 'action', label: 'Upgrade tier', hint: name(up), disabled: !up, onSelect: () => context.run(loadout => changeWeaponTier(loadout, zone, weapon.instanceId, 1)) },
    { kind: 'action', label: 'Downgrade tier', hint: name(down), disabled: !down, onSelect: () => context.run(loadout => changeWeaponTier(loadout, zone, weapon.instanceId, -1)) }
  ];

  if (same > 1) {
    entries.push(
      { kind: 'action', label: `Upgrade all ${same}× ${weapon.name}`, hint: name(up), disabled: !up, onSelect: () => context.run(loadout => changeAllWeaponsTier(loadout, zone, weapon.instanceId, 1)) },
      { kind: 'action', label: `Downgrade all ${same}× ${weapon.name}`, hint: name(down), disabled: !down, onSelect: () => context.run(loadout => changeAllWeaponsTier(loadout, zone, weapon.instanceId, -1)) }
    );
  }

  return entries;
};

const duplicateEntries = (context: MenuContext, zone: Zone, weapon: EquippedItem): MenuEntry[] => {
  const { mech, loadout } = context;
  const freeIn = (zones: Zone[]) => countFreeHardpointsFor(mech, loadout, zones, weapon);
  const mirror = MIRROR_ZONES[zone];
  const destinations = ZONE_KEYS.filter(target => freeIn([target]) > 0);
  const preview = getReplaceAllPreview(mech, loadout, weapon);
  const fill = (zones: Zone[]) => () => context.run(current => fillWeaponInZones(mech, current, zone, weapon.instanceId, zones));
  const copyTo = (target: Zone) => () => context.run(current => duplicateWeaponTo(mech, current, zone, weapon.instanceId, target));

  const entries: MenuEntry[] = [
    { kind: 'section', label: 'One copy' },
    { kind: 'action', label: 'Here', hint: ZONE_LABELS[zone], disabled: freeIn([zone]) === 0, onSelect: copyTo(zone) }
  ];
  if (mirror) {
    entries.push({ kind: 'action', label: 'Mirror', hint: ZONE_LABELS[mirror], disabled: freeIn([mirror]) === 0, onSelect: copyTo(mirror) });
  }
  entries.push(
    {
      kind: 'submenu',
      label: 'To…',
      disabled: destinations.length === 0,
      entries: destinations.map(target => ({
        kind: 'action' as const,
        label: ZONE_LABELS[target],
        hint: `${freeIn([target])} free`,
        onSelect: copyTo(target)
      }))
    },
    { kind: 'section', label: 'Fill free hardpoints' },
    { kind: 'action', label: 'Fill this component', hint: `(${freeIn([zone])})`, disabled: freeIn([zone]) === 0, onSelect: fill([zone]) },
    { kind: 'action', label: 'Fill all free hardpoints', hint: `(${freeIn(ZONE_KEYS)})`, disabled: freeIn(ZONE_KEYS) === 0, onSelect: fill(ZONE_KEYS) },
    { kind: 'section', label: 'Replace' },
    {
      kind: 'action',
      label: 'Replace all compatible…',
      hint: `(${preview.added})`,
      danger: true,
      disabled: preview.added === 0,
      confirm: `Place ${preview.added}× ${weapon.name} in every compatible hardpoint` +
        (preview.replaced.length > 0 ? `, replacing ${describeReplaced(preview.replaced)}.` : '.'),
      onSelect: () => context.run(current => replaceAllCompatible(mech, current, zone, weapon.instanceId))
    }
  );

  return entries;
};

const ammoEntries = (context: MenuContext, zone: Zone, weapon: EquippedItem): MenuEntry | null => {
  if (!weapon.ammoType) return null;
  const { mech, loadout, catalog } = context;
  const { full, half } = getAmmoBins(catalog, weapon);
  if (!full && !half) return null;

  const tonnages = AMMO_TONNAGE_OPTIONS.filter(tons => tons !== 0.5 || half);
  const row = (label: string, zones: Zone[]): MenuEntry => {
    const free = zones.reduce((total, target) => total + freeGeneralSlots(mech, loadout, target), 0);
    return {
      kind: 'options',
      label,
      hint: `${free} free slots`,
      options: tonnages.map(tons => ({
        label: tonsLabel(tons),
        disabled: free === 0,
        onSelect: () => context.run(current => addAmmoForWeapon(mech, current, catalog, weapon, tons, zones))
      }))
    };
  };

  const others = ZONE_KEYS.filter(target => !LEGS.includes(target) && target !== zone && freeGeneralSlots(mech, loadout, target) > 0);
  return {
    kind: 'submenu',
    label: 'Add ammo',
    hint: (full ?? half)!.name.replace(/\s*Half(?=\s+Ammo$)/i, ''),
    entries: [
      row('Legs', LEGS),
      ...(!LEGS.includes(zone) ? [row(`Here · ${ZONE_LABELS[zone]}`, [zone])] : []),
      ...(others.length > 0 ? [{ kind: 'section' as const, label: 'Other components' }] : []),
      ...others.map(target => row(ZONE_LABELS[target], [target]))
    ]
  };
};

export const getHardpointMenu = (context: MenuContext, zone: Zone, hardpointIndex: number): MenuDefinition => {
  const view = getHardpointViews(context.mech.components[zone].hardpoints, context.loadout[zone])[hardpointIndex];
  const hardpointName = `${getWeaponTypeName(view.hardpoint.type)} · ${getSizeName(view.hardpoint.size)}`;
  const weapon = view.weapon as EquippedItem | undefined;

  if (!weapon) {
    return {
      title: `${hardpointName} · ${ZONE_LABELS[zone]}`,
      entries: [
        { kind: 'action', label: 'Choose weapon…', hint: view.builtInWeapon ? `uses ${view.builtInWeapon} when empty` : undefined, onSelect: () => context.openEditor(zone, hardpointIndex) }
      ]
    };
  }

  const tierName = getTierName(weapon);
  const ammoOnlyUsedByIt = getAmmoOnlyUsedBy(context.loadout, zone, weapon.instanceId);
  const ammoTons = ammoOnlyUsedByIt.reduce((total, item) => total + item.tonnage, 0);
  const tiers = tierEntries(context, zone, weapon);
  const ammo = ammoEntries(context, zone, weapon);

  return {
    title: `${weapon.name}${tierName ? ` · ${tierName}` : ''}`,
    entries: [
      ...tiers,
      ...(tiers.length > 0 ? [{ kind: 'section' as const, label: 'Copies and ammo' }] : []),
      { kind: 'submenu', label: 'Duplicate weapon', entries: duplicateEntries(context, zone, weapon) },
      ...(ammo ? [ammo] : []),
      { kind: 'section', label: 'Hardpoint' },
      { kind: 'action', label: 'Change weapon…', hint: hardpointName, onSelect: () => context.openEditor(zone, hardpointIndex) },
      { kind: 'action', label: 'Remove weapon', danger: true, onSelect: () => context.run(loadout => removeWeapon(loadout, zone, weapon.instanceId)) },
      ...(ammoOnlyUsedByIt.length > 0 ? [{
        kind: 'action' as const,
        label: 'Remove weapon and its ammo',
        hint: `${ammoTons} t`,
        danger: true,
        onSelect: () => context.run(loadout => removeWeaponAndAmmo(loadout, zone, weapon.instanceId))
      }] : [])
    ]
  };
};

export const getEquipmentMenu = (context: MenuContext, zone: Zone, itemName: string): MenuDefinition | null => {
  const { mech, loadout } = context;
  const instances = loadout[zone].filter(item => item.name === itemName);
  const item = instances.at(-1);
  if (!item) return null;

  const placeable = (target: Zone, current = loadout) => canPlaceEquipment(mech, current, item, target);
  const withoutOne = { ...loadout, [zone]: loadout[zone].filter(candidate => candidate.instanceId !== item.instanceId) };
  const duplicateTargets = ZONE_KEYS.filter(target => placeable(target));
  const moveTargets = ZONE_KEYS.filter(target => target !== zone && placeable(target, withoutOne));
  const zoneAction = (target: Zone, action: (target: Zone) => (current: EquippedLoadout) => ActionResult, hint?: string): MenuEntry => ({
    kind: 'action',
    label: ZONE_LABELS[target],
    hint,
    onSelect: () => context.run(action(target))
  });
  const freeHint = (target: Zone) => `${freeGeneralSlots(mech, loadout, target)} free slots`;

  const entries: MenuEntry[] = [];
  if (!LEGS.includes(zone) && LEGS.some(leg => placeable(leg))) {
    entries.push({
      kind: 'action',
      label: instances.length > 1 ? `Move all ${instances.length} to legs` : 'Move to legs',
      onSelect: () => context.run(current => moveAllEquipment(mech, current, zone, itemName, LEGS))
    });
  }
  entries.push(
    {
      kind: 'submenu',
      label: 'Duplicate',
      disabled: duplicateTargets.length === 0,
      entries: duplicateTargets.map(target => zoneAction(target,
        destination => current => duplicateEquipment(mech, current, zone, item.instanceId, destination),
        target === zone ? 'here' : freeHint(target)))
    },
    {
      kind: 'submenu',
      label: instances.length > 1 ? 'Move one to…' : 'Move to…',
      disabled: moveTargets.length === 0,
      entries: moveTargets.map(target => zoneAction(target,
        destination => current => moveEquipment(mech, current, zone, item.instanceId, destination),
        freeHint(target)))
    }
  );
  if (instances.length > 1) {
    entries.push({
      kind: 'submenu',
      label: `Move all ${instances.length} to…`,
      disabled: moveTargets.length === 0,
      entries: moveTargets.map(target => zoneAction(target,
        destination => current => moveAllEquipment(mech, current, zone, itemName, [destination]),
        freeHint(target)))
    });
  }
  entries.push(
    { kind: 'section', label: 'Remove' },
    { kind: 'action', label: instances.length > 1 ? 'Remove one' : 'Remove', danger: true, onSelect: () => context.run(current => removeEquipment(current, zone, item.instanceId)) }
  );
  if (instances.length > 1) {
    entries.push({ kind: 'action', label: `Remove all ${instances.length}`, danger: true, onSelect: () => context.run(current => removeAllEquipment(current, zone, itemName)) });
  }

  return { title: `${itemName}${instances.length > 1 ? ` ×${instances.length}` : ''} · ${ZONE_LABELS[zone]}`, entries };
};
