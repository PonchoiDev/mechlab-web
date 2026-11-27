import { describe, expect, it } from 'vitest';
import type { Zone } from '../../types/mech';
import type { YamlBuild, YamlMech } from '../../types/yaml-mechlab';
import yamlMechs from '../../data/yaml/mechs.json';
import { createStockBuild, dropExcessEngineHeatSinks, mountItem, setInternal } from './build';
import { getYamlStatsPanel } from './combat';
import { findYamlMech } from './data';
import { getActuatorSlots, getActuatorSlotTypes, getArmorPoints, getBuildTonnage, getEngineHeatSinkSlots, getFreeGeneralSlots, getGeneralSlots, getHeat, getTopSpeed } from './stats';

// Criterios de aceptación de docs/specs/superpesados-yaml.md, con las cifras de las capturas del mechlab del juego
// del MAD-BARA2 y el MAD-TF (YAML 0.99.4.3).

const panelOf = (mech: YamlMech, build: YamlBuild) =>
  Object.fromEntries(getYamlStatsPanel(mech, build).flat().map(cell => [cell.key, cell.value]));

describe('superpesados de YAML', () => {
  it('CA1: están los tres superpesados jugables, y solo ellos', () => {
    const superheavies = (yamlMechs as unknown as YamlMech[]).filter(mech => mech.superheavy).map(mech => [mech.id, mech.tonnage]);
    expect(superheavies.sort()).toEqual([['COR-ROAM', 115], ['MAD-BARA2', 125], ['MAD-TF', 125]]);
    expect(findYamlMech('ANH-1GT')).toBeUndefined();
  });

  it('CA2: el MAD-BARA2 tiene las ranuras y los actuadores de los superpesados, como en la captura', () => {
    const mech = findYamlMech('MAD-BARA2')!;
    const build = createStockBuild(mech);
    const slots = (zone: Zone) => [getGeneralSlots(mech, build, zone), getFreeGeneralSlots(mech, build, zone)];
    expect(slots('head')).toEqual([2, 0]);
    expect(slots('centerTorso')).toEqual([9, 1]);
    expect(slots('leftTorso')).toEqual([24, 16]);
    expect(slots('rightTorso')).toEqual([24, 5]);
    for (const zone of ['leftArm', 'rightArm'] as Zone[]) expect(slots(zone), zone).toEqual([18, 12]);
    for (const zone of ['leftLeg', 'rightLeg'] as Zone[]) expect(slots(zone), zone).toEqual([4, 3]);
    expect(getActuatorSlotTypes(mech, 'leftArm')).toEqual(['Superheavy_Shoulder_SlotType', 'Superheavy_UpperArm_SlotType', 'Superheavy_LowerArm_SlotType']);
    expect(getActuatorSlotTypes(mech, 'rightLeg')).toEqual(['Superheavy_Hip_SlotType', 'Superheavy_UpperLeg_SlotType', 'Superheavy_LowerLeg_SlotType', 'Superheavy_Foot_SlotType']);
  });

  it('CA3: el panel del MAD-BARA2 de serie, con sus dos núcleos, como en la captura', () => {
    const mech = findYamlMech('MAD-BARA2')!;
    const build = createStockBuild(mech);
    expect(getBuildTonnage(mech, build)).toBe(125);
    expect(panelOf(mech, build)).toMatchObject({
      armor: '720', structure: '495', alphaDamage: '179.5', dps: '43.23', heatPerSecond: '10.5', cooling: '5.6', turnRate: '50.4',
      alphaHeat: '43.23', heatCapacity: '86', torsoTwistRate: '63', speed: '77.76', torsoYaw: '70', weaponRange: '2,475',
      sensorRange: '1,328.12', armYaw: '26', amsIntercept: '12.25', amsRange: '300', ammo: '5,336'
    });
  });

  it('CA4: el panel del MAD-TF de serie, con armadura Hardened, como en la captura', () => {
    const mech = findYamlMech('MAD-TF')!;
    const build = createStockBuild(mech);
    expect(getBuildTonnage(mech, build)).toBe(125);
    expect(panelOf(mech, build)).toMatchObject({
      armor: '1,736', structure: '384', alphaDamage: '186.6', dps: '56.95', heatPerSecond: '10.36', cooling: '4.2', turnRate: '46.9',
      alphaHeat: '37.26', heatCapacity: '72', torsoTwistRate: '58.6', speed: '68.04', torsoYaw: '70', weaponRange: '1,125',
      sensorRange: '2,109.38', armYaw: '26', amsIntercept: '12.25', amsRange: '300', ammo: '1,820'
    });
  });

  it('CA5: sin el segundo núcleo, el MAD-BARA2 va a la mitad y pierde 2 disipadores del motor, como en la captura', () => {
    const mech = findYamlMech('MAD-BARA2')!;
    const stock = createStockBuild(mech);
    expect(getEngineHeatSinkSlots(mech, stock)).toBe(4);
    const oneCore = dropExcessEngineHeatSinks(mech, { ...stock, items: stock.items.filter(item => item.slotType !== 'Engine') });
    expect(getEngineHeatSinkSlots(mech, oneCore)).toBe(2);
    expect(oneCore.items.filter(item => item.slotType === 'EngineHeatsink_SlotType')).toHaveLength(2);
    expect(getTopSpeed(mech, oneCore)).toBeCloseTo(38.88, 4);
    const heat = getHeat(mech, oneCore);
    expect(heat.cooling).toBeCloseTo(3.2, 4);
    expect(heat.capacity).toBe(62);
    expect(getBuildTonnage(mech, oneCore)).toBe(113.5);
  });

  it('CA6: el equipo de actuadores de los superpesados solo cabe en ellos, y el normal solo en los demás', () => {
    const bara = findYamlMech('MAD-BARA2')!;
    const baraStock = createStockBuild(bara);
    expect(mountItem(bara, baraStock, 'leftArm', 'SH_IMPROVED_ACTUATORS').error).toBeUndefined();
    expect(mountItem(bara, baraStock, 'leftArm', 'IMPROVED_ACTUATORS').error).toMatch(/actuator slot/);
    const nsr = findYamlMech('NSR-9J')!;
    const nsrStock = createStockBuild(nsr);
    expect(mountItem(nsr, nsrStock, 'leftArm', 'IMPROVED_ACTUATORS').error).toBeUndefined();
    // Antes que la ranura, su tonelaje mínimo: solo va en 'Mechs de 105 t o más (docs/specs/clase-de-peso-yaml.md).
    expect(mountItem(nsr, nsrStock, 'leftArm', 'SH_IMPROVED_ACTUATORS').error).toMatch(/105 t or more/);
  });

  it('CA7: la armadura Hardened dobla los puntos de cualquier \'Mech', () => {
    const mech = findYamlMech('NSR-9J')!;
    const { installed, bonus } = getArmorPoints(mech, setInternal(createStockBuild(mech), 'Armorslot', 'HARDENED'));
    expect(installed + bonus).toBe(1198);
  });

  it('CA8: los actuadores de los superpesados ocupan dos ranuras', () => {
    const slotsOf = (mech: YamlMech, zone: Zone) => mech.zones[zone].actuators.map(actuator => getActuatorSlots(mech, zone, actuator));
    const corsair = findYamlMech('COR-ROAM')!;
    const nightstar = findYamlMech('NSR-9J')!;
    for (const zone of ['leftArm', 'rightLeg'] as const) {
      expect(slotsOf(corsair, zone).length).toBeGreaterThan(0);
      expect(slotsOf(corsair, zone).every(slots => slots === 2)).toBe(true);
      expect(slotsOf(nightstar, zone).length).toBeGreaterThan(0);
      expect(slotsOf(nightstar, zone).every(slots => slots === 1)).toBe(true);
    }
  });
});
