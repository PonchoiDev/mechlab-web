import { describe, expect, it } from 'vitest';
import {
  getItemAmmoFamily,
  getItemAmmoFamilyLabel,
  getItemAmmoType,
  getItemSupportedSlotTypes,
  getItemWeaponType,
  isAmmoCompatibleWithWeapon,
  isJumpJet
} from './items';
import { getHardpointOccupancy, getSlotTypeLabel } from './equipment';
import type { Hardpoint } from '../types/mech';
import { allItems, getItem, makeItem } from '../test/fixtures';

describe('isJumpJet', () => {
  it('reconoce los jump jets por tipo de equipo, id o nombre', () => {
    expect(isJumpJet(getItem('JumpJet_Class3_Equipment'))).toBe(true);
    expect(isJumpJet(makeItem({ id: 'jumpjet_custom' }))).toBe(true);
    expect(isJumpJet(makeItem({ name: 'Heavy Jump Jet' }))).toBe(true);
  });

  it('no confunde otros equipos con jump jets', () => {
    expect(isJumpJet(getItem('SingleHeatSink'))).toBe(false);
    expect(isJumpJet(getItem('MediumLaser'))).toBe(false);
  });
});

describe('getItemSupportedSlotTypes', () => {
  it('usa specialSlotTypes cuando el item los declara', () => {
    expect(getItemSupportedSlotTypes(makeItem({ specialSlotTypes: ['ECM_SlotType'] }))).toEqual(['ECM_SlotType']);
  });

  it('asigna a cada clase de jump jet su ranura', () => {
    expect(getItemSupportedSlotTypes(getItem('JumpJet_Class1_Equipment'))).toEqual(['JumpJetClass1_SlotType']);
    expect(getItemSupportedSlotTypes(getItem('JumpJet_Class5_Equipment'))).toEqual(['JumpJetClass5_SlotType']);
  });

  it('permite los disipadores en el motor y después en ranuras generales', () => {
    expect(getItemSupportedSlotTypes(getItem('SingleHeatSink'))).toEqual(['EngineHeatsink_SlotType', 'General_SlotType']);
    expect(getItemSupportedSlotTypes(getItem('DoubleHeatSink'))).toEqual(['EngineHeatsink_SlotType', 'General_SlotType']);
  });

  it('asigna cada supercargador a su ranura MASC sin importar mayúsculas', () => {
    expect(getItemSupportedSlotTypes(getItem('Supercharger_Arena_MKI'))).toEqual(['MASC_MKI_SlotType']);
    expect(getItemSupportedSlotTypes(getItem('SUPERCHARGER_Arena_MKII'))).toEqual(['MASC_MKII_SlotType']);
    expect(getItemSupportedSlotTypes(getItem('Supercharger_Arena_MKIII'))).toEqual(['MASC_MKIII_SlotType']);
    expect(getItemSupportedSlotTypes(getItem('Supercharger_Arena_MKIV'))).toEqual(['MASC_MKIV_SlotType']);
    expect(getItemSupportedSlotTypes(getItem('Supercharger_Arena_MKV'))).toEqual(['MASC_MKV_SlotType']);
  });

  it('usa la ranura general para el resto', () => {
    expect(getItemSupportedSlotTypes(getItem('TargetingComputer_Mk1'))).toEqual(['General_SlotType']);
    expect(getItemSupportedSlotTypes(getItem('AC20_Standard_AmmoEquipment'))).toEqual(['General_SlotType']);
  });
});

describe('getItemWeaponType y getItemAmmoType', () => {
  it('devuelve el tipo de arma declarado', () => {
    expect(getItemWeaponType(getItem('MediumLaser'))).toBe('energy');
    expect(getItemWeaponType(getItem('Autocannon20'))).toBe('ballistic');
    expect(getItemWeaponType(getItem('LRM20'))).toBe('missile');
    expect(getItemWeaponType(getItem('Greatsword_Assault'))).toBe('melee');
  });

  it('trata el AMS como ams aunque el dato diga otra cosa', () => {
    expect(getItemWeaponType(getItem('AntiMissileSystem'))).toBe('ams');
    expect(getItemWeaponType(makeItem({ id: 'AntiMissileSystem_Lvl2', weaponType: 'ballistic' }))).toBe('ams');
    expect(getItemAmmoType(makeItem({ id: 'AMS_AmmoEquipment', weaponType: 'ballistic' }))).toBe('ams');
  });

  it('devuelve null para equipo sin tipo de arma', () => {
    expect(getItemWeaponType(getItem('SingleHeatSink'))).toBeNull();
    expect(getItemAmmoType(getItem('SingleHeatSink'))).toBeNull();
  });
});

describe('getItemAmmoFamily', () => {
  it.each([
    ['AC20_Standard_AmmoEquipment', 'ac20'],
    ['AC20_Standard_Half_AmmoEquipment', 'ac20'],
    ['AC10_LBX_AmmoEquipment', 'lbx-ac10'],
    ['AC5_Ultra_AmmoEquipment', 'ultra-ac5'],
    ['LRM_Artemis_AmmoEquipment', 'lrm-artemis'],
    ['SRM_Streak_AmmoEquipment', 'streak-srm'],
    ['AMS_AmmoEquipment', 'ams']
  ])('la munición %s pertenece a la familia %s', (id, family) => {
    expect(getItemAmmoFamily(getItem(id))).toBe(family);
  });

  it.each([
    ['Autocannon2', 'ac2'],
    ['Autocannon20', 'ac20'],
    ['Autocannon20_Burst', 'ac20'],
    ['LBXAutocannon10_SolidSlug', 'lbx-ac10'],
    ['UltraAutocannon5', 'ultra-ac5'],
    ['LRM10', 'lrm'],
    ['LRM10_Artemis', 'lrm-artemis'],
    ['LRM10_Artemis_Stream', 'lrm-artemis'],
    ['SRM6_Artemis', 'srm-artemis'],
    ['StreakSRM2', 'streak-srm'],
    ['AntiMissileSystem', 'ams']
  ])('el arma %s pertenece a la familia %s', (id, family) => {
    expect(getItemAmmoFamily(getItem(id))).toBe(family);
  });

  it('devuelve null para armas sin munición', () => {
    expect(getItemAmmoFamily(getItem('MediumLaser'))).toBeNull();
    expect(getItemAmmoFamily(getItem('PPC'))).toBeNull();
  });

  it('asigna familia a toda la munición de items.json', () => {
    const ammoWithoutFamily = allItems
      .filter(item => item.type === 'ammo' && getItemAmmoFamily(item) === null)
      .map(item => item.id);
    expect(ammoWithoutFamily).toEqual([]);
  });
});

