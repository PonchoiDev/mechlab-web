import { describe, expect, it } from 'vitest';
import {
  canEquipItem,
  createEquippedItem,
  findHardpointForWeapon,
  getAmmoWarnings,
  getAvailableSlotType,
  getComponentStatus,
  getEquippableItems,
  getHardpointViews,
  getReplacementWeapons,
  getWeaponsForHardpoint,
  weaponFitsHardpoint
} from './equipment';
import { allItems, allMechs, getItem, getMech, makeComponent, makeLoadout } from '../test/fixtures';

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

  it('no admite jump jets de otra clase aunque queden ranuras de jump jet', () => {
    const centerTorso = getMech('ASN-101').components.centerTorso;
    const classFour = { ...getItem('JumpJet_Class4_Equipment'), equippedSlotType: 'JumpJetClass4_SlotType' };

    expect(getAvailableSlotType(getItem('JumpJet_Class4_Equipment'), centerTorso, [])).toBe('JumpJetClass4_SlotType');
    expect(getAvailableSlotType(getItem('JumpJet_Class3_Equipment'), centerTorso, [])).toBeNull();
    expect(getAvailableSlotType(getItem('JumpJet_Class4_Equipment'), centerTorso, [classFour])).toBeNull();
    expect(getAvailableSlotType(getItem('JumpJet_Class3_Equipment'), centerTorso, [classFour])).toBeNull();
  });

  it('cada mech solo admite jump jets de una clase en todo su cuerpo', () => {
    for (const mech of allMechs) {
      const classes = new Set(
        allItems
          .filter(item => item.equipmentType === 'jumpJet')
          .filter(item => Object.values(mech.components).some(component => getAvailableSlotType(item, component, []) !== null))
          .map(item => item.id)
      );
      expect(classes.size, mech.id).toBeLessThanOrEqual(1);
    }
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

  describe('cuerpo a cuerpo', () => {
    const forearm = makeComponent({ hardpoints: [{ type: 'melee', size: 'small', weightClass: 'medium' }] });
    const hand = makeComponent({ hardpoints: [{ type: 'melee', size: 'medium', weightClass: 'medium' }] });
    const weaponArm = makeComponent({ hardpoints: [{ type: 'melee', size: 'large', weightClass: 'medium' }] });

    it('el antebrazo (S) solo admite Hammerfist', () => {
      expect(canEquipItem(getItem('HammerFist_Medium'), forearm, [])).toBe(true);
      expect(canEquipItem(getItem('Knuckles_Medium'), forearm, [])).toBe(false);
      expect(canEquipItem(getItem('Mace_Medium'), forearm, [])).toBe(false);
    });

    it('la mano (M) admite puños pero no armas grandes ni Hammerfist', () => {
      expect(canEquipItem(getItem('Knuckles_Medium'), hand, [])).toBe(true);
      expect(canEquipItem(getItem('ArenaFist_Medium'), hand, [])).toBe(true);
      expect(canEquipItem(getItem('Mace_Medium'), hand, [])).toBe(false);
      expect(canEquipItem(getItem('HammerFist_Medium'), hand, [])).toBe(false);
    });

    it('el brazo de arma (L) admite armas L y M, pero no Hammerfist', () => {
      expect(canEquipItem(getItem('Mace_Medium'), weaponArm, [])).toBe(true);
      expect(canEquipItem(getItem('Knuckles_Medium'), weaponArm, [])).toBe(true);
      expect(canEquipItem(getItem('HammerFist_Medium'), weaponArm, [])).toBe(false);
    });

    it('exige que el arma sea de la clase de peso del mech', () => {
      expect(canEquipItem(getItem('Knuckles_Heavy'), hand, [])).toBe(false);
      expect(canEquipItem(getItem('Knuckles_Light'), hand, [])).toBe(false);
      expect(canEquipItem(getItem('Greatsword_Assault'), weaponArm, [])).toBe(false);
    });

    const meleeOptions = (mechId: string, zone: keyof ReturnType<typeof getMech>['components']) =>
      allItems
        .filter(item => item.weaponType === 'melee' && canEquipItem(item, getMech(mechId).components[zone], []))
        .map(item => item.id)
        .sort();

    it('coincide con lo comprobado en el juego', () => {
      expect(meleeOptions('ASN-21', 'leftArm')).toEqual(['ArenaFist_Medium', 'Knuckles_Medium']);
      expect(meleeOptions('ASN-25', 'leftArm')).toEqual(
        ['ArenaFist_Medium', 'Claws_Medium', 'Hatchet_Medium', 'Knuckles_Medium', 'Lance_Medium', 'Mace_Medium']
      );
      expect(meleeOptions('ANH-1A', 'leftArm')).toEqual(['HammerFist_Assault']);
      expect(meleeOptions('GAR-A', 'leftArm')).toEqual(['ArenaFist_Assault', 'Knuckles_Assault']);
      expect(meleeOptions('GAR-A', 'rightArm')).toEqual(['HammerFist_Assault']);
      expect(meleeOptions('AS7-D-H', 'leftArm')).toEqual(['ArenaFist_Assault', 'Knuckles_Assault']);
      expect(meleeOptions('HBR-A', 'leftArm')).toEqual(['HammerFist_Heavy']);
      expect(meleeOptions('SHD-2H', 'leftArm')).toEqual(['ArenaFist_Medium', 'Knuckles_Medium']);
      expect(meleeOptions('CGR-1A1', 'leftArm')).toEqual(['ArenaFist_Assault', 'Knuckles_Assault']);
    });

    it('los anclajes con arma especial indican cuál se usa si quedan vacíos', () => {
      expect(getMech('SHD-2H').components.leftArm.hardpoints.find(hardpoint => hardpoint.type === 'melee')?.defaultWeapon)
        .toBe('Battle Fist');
      expect(getMech('CGR-1A1').components.leftArm.hardpoints.find(hardpoint => hardpoint.type === 'melee')?.defaultWeapon)
        .toBe('Barrel Fist');
    });

    it('indica qué armas especiales se usan mientras su anclaje está vacío', () => {
      const builtIns = (mechId: string, items: ReturnType<typeof getItem>[] = []) =>
        getHardpointViews(getMech(mechId).components.leftArm.hardpoints, items)
          .map(view => view.builtInWeapon)
          .filter(Boolean);

      expect(builtIns('SHD-2H')).toEqual(['Battle Fist']);
      expect(builtIns('SHD-2H', [getItem('Knuckles_Medium')])).toEqual([]);
      expect(builtIns('ASN-21')).toEqual([]);
    });

    it('los Kodiak tienen sus manos como anclajes cuerpo a cuerpo', () => {
      expect(meleeOptions('KDK-1', 'leftArm')).toEqual(['ArenaFist_Assault', 'Knuckles_Assault']);
    });
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

describe('createEquippedItem', () => {
  it('asigna un identificador distinto a cada item equipado', () => {
    const laser = getItem('MediumLaser');
    const first = createEquippedItem(laser);
    const second = createEquippedItem(laser);

    expect(first.instanceId).not.toBe(second.instanceId);
    expect(first).toMatchObject({ id: 'MediumLaser', name: 'Medium Laser' });
  });

  it('guarda la ranura solo cuando se indica', () => {
    expect(createEquippedItem(getItem('SingleHeatSink'), 'EngineHeatsink_SlotType').equippedSlotType).toBe('EngineHeatsink_SlotType');
    expect(createEquippedItem(getItem('MediumLaser'))).not.toHaveProperty('equippedSlotType');
  });

  it('no modifica el item original', () => {
    const heatSink = getItem('SingleHeatSink');
    createEquippedItem(heatSink, 'General_SlotType');

    expect(heatSink).not.toHaveProperty('instanceId');
    expect(heatSink).not.toHaveProperty('equippedSlotType');
  });
});

describe('getEquippableItems', () => {
  const catalog = [
    getItem('MediumLaser'),
    getItem('LargeLaser'),
    getItem('Autocannon20'),
    getItem('SingleHeatSink'),
    getItem('AC20_Standard_AmmoEquipment'),
    getItem('LRM_AmmoEquipment')
  ];
  const component = makeComponent({ maxSlots: 2, hardpoints: [{ type: 'energy', size: 'medium' }] });

  it('muestra solo armas que caben en los anclajes libres y equipo que cabe en las ranuras', () => {
    const ids = getEquippableItems(catalog, component, makeLoadout(), 'leftArm').map(item => item.id);

    expect(ids).toEqual(['MediumLaser', 'SingleHeatSink']);
  });

  it('muestra la munición solo si hay un arma compatible en cualquier zona', () => {
    const loadout = makeLoadout({ rightTorso: [getItem('Autocannon20')] });
    const ids = getEquippableItems(catalog, component, loadout, 'leftArm').map(item => item.id);

    expect(ids).toContain('AC20_Standard_AmmoEquipment');
    expect(ids).not.toContain('LRM_AmmoEquipment');
  });

  it('tiene en cuenta lo que ya hay equipado en la zona', () => {
    const loadout = makeLoadout({ leftArm: [getItem('SmallLaser'), getItem('SingleHeatSink'), getItem('SingleHeatSink')] });

    expect(getEquippableItems(catalog, component, loadout, 'leftArm')).toEqual([]);
  });
});

describe('getHardpointViews', () => {
  it('indica qué arma ocupa cada anclaje', () => {
    const hardpoints = [{ type: 'energy', size: 'large' }, { type: 'energy', size: 'small' }] as const;
    const views = getHardpointViews([...hardpoints], [getItem('SmallLaser'), getItem('LargeLaser')]);

    expect(views.map(view => view.weapon?.id)).toEqual(['LargeLaser', 'SmallLaser']);
  });
});

describe('getComponentStatus', () => {
  const component = makeComponent({
    maxSlots: 3,
    hardpoints: [{ type: 'energy', size: 'medium' }, { type: 'ballistic', size: 'large' }],
    specialSlots: { EngineHeatsink_SlotType: 1 }
  });

  it('cuenta slots usados, anclajes libres y ranuras especiales', () => {
    const status = getComponentStatus(component, [
      getItem('MediumLaser'),
      getItem('AC20_Standard_AmmoEquipment'),
      { ...getItem('SingleHeatSink'), equippedSlotType: 'EngineHeatsink_SlotType' }
    ]);

    expect(status).toMatchObject({ usedSlots: 1, maxSlots: 3, freeHardpoints: 1, isOverSlots: false, hasFreeSpace: true });
    expect(status.specialSlots).toEqual([{ slotType: 'EngineHeatsink_SlotType', capacity: 1, used: 1 }]);
  });

  it('marca el componente lleno cuando no queda ningún hueco', () => {
    const status = getComponentStatus(component, [
      getItem('MediumLaser'),
      getItem('Autocannon20'),
      getItem('AC20_Standard_AmmoEquipment'),
      getItem('AC20_Standard_AmmoEquipment'),
      getItem('AC20_Standard_AmmoEquipment'),
      { ...getItem('SingleHeatSink'), equippedSlotType: 'EngineHeatsink_SlotType' }
    ]);

    expect(status).toMatchObject({ freeHardpoints: 0, hasFreeSpace: false, isOverSlots: false });
  });

  it('detecta cuando se superan los slots', () => {
    const ammo = getItem('AC20_Standard_AmmoEquipment');
    expect(getComponentStatus(component, [ammo, ammo, ammo, ammo]).isOverSlots).toBe(true);
  });

  it('no cuenta como libre un anclaje con arma especial de serie', () => {
    expect(getComponentStatus(getMech('SHD-2H').components.leftArm, []).freeHardpoints).toBe(0);
  });
});

describe('getWeaponsForHardpoint', () => {
  const component = makeComponent({
    hardpoints: [{ type: 'energy', size: 'small' }, { type: 'ballistic', size: 'large' }]
  });
  const catalog = [getItem('SmallLaser'), getItem('MediumLaser'), getItem('Autocannon20'), getItem('SingleHeatSink')];

  it('solo devuelve las armas que caben en el anclaje elegido', () => {
    expect(getWeaponsForHardpoint(catalog, component, [], 0).map(item => item.id)).toEqual(['SmallLaser']);
    expect(getWeaponsForHardpoint(catalog, component, [], 1).map(item => item.id)).toEqual(['Autocannon20']);
  });

  it('devuelve una lista vacía para un anclaje inexistente', () => {
    expect(getWeaponsForHardpoint(catalog, component, [], 5)).toEqual([]);
  });
});

describe('anclaje fijo de cada arma', () => {
  const twoEnergy = [{ type: 'energy', size: 'large' }, { type: 'energy', size: 'large' }] as const;

  it('mantiene el arma en el anclaje donde se equipó', () => {
    const laser = createEquippedItem(getItem('MediumLaser'), undefined, 1);
    const views = getHardpointViews([...twoEnergy], [laser]);

    expect(views.map(view => view.weapon?.id)).toEqual([undefined, 'MediumLaser']);
  });

  it('reparte automáticamente las armas sin anclaje asignado o con uno no válido', () => {
    const misplaced = createEquippedItem(getItem('LargeLaser'), undefined, 5);
    const views = getHardpointViews([...twoEnergy], [misplaced]);

    expect(views.map(view => view.weapon?.id)).toEqual(['LargeLaser', undefined]);
  });

  it('elige el anclaje libre más pequeño que le sirve al arma', () => {
    const hardpoints = [{ type: 'energy', size: 'large' }, { type: 'energy', size: 'small' }] as const;

    expect(findHardpointForWeapon([...hardpoints], [], getItem('SmallLaser'))).toBe(1);
    expect(findHardpointForWeapon([...hardpoints], [], getItem('LargeLaser'))).toBe(0);
    expect(findHardpointForWeapon([...hardpoints], [createEquippedItem(getItem('SmallLaser'), undefined, 1)], getItem('SmallLaser'))).toBe(0);
    expect(findHardpointForWeapon([...hardpoints], [], getItem('Autocannon20'))).toBeNull();
  });

  it('no ofrece armas para un anclaje ya ocupado', () => {
    const component = makeComponent({ hardpoints: [...twoEnergy] });
    const laser = createEquippedItem(getItem('MediumLaser'), undefined, 0);

    expect(getWeaponsForHardpoint([getItem('SmallLaser')], component, [laser], 0)).toEqual([]);
    expect(getWeaponsForHardpoint([getItem('SmallLaser')], component, [laser], 1).map(item => item.id)).toEqual(['SmallLaser']);
  });
});

describe('getAmmoWarnings', () => {
  it('avisa de armas sin munición compatible en el mech', () => {
    const warnings = getAmmoWarnings(makeLoadout({ rightTorso: [getItem('LBXAutocannon10'), getItem('LBXAutocannon10')] }));

    expect(warnings.rightTorso).toEqual([{ kind: 'missing-ammo', itemName: getItem('LBXAutocannon10').name }]);
  });

  it('no avisa cuando la munición está en otro componente', () => {
    const warnings = getAmmoWarnings(makeLoadout({
      rightTorso: [getItem('LBXAutocannon10')],
      leftLeg: [getItem('AC10_LBX_AmmoEquipment')]
    }));

    expect(Object.values(warnings).flat()).toEqual([]);
  });

  it('avisa de munición que no sirve a ningún arma equipada', () => {
    const warnings = getAmmoWarnings(makeLoadout({ leftTorso: [getItem('LRM_AmmoEquipment')], leftArm: [getItem('SRM6')] }));

    expect(warnings.leftTorso).toEqual([{ kind: 'unused-ammo', itemName: 'LRM Ammo' }]);
    expect(warnings.leftArm).toEqual([{ kind: 'missing-ammo', itemName: getItem('SRM6').name }]);
  });

  it('no avisa de armas que no usan munición', () => {
    expect(Object.values(getAmmoWarnings(makeLoadout({ leftArm: [getItem('MediumLaser')] }))).flat()).toEqual([]);
  });
});

describe('ECM y sondas activas', () => {
  const adderArm = getMech('ADR-S').components.leftArm;

  it('el ECM va en la ranura ECM del componente', () => {
    expect(getAvailableSlotType(getItem('GuardianECM'), adderArm, [])).toBe('ECM_SlotType');
    expect(getAvailableSlotType(getItem('ClanECM'), adderArm, [])).toBe('ECM_SlotType');
  });

  it('solo cabe un ECM por ranura y no puede ir en ranuras generales', () => {
    const installed = { ...getItem('GuardianECM'), equippedSlotType: 'ECM_SlotType' };

    expect(getAvailableSlotType(getItem('ClanECM'), adderArm, [installed])).toBeNull();
    expect(getAvailableSlotType(getItem('GuardianECM'), makeComponent({ maxSlots: 10 }), [])).toBeNull();
  });

  it('las sondas usan su ranura y la Clan Active Probe también admite la general', () => {
    const generalOnly = makeComponent({ maxSlots: 4 });

    expect(getAvailableSlotType(getItem('BeagleActiveProbe'), generalOnly, [])).toBeNull();
    expect(getAvailableSlotType(getItem('ClanActiveProbe'), generalOnly, [])).toBe('General_SlotType');
    expect(getAvailableSlotType(getItem('BeagleActiveProbe'), makeComponent({ specialSlots: { BAP_SlotType: 1 } }), []))
      .toBe('BAP_SlotType');
  });
});

describe('getReplacementWeapons', () => {
  it('ofrece las armas que caben en el anclaje aunque esté ocupado', () => {
    const component = makeComponent({ hardpoints: [{ type: 'energy', size: 'medium' }] });
    const catalog = [getItem('SmallLaser'), getItem('MediumLaser'), getItem('LargeLaser'), getItem('Autocannon20')];

    expect(getReplacementWeapons(catalog, component, 0).map(item => item.id)).toEqual(['SmallLaser', 'MediumLaser']);
  });
});

describe('anclajes omni', () => {
  const omniLarge = { type: 'omni' as const, size: 'large' as const };

  it('admiten energía, balística y misiles de su tamaño, pero no AMS ni cuerpo a cuerpo', () => {
    expect(weaponFitsHardpoint(omniLarge, getItem('ERPPC'))).toBe(true);
    expect(weaponFitsHardpoint(omniLarge, getItem('LRM15'))).toBe(true);
    expect(weaponFitsHardpoint(omniLarge, getItem('Autocannon20'))).toBe(true);
    expect(weaponFitsHardpoint({ type: 'omni', size: 'small' }, getItem('LRM15'))).toBe(false);
    expect(weaponFitsHardpoint(omniLarge, getItem('AntiMissileSystem'))).toBe(false);
  });

  it('se usan después de los anclajes del tipo exacto', () => {
    const hardpoints = [omniLarge, { type: 'energy' as const, size: 'large' as const }];
    expect(findHardpointForWeapon(hardpoints, [], getItem('ERPPC'))).toBe(1);
    expect(findHardpointForWeapon(hardpoints, [], getItem('LRM15'))).toBe(0);
  });

  it('el Adder Prime tiene sus dos anclajes omni en los brazos', () => {
    const adder = getMech('ADR-PRIME');
    const omni = Object.values(adder.components).flatMap(component => component.hardpoints).filter(hardpoint => hardpoint.type === 'omni');
    expect(omni).toHaveLength(2);
  });
});

describe('anclajes de artillería', () => {
  const artillery = { type: 'artillery' as const, size: 'large' as const };

  it('el Arrow IV solo va en anclajes de artillería', () => {
    expect(weaponFitsHardpoint(artillery, getItem('ArrowIV'))).toBe(true);
    expect(weaponFitsHardpoint(artillery, getItem('C-ArrowIV'))).toBe(true);
    expect(weaponFitsHardpoint({ type: 'missile', size: 'large' }, getItem('ArrowIV'))).toBe(false);
    expect(weaponFitsHardpoint({ type: 'omni', size: 'large' }, getItem('ArrowIV'))).toBe(false);
  });

  it('los anclajes de artillería no admiten otros misiles', () => {
    expect(weaponFitsHardpoint(artillery, getItem('LRM15'))).toBe(false);
  });

  it('el Catapult CPLT-C3 tiene su anclaje de artillería en el brazo derecho', () => {
    expect(getMech('CPLT-C3').components.rightArm.hardpoints).toContainEqual(artillery);
  });
});
