import { useCallback, useState } from 'react';
import type { Zone } from '../../types/mech';
import type { BtArmorSide, BtBuild, BtItem, BtItemKind, BtMech } from '../../types/battletech-mechlab';
import { ZONE_LABELS } from '../../utils/zones';
import { clearArmor, distributeArmor, setArmor, stepArmor } from '../../utils/battletech/armor';
import { createStockBuild, describeMountProblem, mountItem, removeItem, removeItemsOfKind } from '../../utils/battletech/fitting';

// Estado de la build abierta. Las acciones que pueden fallar devuelven el mensaje para el aviso.
export const useBtBuild = (initial: BtBuild) => {
  const [build, setBuild] = useState<BtBuild>(initial);

  const selectMech = useCallback((mech: BtMech) => setBuild(createStockBuild(mech)), []);
  const loadBuild = useCallback((next: BtBuild) => setBuild(next), []);
  const loadStock = useCallback(() => setBuild(current => createStockBuild(current.mech)), []);

  const mount = (zone: Zone, item: BtItem): string => {
    const result = mountItem(build.mech, build.loadout, zone, item);
    if (!result.ok) return describeMountProblem(result.problem, build.mech, zone, item);
    setBuild({ ...build, loadout: result.loadout });
    return `${item.name} added to the ${ZONE_LABELS[zone].toLowerCase()}`;
  };

  const remove = (zone: Zone, index: number) =>
    setBuild(current => ({ ...current, loadout: removeItem(current.loadout, zone, index) }));

  const removeKinds = (kinds: BtItemKind[]) =>
    setBuild(current => ({ ...current, loadout: removeItemsOfKind(current.loadout, kinds) }));

  const changeArmor = (zone: Zone, side: BtArmorSide, value: number) =>
    setBuild(current => ({ ...current, armor: setArmor(current.mech, current.armor, zone, side, value) }));

  const stepArmorBy = (zone: Zone, side: BtArmorSide, steps: number) =>
    setBuild(current => ({ ...current, armor: stepArmor(current.mech, current.armor, zone, side, steps) }));

  const clear = () => setBuild(current => ({ ...current, armor: clearArmor() }));
  const distribute = () => setBuild(current => ({ ...current, armor: distributeArmor(current.mech, current.loadout) }));

  return { build, selectMech, loadBuild, loadStock, mount, remove, removeKinds, changeArmor, stepArmorBy, clear, distribute };
};
