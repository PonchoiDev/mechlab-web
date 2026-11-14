import type { Zone } from '../../types/mech';
import type { BtArmor, BtArmorSide, BtLoadout, BtMech } from '../../types/battletech-mechlab';
import { ZONE_KEYS, mapZones } from '../zones';
import { getAllItems } from './fitting';
import { BT_CONSTANTS } from './mechlabData';

// Blindaje de BATTLETECH: el delantero llega hasta MaxArmor y el trasero hasta MaxRearArmor, cada uno
// por su lado (16 ubicaciones de serie pasan de MaxArmor sumando los dos). Pesa 0,0125 t por punto.

// Los pesos suman décimas y milésimas (0,0125 t por punto): se redondean para no arrastrar errores
// de coma flotante a la comparación con el tonelaje máximo.
export const roundTonnage = (value: number) => Math.round(value * 10000) / 10000;

export const getArmorLimit = (mech: BtMech, zone: Zone, side: BtArmorSide): number =>
  side === 'front' ? mech.locations[zone].maxArmor : mech.locations[zone].maxRearArmor ?? 0;

export const clampArmor = (value: number, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 0), max) : 0;

export const setArmor = (mech: BtMech, armor: BtArmor, zone: Zone, side: BtArmorSide, value: number): BtArmor =>
  ({ ...armor, [zone]: { ...armor[zone], [side]: clampArmor(value, getArmorLimit(mech, zone, side)) } });

// Los botones del juego mueven ARMOR_PER_STEP (5) puntos.
export const stepArmor = (mech: BtMech, armor: BtArmor, zone: Zone, side: BtArmorSide, steps: number): BtArmor =>
  setArmor(mech, armor, zone, side, armor[zone][side] + steps * BT_CONSTANTS.armorStep);

export const clearArmor = (): BtArmor => mapZones(() => ({ front: 0, rear: 0 }));

export const getArmorPoints = (armor: BtArmor): number =>
  ZONE_KEYS.reduce((total, zone) => total + armor[zone].front + armor[zone].rear, 0);

export const getMaxArmorPoints = (mech: BtMech): number =>
  ZONE_KEYS.reduce((total, zone) => total + getArmorLimit(mech, zone, 'front') + getArmorLimit(mech, zone, 'rear'), 0);

export const getArmorTonnage = (points: number): number => roundTonnage(points * BT_CONSTANTS.tonnagePerArmorPoint);

// Peso sin el blindaje: el chasis vacío (motor, giroscopio y cabina incluidos), el equipo fijo y el montado.
export const getEquipmentTonnage = (mech: BtMech, loadout: BtLoadout): number =>
  roundTonnage(mech.initialTonnage + getAllItems(mech, loadout).reduce((total, item) => total + item.tonnage, 0));

// Reparte el tonelaje libre en blindaje como el botón del mechlab del juego: con los porcentajes de
// ArmorAllocationRatio*, en pasos de 5 y sin pasar de los máximos. Lo que no cabe en una ubicación
// llena pasa a las demás, empezando por las de más peso en el reparto.
export const distributeArmor = (mech: BtMech, loadout: BtLoadout): BtArmor => {
  const step = BT_CONSTANTS.armorStep;
  const free = mech.tonnage - getEquipmentTonnage(mech, loadout);
  const budget = Math.max(0, Math.floor(roundTonnage(free / BT_CONSTANTS.tonnagePerArmorPoint)));
  const slots = ZONE_KEYS.flatMap(zone => (['front', 'rear'] as const).map((side, index) => ({
    zone,
    side,
    ratio: BT_CONSTANTS.armorRatios[zone][index],
    cap: getArmorLimit(mech, zone, side),
    value: 0
  }))).filter(slot => slot.cap > 0 && slot.ratio > 0);
  const totalRatio = slots.reduce((total, slot) => total + slot.ratio, 0);
  const total = Math.min(budget, slots.reduce((sum, slot) => sum + slot.cap, 0));

  for (const slot of slots) slot.value = Math.min(slot.cap, Math.floor((total * slot.ratio) / totalRatio / step) * step);
  let remaining = total - slots.reduce((sum, slot) => sum + slot.value, 0);
  const byRatio = [...slots].sort((a, b) => b.ratio - a.ratio);
  while (remaining > 0) {
    let changed = false;
    for (const slot of byRatio) {
      const add = Math.min(step, slot.cap - slot.value, remaining);
      // Solo pasos completos, salvo para llegar justo al máximo de una ubicación.
      if (add <= 0 || (add < step && slot.value + add !== slot.cap)) continue;
      slot.value += add;
      remaining -= add;
      changed = true;
      if (remaining <= 0) break;
    }
    if (!changed) break;
  }

  const armor = clearArmor();
  for (const slot of slots) armor[slot.zone][slot.side] = slot.value;
  return armor;
};
