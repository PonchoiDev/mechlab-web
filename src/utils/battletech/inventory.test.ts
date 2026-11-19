import { describe, expect, it } from 'vitest';
import {
  autoPlaceBtItem,
  BT_INVENTORY_CATEGORIES,
  countBtByCategory,
  filterBtInventory,
  getBtDropTargets,
  getBtInventoryItems,
  getNextFreeBtHardpoint,
  moveBtItem,
  placeBtItem,
  sortBtInventory,
  unequipBtItem,
  type BtInventoryFilters
} from './inventory';
import { createStockBuild, getHardpointViews } from './fitting';
import { BT_ITEMS, findMech, getItem } from './mechlabData';
import type { BtItem } from '../../types/battletech-mechlab';

const { mech, loadout } = createStockBuild(findMech('HBK-4G')!);
const item = (id: string): BtItem => getItem(id)!;
const M_LASER = 'Weapon_Laser_MediumLaser_0-STOCK';
const L_LASER = 'Weapon_Laser_LargeLaser_0-STOCK';
const S_LASER = 'Weapon_Laser_SmallLaser_0-STOCK';
const AC20 = 'Weapon_Autocannon_AC20_0-STOCK';
const LRM5 = 'Weapon_LRM_LRM5_0-STOCK';
const HEAT_SINK = 'Gear_HeatSink_Generic_Standard';
const AC20_AMMO = 'Ammo_AmmunitionBox_Generic_AC20';
const LRM_AMMO = 'Ammo_AmmunitionBox_Generic_LRM';
const filters = (changes: Partial<BtInventoryFilters> = {}): BtInventoryFilters =>
  ({ category: 'all', search: '', fitsOnly: true, ...changes });
const ids = (items: BtItem[]) => items.map(entry => entry.id);
const shown = (changes: Partial<BtInventoryFilters> = {}) => ids(filterBtInventory(getBtInventoryItems(), filters(changes), mech, loadout));

describe('pestañas del inventario de BATTLETECH', () => {
  it('CA1: All tiene lo que se puede montar, las armas por anclaje y el resto en Equipment y Ammo', () => {
    const items = getBtInventoryItems();
    const counts = countBtByCategory(items);

    expect(BT_INVENTORY_CATEGORIES).toEqual(['all', 'energy', 'ballistic', 'missile', 'support', 'equipment', 'ammo']);
    expect(items.some(entry => entry.builtIn)).toBe(false);
    expect(counts.all).toBe(BT_ITEMS.filter(entry => !entry.builtIn).length);
    expect(counts.energy + counts.ballistic + counts.missile + counts.support).toBe(items.filter(entry => entry.kind === 'weapon').length);
    expect(counts.ammo).toBe(items.filter(entry => entry.kind === 'ammo').length);
    expect(counts.equipment).toBe(items.filter(entry => entry.kind !== 'weapon' && entry.kind !== 'ammo').length);
  });
});

describe('filtros del inventario de BATTLETECH', () => {
  it('CA2: Fits this \'Mech deja lo que cabe en el HBK-4G', () => {
    const fits = shown();

    expect(fits).toEqual(expect.arrayContaining([M_LASER, AC20, AC20_AMMO, HEAT_SINK]));
    expect(fits).not.toContain(LRM5);
    expect(fits).not.toContain(LRM_AMMO);
  });

  it('CA3: con el brazo izquierdo como destino, lo que se puede montar en él', () => {
    const fits = shown({ target: { zone: 'leftArm', hardpointIndex: null } });

    expect(fits).toContain(HEAT_SINK);
    expect(fits).not.toContain(M_LASER);
  });

  it('CA4: con el anclaje ocupado del brazo izquierdo, las armas de su tipo que lo reemplazan', () => {
    const fits = shown({ target: { zone: 'leftArm', hardpointIndex: 0 } });

    expect(fits).toContain(L_LASER);
    expect(fits).not.toContain(S_LASER);
    expect(fits).not.toContain(HEAT_SINK);
  });

  it('CA12: por daño, hacia abajo, con el equipo al final', () => {
    const items = [item(M_LASER), item(HEAT_SINK), item(AC20), item(LRM5)];
    const volley = (entry: BtItem) => (entry.weapon?.damage ?? 0) * (entry.weapon?.shots ?? 1);
    const top = [item(M_LASER), item(AC20), item(LRM5)].sort((a, b) => volley(b) - volley(a))[0].id;
    const sorted = sortBtInventory(items, 'damage', 'desc');

    expect(sorted[0].id).toBe(top);
    expect(sorted.at(-1)?.id).toBe(HEAT_SINK);
  });
});

describe('destinos y colocación en BATTLETECH', () => {
  it('CA5: un M Laser solo puede ir a los anclajes de los brazos, como reemplazo', () => {
    const targets = getBtDropTargets(mech, loadout, item(M_LASER));

    expect(targets.leftArm).toEqual({ component: false, hardpoints: [0] });
    expect(targets.rightArm).toEqual({ component: false, hardpoints: [0] });
    expect(targets.rightTorso).toEqual({ component: false, hardpoints: [] });
  });

  it('CA6: soltar sobre un anclaje ocupado reemplaza su arma', () => {
    const result = placeBtItem(mech, loadout, 'leftArm', item(L_LASER), 0);

    expect(result.loadout.leftArm).toEqual([L_LASER]);
    expect(result.message).toBe('Replaced M Laser with L Laser in Left arm');
    expect(result.replaced).toBe(true);
  });

  it('CA7: donde no cabe no cambia nada y dice por qué', () => {
    const result = placeBtItem(mech, loadout, 'head', item(HEAT_SINK), null);

    expect(result.loadout).toBe(loadout);
    expect(result.message).toBe('Not enough free slots in the head');
  });

  it('CA8: mover un arma montada a un anclaje ocupado reemplaza la de allí', () => {
    const result = moveBtItem(mech, loadout, { zone: 'leftArm', index: 0 }, 'rightArm', 0);

    expect(result.loadout.leftArm).toEqual([]);
    expect(result.loadout.rightArm).toEqual([M_LASER]);
    expect(result.replaced).toBe(true);
  });

  it('CA9: desequipar quita el objeto y lo avisa', () => {
    const result = unequipBtItem(loadout, 'leftArm', 0);

    expect(result.loadout.leftArm).toEqual([]);
    expect(result.message).toBe('Removed M Laser from Left arm');
  });

  it('CA10: el clic derecho equipa en la primera ubicación donde cabe', () => {
    const ammo = autoPlaceBtItem(mech, loadout, item(AC20_AMMO));
    const laser = autoPlaceBtItem(mech, loadout, item(M_LASER));

    expect(ammo.loadout.centerTorso).toEqual([AC20_AMMO]);
    expect(ammo.message).toBe('Added AC/20 Ammo to Center torso');
    expect(laser.loadout).toBe(loadout);
    expect(laser.message).toBe("No room for M Laser in this 'Mech");
  });

  it('CA11: tras montar en el segundo anclaje balístico, el siguiente es el tercero', () => {
    const result = placeBtItem(mech, loadout, 'rightTorso', item('Weapon_Autocannon_AC2_0-STOCK'), 1);

    expect(getHardpointViews(mech, result.loadout, 'rightTorso')[1].item).not.toBeNull();
    expect(getNextFreeBtHardpoint(mech, result.loadout, 'rightTorso', 1)).toBe(2);
  });
});
