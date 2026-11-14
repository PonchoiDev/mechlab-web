import { describe, expect, it } from 'vitest';
import {
  addAmmoFor,
  countFreeFor,
  duplicateItemTo,
  fillWeapon,
  getAmmoBoxesFor,
  getAmmoOnlyUsedBy,
  getHardpointWeaponIndex,
  moveAllTo,
  moveItemTo,
  removeAllOf,
  removeWeaponAndAmmo
} from './actions';
import { createStockBuild } from './fitting';
import { findMech, getItem } from './mechlabData';

// Acciones del clic derecho del MechLab de BATTLETECH, como las del MechLab de MW5.
const stock = (variant: string) => createStockBuild(findMech(variant)!);
const item = (id: string) => getItem(id)!;
const AC20_AMMO = 'Ammo_AmmunitionBox_Generic_AC20';
const HEAT_SINK = 'Gear_HeatSink_Generic_Standard';

describe('acciones del clic derecho del MechLab de BATTLETECH', () => {
  it('duplica una pieza donde cabe y avisa donde no', () => {
    const { mech, loadout } = stock('HBK-4G');
    const ammo = duplicateItemTo(mech, loadout, 'leftTorso', 0, 'leftTorso');
    expect(ammo.loadout.leftTorso).toEqual([AC20_AMMO, AC20_AMMO, AC20_AMMO]);
    const laser = duplicateItemTo(mech, loadout, 'leftArm', 0, 'rightArm');
    expect(laser.loadout).toBe(loadout);
    expect(laser.message).toBe('No free Energy hardpoint in the right arm');
  });

  it('mueve una pieza o todas las copias', () => {
    const { mech, loadout } = stock('HBK-4G');
    expect(moveItemTo(mech, loadout, 'leftTorso', 0, 'rightTorso').loadout.rightTorso).toContain(AC20_AMMO);
    const moved = moveAllTo(mech, loadout, 'leftLeg', HEAT_SINK, ['centerTorso']);
    expect(moved.loadout.leftLeg).toEqual([]);
    expect(moved.loadout.centerTorso).toEqual([HEAT_SINK, HEAT_SINK]);
    expect(removeAllOf(loadout, 'leftLeg', HEAT_SINK).loadout.leftLeg).toEqual([]);
  });

  it('llena los anclajes libres con copias del arma', () => {
    const { mech, loadout } = stock('HBK-4G');
    const ac2 = item('Weapon_Autocannon_AC2_0-STOCK');
    expect(countFreeFor(mech, loadout, ac2, ['rightTorso'])).toBe(2);
    expect(fillWeapon(mech, loadout, ac2, ['rightTorso']).loadout.rightTorso.filter(id => id === ac2.id)).toHaveLength(2);
  });

  it('añade munición del arma y la quita con ella si nadie más la usa', () => {
    const { mech, loadout } = stock('HBK-4G');
    const ac20 = item('Weapon_Autocannon_AC20_0-STOCK');
    const [box] = getAmmoBoxesFor(ac20);
    expect(box.id).toBe(AC20_AMMO);
    expect(addAmmoFor(mech, loadout, ac20, box, ['leftTorso']).loadout.leftTorso).toHaveLength(3);
    const index = getHardpointWeaponIndex(mech, loadout, 'rightTorso', 0)!;
    expect(getAmmoOnlyUsedBy(mech, loadout, 'rightTorso', index)).toHaveLength(2);
    const removed = removeWeaponAndAmmo(mech, loadout, 'rightTorso', index);
    expect(removed.loadout.rightTorso).toEqual([]);
    expect(removed.loadout.leftTorso).toEqual([]);
    expect(removed.message).toBe('Removed AC/20 and 2 ammo boxes');
  });

  it('la munición de las ametralladoras ofrece primero la caja entera', () => {
    expect(getAmmoBoxesFor(item('Weapon_MachineGun_MachineGun_0-STOCK')).map(box => box.tonnage)).toEqual([1, 0.5]);
  });
});
