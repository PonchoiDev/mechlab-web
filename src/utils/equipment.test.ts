import { describe, expect, it } from 'vitest';
import { canEquipItem, getAvailableSlotType } from './equipment';
import { getItem, makeComponent } from '../test/fixtures';

describe('getAvailableSlotType', () => {
  it('usa ranuras generales mientras quede espacio', () => {
    const component = makeComponent({ maxSlots: 3 });
    const ammo = getItem('AC20_Standard_AmmoEquipment');

    expect(getAvailableSlotType(ammo, component, [])).toBe('General_SlotType');
    expect(getAvailableSlotType(ammo, component, [ammo, ammo])).toBe('General_SlotType');
    expect(getAvailableSlotType(ammo, component, [ammo, ammo, ammo])).toBeNull();
  });

  it('tiene en cuenta cuántas ranuras ocupa cada item', () => {
    const component = makeComponent({ maxSlots: 2 });
    const bigItem = getItem('SingleHeatSink', { id: 'BigModule', slots: 2 });
    const ammo = getItem('AC20_Standard_AmmoEquipment');

    expect(getAvailableSlotType(bigItem, component, [])).toBe('General_SlotType');
    expect(getAvailableSlotType(bigItem, component, [ammo])).toBeNull();
  });

  it('no cuenta las armas en las ranuras generales', () => {
    const component = makeComponent({ maxSlots: 1 });
    const weapon = getItem('LRM20');

    expect(getAvailableSlotType(getItem('AC20_Standard_AmmoEquipment'), component, [weapon])).toBe('General_SlotType');
  });

  it('no cuenta los items colocados en ranuras especiales', () => {
    const component = makeComponent({ maxSlots: 1, engineHeatsinkSlots: 1 });
    const engineHeatSink = { ...getItem('SingleHeatSink'), equippedSlotType: 'EngineHeatsink_SlotType' };

    expect(getAvailableSlotType(getItem('AC20_Standard_AmmoEquipment'), component, [engineHeatSink])).toBe('General_SlotType');
  });

  it('coloca los disipadores primero en el motor y después en ranuras generales', () => {
    const component = makeComponent({ maxSlots: 1, engineHeatsinkSlots: 1 });
    const heatSink = getItem('SingleHeatSink');
    const inEngine = { ...heatSink, equippedSlotType: 'EngineHeatsink_SlotType' };
    const inGeneral = { ...heatSink, equippedSlotType: 'General_SlotType' };

    expect(getAvailableSlotType(heatSink, component, [])).toBe('EngineHeatsink_SlotType');
    expect(getAvailableSlotType(heatSink, component, [inEngine])).toBe('General_SlotType');
    expect(getAvailableSlotType(heatSink, component, [inEngine, inGeneral])).toBeNull();
  });

  it('prioriza la capacidad de specialSlots sobre los contadores antiguos', () => {
    const component = makeComponent({ engineHeatsinkSlots: 1, specialSlots: { EngineHeatsink_SlotType: 2 } });
    const inEngine = { ...getItem('SingleHeatSink'), equippedSlotType: 'EngineHeatsink_SlotType' };

    expect(getAvailableSlotType(getItem('SingleHeatSink'), component, [inEngine])).toBe('EngineHeatsink_SlotType');
  });

  it('solo admite jump jets de la clase que tiene el componente', () => {
    const component = makeComponent({ specialSlots: { JumpJetClass3_SlotType: 1 } });
    const classThree = getItem('JumpJet_Class3_Equipment');
    const equipped = { ...classThree, equippedSlotType: 'JumpJetClass3_SlotType' };

    expect(getAvailableSlotType(classThree, component, [])).toBe('JumpJetClass3_SlotType');
    expect(getAvailableSlotType(classThree, component, [equipped])).toBeNull();
    expect(getAvailableSlotType(getItem('JumpJet_Class2_Equipment'), component, [])).toBeNull();
  });

  it('usa jumpJetSlots cuando no hay specialSlots', () => {
    const component = makeComponent({ jumpJetSlots: 1 });

    expect(getAvailableSlotType(getItem('JumpJet_Class4_Equipment'), component, [])).toBe('JumpJetClass4_SlotType');
  });

  it('no coloca supercargadores sin su ranura MASC', () => {
    const supercharger = getItem('SUPERCHARGER_Arena_MKII');

    expect(getAvailableSlotType(supercharger, makeComponent({ maxSlots: 10 }), [])).toBeNull();
    expect(getAvailableSlotType(supercharger, makeComponent({ specialSlots: { MASC_MKII_SlotType: 1 } }), [])).toBe('MASC_MKII_SlotType');
  });
});

describe('canEquipItem', () => {
  it('permite equipar armas en anclajes compatibles libres', () => {
    const component = makeComponent({ hardpoints: [{ type: 'energy', size: 'medium' }] });

    expect(canEquipItem(getItem('MediumLaser'), component, [])).toBe(true);
    expect(canEquipItem(getItem('SmallLaser'), component, [])).toBe(true);
    expect(canEquipItem(getItem('MediumLaser'), component, [getItem('SmallLaser')])).toBe(false);
  });

  it('rechaza armas de otro tipo o demasiado grandes', () => {
    const component = makeComponent({ hardpoints: [{ type: 'energy', size: 'medium' }] });

    expect(canEquipItem(getItem('Autocannon5'), component, [])).toBe(false);
    expect(canEquipItem(getItem('LargeLaser'), component, [])).toBe(false);
  });

  it('reorganiza las armas para encontrar sitio a todas', () => {
    const component = makeComponent({
      hardpoints: [{ type: 'energy', size: 'large' }, { type: 'energy', size: 'small' }]
    });

    expect(canEquipItem(getItem('LargeLaser'), component, [getItem('SmallLaser')])).toBe(true);
  });

  it('ignora el tamaño en anclajes cuerpo a cuerpo', () => {
    const component = makeComponent({ hardpoints: [{ type: 'melee', size: 'medium' }] });

    expect(canEquipItem(getItem('Greatsword_Assault'), component, [])).toBe(true);
  });

  it('acepta el AMS en anclajes ams', () => {
    const component = makeComponent({ hardpoints: [{ type: 'ams', size: 'small' }] });

    expect(canEquipItem(getItem('AntiMissileSystem'), component, [])).toBe(true);
  });

  it('rechaza armas sin tipo', () => {
    const component = makeComponent({ hardpoints: [{ type: 'energy', size: 'large' }] });

    expect(canEquipItem(getItem('MediumLaser', { weaponType: null }), component, [])).toBe(false);
  });

  it('usa las ranuras para el resto de items', () => {
    const ammo = getItem('AC20_Standard_AmmoEquipment');

    expect(canEquipItem(ammo, makeComponent({ maxSlots: 1 }), [])).toBe(true);
    expect(canEquipItem(ammo, makeComponent({ maxSlots: 1 }), [ammo])).toBe(false);
  });
});
