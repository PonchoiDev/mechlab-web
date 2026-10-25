import { useState } from 'react';
import type { Item } from '../types/item';
import type { ArmorState, EquippedLoadout, Mech, Zone } from '../types/mech';
import type { Upgrade } from '../types/upgrade';
import type { ActionResult } from '../utils/buildActions';
import { getStockBuild, type SharedBuild } from '../utils/buildCode';
import { calculateEquippedWeight, createDefaultArmor, getArmorPointsPerTon, maximizeArmor } from '../utils/calculators';
import {
  canEquipItem,
  createEquippedItem,
  findHardpointForWeapon,
  getAvailableSlotType,
  getHardpointOccupancy,
  weaponFitsHardpoint
} from '../utils/equipment';
import { canInstallUpgrade, getUpgrades } from '../utils/upgrades';
import { createEmptyArmor, createEmptyLoadout } from '../utils/zones';

// Al elegir un chasis se carga su build de fábrica; si no la tiene, queda vacío con la armadura por defecto.
const getStartingBuild = (mech: Mech, mechs: Mech[], catalog: Item[]): Omit<SharedBuild, 'mech'> =>
  getStockBuild(mech, mechs, catalog) ?? { loadout: createEmptyLoadout(), armor: createDefaultArmor(mech.components), upgrades: [] };

export const useMechBuild = (mechs: Mech[], catalog: Item[], initialBuild: SharedBuild | null = null) => {
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, initialBuild ? mechs.indexOf(initialBuild.mech) : 0));
  const mech = mechs[selectedIndex];
  const [startingBuild] = useState(() => initialBuild ?? getStartingBuild(mech, mechs, catalog));
  const [loadout, setLoadout] = useState<EquippedLoadout>(startingBuild.loadout);
  const [armor, setArmor] = useState<ArmorState>(startingBuild.armor);
  const [upgradeIds, setUpgradeIds] = useState<string[]>(startingBuild.upgrades);
  const [activeZone, setActiveZone] = useState<Zone | null>(null);

  const applyBuild = (index: number, build: Omit<SharedBuild, 'mech'>) => {
    setSelectedIndex(index);
    setLoadout(build.loadout);
    setArmor(build.armor);
    setUpgradeIds(build.upgrades);
    setActiveZone(null);
  };

  const selectMech = (index: number) => {
    if (index === selectedIndex) return;
    applyBuild(index, getStartingBuild(mechs[index], mechs, catalog));
  };

  // Las mejoras son del mech, no del loadout: se mantienen al volver a la build de fábrica.
  const loadStockBuild = () => applyBuild(selectedIndex, { ...getStartingBuild(mech, mechs, catalog), upgrades: upgradeIds });

  const loadBuild = (build: SharedBuild) => applyBuild(Math.max(0, mechs.indexOf(build.mech)), build);

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

  const removeItemsOfType = (type: 'weapon' | 'ammo' | 'equipment') => {
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

  const toggleUpgrade = (upgrade: Upgrade) => {
    setUpgradeIds(prev => {
      if (prev.includes(upgrade.id)) return prev.filter(id => id !== upgrade.id);
      return canInstallUpgrade(mech, getUpgrades(prev), upgrade) ? [...prev, upgrade.id] : prev;
    });
  };

  const clearUpgrades = () => setUpgradeIds([]);

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
    setArmor(prev => maximizeArmor(mech.components, availableTonnage, prev, getArmorPointsPerTon(mech)));
  };

  return {
    mech,
    selectedIndex,
    selectMech,
    loadBuild,
    loadStockBuild,
    loadout,
    armor,
    upgradeIds,
    toggleUpgrade,
    clearUpgrades,
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