describe('getItemAmmoFamilyLabel', () => {
  it('usa la etiqueta de la familia o el nombre del item', () => {
    expect(getItemAmmoFamilyLabel(getItem('AC20_Standard_Half_AmmoEquipment'))).toBe('AC/20');
    expect(getItemAmmoFamilyLabel(getItem('LRM_Artemis_AmmoEquipment'))).toBe('LRM Artemis');
    expect(getItemAmmoFamilyLabel(getItem('MediumLaser'))).toBe('Medium Laser');
  });
});

describe('isAmmoCompatibleWithWeapon', () => {
  it('acepta munición de la misma familia', () => {
    expect(isAmmoCompatibleWithWeapon(getItem('AC20_Standard_AmmoEquipment'), getItem('Autocannon20_Burst'))).toBe(true);
    expect(isAmmoCompatibleWithWeapon(getItem('LRM_Artemis_AmmoEquipment'), getItem('LRM10_Artemis'))).toBe(true);
    expect(isAmmoCompatibleWithWeapon(getItem('AMS_AmmoEquipment'), getItem('AntiMissileSystem'))).toBe(true);
  });

  it('rechaza munición de otra familia', () => {
    expect(isAmmoCompatibleWithWeapon(getItem('AC20_Standard_AmmoEquipment'), getItem('Autocannon2'))).toBe(false);
    expect(isAmmoCompatibleWithWeapon(getItem('LRM_AmmoEquipment'), getItem('LRM10_Artemis'))).toBe(false);
    expect(isAmmoCompatibleWithWeapon(getItem('SRM_AmmoEquipment'), getItem('StreakSRM2'))).toBe(false);
  });

  it('rechaza combinaciones que no son munición y arma', () => {
    expect(isAmmoCompatibleWithWeapon(getItem('Autocannon20'), getItem('Autocannon20'))).toBe(false);
    expect(isAmmoCompatibleWithWeapon(getItem('AC20_Standard_AmmoEquipment'), getItem('AC20_Standard_AmmoEquipment'))).toBe(false);
  });

  it('toda la munición de items.json sirve para al menos un arma', () => {
    const weapons = allItems.filter(item => item.type === 'weapon');
    const orphanAmmo = allItems
      .filter(item => item.type === 'ammo')
      .filter(ammo => !weapons.some(weapon => isAmmoCompatibleWithWeapon(ammo, weapon)))
      .map(ammo => ammo.id);
    expect(orphanAmmo).toEqual([]);
  });
});

describe('getHardpointOccupancy', () => {
  const energySmall: Hardpoint = { type: 'energy', size: 'small' };
  const energyLarge: Hardpoint = { type: 'energy', size: 'large' };

  it('coloca cada arma en un anclaje de su tipo y tamaño suficiente', () => {
    const { occupiedIndices, weaponAssignments } = getHardpointOccupancy(
      [energySmall, energyLarge],
      [getItem('MediumLaser')]
    );
    expect([...occupiedIndices]).toEqual([1]);
    expect(weaponAssignments.get(1)?.id).toBe('MediumLaser');
  });

  it('asigna primero las armas grandes para no desperdiciar anclajes', () => {
    const { weaponAssignments } = getHardpointOccupancy(
      [energyLarge, energySmall],
      [getItem('SmallLaser'), getItem('LargeLaser')]
    );
    expect(weaponAssignments.get(0)?.id).toBe('LargeLaser');
    expect(weaponAssignments.get(1)?.id).toBe('SmallLaser');
  });

  it('deja sin asignar las armas que no caben', () => {
    const { weaponAssignments } = getHardpointOccupancy([energySmall], [getItem('LargeLaser')]);
    expect(weaponAssignments.size).toBe(0);
  });

  it('ignora el tamaño en anclajes cuerpo a cuerpo', () => {
    const { weaponAssignments } = getHardpointOccupancy(
      [{ type: 'melee', size: 'medium' }],
      [getItem('Greatsword_Assault')]
    );
    expect(weaponAssignments.get(0)?.id).toBe('Greatsword_Assault');
  });

  it('no ocupa anclajes con equipo ni munición', () => {
    const { occupiedIndices } = getHardpointOccupancy(
      [energySmall],
      [getItem('SingleHeatSink'), getItem('AC20_Standard_AmmoEquipment')]
    );
    expect(occupiedIndices.size).toBe(0);
  });
});

describe('getSlotTypeLabel', () => {
  it('traduce las ranuras conocidas', () => {
    expect(getSlotTypeLabel('EngineHeatsink_SlotType')).toBe('Engine Heat Sink');
    expect(getSlotTypeLabel('JumpJetClass3_SlotType')).toBe('Jump Jets Class III');
  });

  it('genera una etiqueta legible para ranuras desconocidas', () => {
    expect(getSlotTypeLabel('Custom_Module_SlotType')).toBe('Custom Module');
  });
});
