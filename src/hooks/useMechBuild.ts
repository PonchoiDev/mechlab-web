import { useState } from 'react';
import type { Item } from '../types/item';
import type { ArmorState, EquippedLoadout, Mech, Zone } from '../types/mech';
import { calculateEquippedWeight, createDefaultArmor, maximizeArmor } from '../utils/calculators';
import { canEquipItem, createEquippedItem, getAvailableSlotType } from '../utils/equipment';
import { createEmptyArmor, createEmptyLoadout } from '../utils/zones';

export const useMechBuild = (mechs: Mech[]) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const mech = mechs[selectedIndex];
  const [loadout, setLoadout] = useState<EquippedLoadout>(createEmptyLoadout);
  const [armor, setArmor] = useState<ArmorState>(() => createDefaultArmor(mech.components));
  const [activeZone, setActiveZone] = useState<Zone | null>(null);

  const selectMech = (index: number) => {
    if (index === selectedIndex) return;

    setSelectedIndex(index);
    setArmor(createDefaultArmor(mechs[index].components));
    setLoadout(createEmptyLoadout());
    setActiveZone(null);
  };

  const equipItem = (item: Item) => {
    if (!activeZone) return;

    const zone = activeZone;
    const componentData = mech.components[zone];
    setLoadout(prev => {
      const zoneItems = prev[zone];
      if (!canEquipItem(item, componentData, zoneItems)) return prev;

      const slotType = item.type === 'weapon'
        ? undefined
        : getAvailableSlotType(item, componentData, zoneItems) ?? undefined;
      if (item.type !== 'weapon' && !slotType) return prev;

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
    maximizeArmor: maximizeMechArmor
  };
};
