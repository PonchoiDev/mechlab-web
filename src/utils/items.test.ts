import { describe, expect, it } from 'vitest';
import {
  getAmmoLabel,
  getSizeLabel,
  getSlotsLabel,
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

describe('getItemWeaponType', () => {
  it('devuelve el tipo de arma declarado', () => {
    expect(getItemWeaponType(getItem('MediumLaser'))).toBe('energy');
    expect(getItemWeaponType(getItem('Autocannon20'))).toBe('ballistic');
    expect(getItemWeaponType(getItem('LRM20'))).toBe('missile');
    expect(getItemWeaponType(getItem('Greatsword_Assault'))).toBe('melee');
  });

  it('trata el AMS como ams aunque el dato diga otra cosa', () => {
    expect(getItemWeaponType(getItem('AntiMissileSystem'))).toBe('ams');
    expect(getItemWeaponType(makeItem({ id: 'AntiMissileSystem_Lvl2', weaponType: 'ballistic' }))).toBe('ams');
  });

  it('devuelve null para equipo sin tipo de arma', () => {
    expect(getItemWeaponType(getItem('SingleHeatSink'))).toBeNull();
  });
});

describe('getAmmoLabel', () => {
  it('quita "Ammo" y "Half Ammo" del nombre de la munición', () => {
    expect(getAmmoLabel(getItem('AC20_Standard_AmmoEquipment'))).toBe('AC/20');
    expect(getAmmoLabel(getItem('AC20_Standard_Half_AmmoEquipment'))).toBe('AC/20');
    expect(getAmmoLabel(getItem('LRM_Artemis_AmmoEquipment'))).toBe('LRM Artemis');
    expect(getAmmoLabel(getItem('LBX20_AmmoEquipment'))).toBe('LB 20-X AC');
  });
});

describe('isAmmoCompatibleWithWeapon', () => {
  it('acepta munición con el mismo tipo de munición que el arma', () => {
    expect(isAmmoCompatibleWithWeapon(getItem('AC20_Standard_AmmoEquipment'), getItem('Autocannon20_Burst'))).toBe(true);
    expect(isAmmoCompatibleWithWeapon(getItem('LRM_Artemis_AmmoEquipment'), getItem('LRM10_Artemis'))).toBe(true);
    expect(isAmmoCompatibleWithWeapon(getItem('AMS_AmmoEquipment'), getItem('AntiMissileSystem'))).toBe(true);
    expect(isAmmoCompatibleWithWeapon(getItem('LRM_AmmoEquipment'), getItem('LRM20_Hotloaded'))).toBe(true);
    expect(isAmmoCompatibleWithWeapon(getItem('HeavyGauss_AmmoEquipment'), getItem('HeavyGaussRifle'))).toBe(true);
  });

  it('las armas Clan usan su propia munición Clan', () => {
    expect(isAmmoCompatibleWithWeapon(getItem('Clan_LRM_AmmoEquipment'), getItem('C-LRM20'))).toBe(true);
    expect(isAmmoCompatibleWithWeapon(getItem('Clan_ATM_AmmoEquipment'), getItem('C-ATM6'))).toBe(true);
    expect(isAmmoCompatibleWithWeapon(getItem('Clan_AC5_Ultra_AmmoEquipment'), getItem('C-UltraAutocannon5'))).toBe(true);
    expect(isAmmoCompatibleWithWeapon(getItem('Clan_LRM_AmmoEquipment'), getItem('LRM20'))).toBe(false);
    expect(isAmmoCompatibleWithWeapon(getItem('LRM_AmmoEquipment'), getItem('C-LRM20'))).toBe(false);
  });

  it('rechaza munición de otro tipo', () => {
    expect(isAmmoCompatibleWithWeapon(getItem('AC20_Standard_AmmoEquipment'), getItem('Autocannon2'))).toBe(false);
    expect(isAmmoCompatibleWithWeapon(getItem('LRM_AmmoEquipment'), getItem('LRM10_Artemis'))).toBe(false);
    expect(isAmmoCompatibleWithWeapon(getItem('SRM_AmmoEquipment'), getItem('StreakSRM2'))).toBe(false);
    expect(isAmmoCompatibleWithWeapon(getItem('LRM_AmmoEquipment'), getItem('C-LRM20'))).toBe(false);
  });

  it('rechaza armas que no usan munición', () => {
    expect(isAmmoCompatibleWithWeapon(getItem('AC20_Standard_AmmoEquipment'), getItem('MediumLaser'))).toBe(false);
  });

  it('rechaza combinaciones que no son munición y arma', () => {
    expect(isAmmoCompatibleWithWeapon(getItem('Autocannon20'), getItem('Autocannon20'))).toBe(false);
    expect(isAmmoCompatibleWithWeapon(getItem('AC20_Standard_AmmoEquipment'), getItem('AC20_Standard_AmmoEquipment'))).toBe(false);
  });

  it('toda la munición de items.json tiene tipo de munición', () => {
    expect(allItems.filter(item => item.type === 'ammo' && !item.ammoType).map(item => item.id)).toEqual([]);
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

  it('coloca las armas cuerpo a cuerpo en un anclaje de su clase y tamaño', () => {
    const { weaponAssignments } = getHardpointOccupancy(
      [{ type: 'melee', size: 'medium', weightClass: 'assault' }, { type: 'melee', size: 'large', weightClass: 'assault' }],
      [getItem('Knuckles_Assault'), getItem('Greatsword_Assault')]
    );
    expect(weaponAssignments.get(0)?.id).toBe('Knuckles_Assault');
    expect(weaponAssignments.get(1)?.id).toBe('Greatsword_Assault');
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

describe('etiquetas de inventario', () => {
  it('muestra el tamaño con la letra de los anclajes', () => {
    expect(getSizeLabel(getItem('SmallLaser'))).toBe('S');
    expect(getSizeLabel(getItem('MediumLaser'))).toBe('M');
    expect(getSizeLabel(getItem('LargeLaser'))).toBe('L');
  });

  it('las armas no guardan slots porque solo ocupan un anclaje', () => {
    expect(allItems.filter(item => item.type === 'weapon' && item.slots !== undefined).map(item => item.id)).toEqual([]);
    expect(allItems.filter(item => item.type !== 'weapon' && item.slots === undefined).map(item => item.id)).toEqual([]);
  });

  it('escribe los slots en singular o plural', () => {
    expect(getSlotsLabel(getItem('SingleHeatSink'))).toBe('1 slot');
    expect(getSlotsLabel(getItem('DoubleHeatSink'))).toBe('3 slots');
  });
});
