import { useState } from 'react';
import type { Item } from '../types/item';
import type { ArmorState, EquippedLoadout, Mech, Zone } from '../types/mech';
import type { ActionResult } from '../utils/buildActions';
import type { SharedBuild } from '../utils/buildCode';
import { calculateEquippedWeight, createDefaultArmor, maximizeArmor } from '../utils/calculators';
import {
  canEquipItem,
  createEquippedItem,
  findHardpointForWeapon,
  getAvailableSlotType,
  getHardpointOccupancy,
  weaponFitsHardpoint
} from '../utils/equipment';
import { createEmptyArmor, createEmptyLoadout } from '../utils/zones';

export const useMechBuild = (mechs: Mech[], initialBuild: SharedBuild | null = null) => {
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, initialBuild ? mechs.indexOf(initialBuild.mech) : 0));
  const mech = mechs[selectedIndex];
  const [loadout, setLoadout] = useState<EquippedLoadout>(() => initialBuild?.loadout ?? createEmptyLoadout());
  const [armor, setArmor] = useState<ArmorState>(() => initialBuild?.armor ?? createDefaultArmor(mech.components));
  const [activeZone, setActiveZone] = useState<Zone | null>(null);

  const selectMech = (index: number) => {
    if (index === selectedIndex) return;

    setSelectedIndex(index);
    setArmor(createDefaultArmor(mechs[index].components));
    setLoadout(createEmptyLoadout());
    setActiveZone(null);
  };

  const equipItem = (item: Item, targetHardpoint?: number) => {
    if (!activeZone) return;

    const zone = activeZone;
    const componentData = mech.components[zone];
    setLoadout(prev => {
      const zoneItems = prev[zone];

      if (item.type === 'weapon') {
        const hardpointIndex = targetHardpoint ?? findHardpointForWeapon(componentData.hardpoints, zoneItems, item);
        if (hardpointIndex === null) return prev;
        const hardpoint = componentData.hardpoints[hardpointIndex];
        const { occupiedIndices } = getHardpointOccupancy(componentData.hardpoints, zoneItems);
        if (!hardpoint || occupiedIndices.has(hardpointIndex) || !weaponFitsHardpoint(hardpoint, item)) return prev;

        return { ...prev, [zone]: [...zoneItems, createEquippedItem(item, undefined, hardpointIndex)] };
      }

      if (!canEquipItem(item, componentData, zoneItems)) return prev;
      const slotType = getAvailableSlotType(item, componentData, zoneItems);
      if (!slotType) return prev;

      return { ...prev, [zone]: [...zoneItems, createEquippedItem(item, slotType)] };
    });
  };

  const removeItem = (zone: Zone, instanceId: string) => {
    setLoadout(prev => ({ ...prev, [zone]: prev[zone].filter(item => item.instanceId !== instanceId) }));
  };

  const removeItemsOfType = (type: 'weapon' | 'ammo') => {
    setLoadout(prev => Object.fromEntries(
      Object.entries(prev).map(([zone, equippedItems]) => [
        zone,
        equippedItems.filter(item => item.type !== type)
      ])
    ) as EquippedLoadout);
  };

  const changeTier = (zone: Zone, instanceId: string, tier: string) => {
    setLoadout(prev => ({
      ...prev,
      [zone]: prev[zone].map(item => item.instanceId === instanceId ? { ...item, tier } : item)
    }));
  };

  const changeArmor = (zone: Zone, type: 'front' | 'rear', value: number) => {
    setArmor(prev => ({ ...prev, [zone]: { ...prev[zone], [type]: value } }));
  };

  const clearArmor = () => {
    setArmor(createEmptyArmor());
  };

  // Aplica una acción del menú contextual sobre la build actual y devuelve su mensaje.
  const runAction = (action: (current: EquippedLoadout) => ActionResult): string => {
    const result = action(loadout);
    if (result.loadout !== loadout) setLoadout(result.loadout);
    return result.message;
  };

  const maximizeMechArmor = () => {
    const availableTonnage = mech.tonnageMax - mech.baseTonnage - calculateEquippedWeight(loadout);
    setArmor(prev => maximizeArmor(mech.components, availableTonnage, prev));
  };

  return {
    mech,
    selectedIndex,
    selectMech,
    loadout,
    armor,
    activeZone,
    setActiveZone,
    equipItem,
    removeItem,
    removeItemsOfType,
    changeTier,
    changeArmor,
    clearArmor,
    maximizeArmor: maximizeMechArmor,
    runAction
  };
};
