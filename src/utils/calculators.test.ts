import { describe, expect, it } from 'vitest';
import {
  calculateArmorPoints,
  calculateArmorWeight,
  calculateCoolingRate,
  calculateEquippedWeight,
  calculateFirepower,
  calculateHeatSpike,
  calculateTopSpeed,
  clampArmorValue,
  createDefaultArmor,
  getBuildSummary,
  getWeaponPerformance,
  getWeaponStats,
  groupAmmunition,
  maximizeArmor,
  getArmorPointsPerTon,
  calculateMeleeDamage
} from './calculators';
import { allMechs, getItem, getMech, makeItem, makeLoadout } from '../test/fixtures';
import type { ArmorState, MechComponents } from '../types/mech';

const ZONES = Object.keys(makeLoadout()) as (keyof MechComponents)[];

const makeArmor = (overrides: Partial<ArmorState> = {}): ArmorState => ({
  ...Object.fromEntries(ZONES.map(zone => [zone, { front: 0, rear: 0 }])) as ArmorState,
  ...overrides
});

describe('calculateEquippedWeight', () => {
  it('suma el tonelaje de todos los items equipados', () => {
    const loadout = makeLoadout({
      leftArm: [getItem('MediumLaser')],
      rightTorso: [getItem('LRM20'), getItem('LRM_AmmoEquipment')]
    });

    expect(calculateEquippedWeight(loadout)).toBe(12);
  });

  it('devuelve 0 sin equipo', () => {
    expect(calculateEquippedWeight(makeLoadout())).toBe(0);
  });
});

describe('armadura', () => {
  it('calcula los puntos totales', () => {
    const armor = makeArmor({ head: { front: 10, rear: 0 }, centerTorso: { front: 20, rear: 5 } });

    expect(calculateArmorPoints(armor)).toBe(35);
  });

  it('convierte puntos en toneladas a razón de 32 por tonelada, o 35,84 con Ferro-Fibrosa', () => {
    expect(calculateArmorWeight(makeArmor({ head: { front: 32, rear: 0 } }))).toBe(1);
    expect(calculateArmorWeight(makeArmor({ centerTorso: { front: 70, rear: 30 } }))).toBe(3.125);
    expect(calculateArmorWeight(makeArmor({ head: { front: 35.84, rear: 0 } }), getArmorPointsPerTon({ armorType: 'ferroFibrous' }))).toBe(1);
    expect(calculateArmorWeight(makeArmor())).toBe(0);
  });

  it('crea la armadura por defecto al máximo con un tercio trasero en los torsos', () => {
    const armor = createDefaultArmor(getMech('AS7-D').components);

    expect(armor.head).toEqual({ front: 30, rear: 0 });
    expect(armor.centerTorso).toEqual({ front: 83, rear: 41 });
    expect(armor.leftTorso).toEqual({ front: 56, rear: 28 });
    expect(armor.leftArm).toEqual({ front: 68, rear: 0 });
  });

  it('la armadura por defecto de cada mech llena exactamente su máximo', () => {
    for (const mech of allMechs) {
      const armor = createDefaultArmor(mech.components);
      for (const zone of ZONES) {
        expect(armor[zone].front + armor[zone].rear, `${mech.id} ${zone}`).toBe(mech.components[zone].maxArmor);
      }
    }
  });
});

describe('maximizeArmor', () => {
  const atlas = getMech('AS7-D').components;

  it('llena todas las zonas cuando sobra tonelaje', () => {
    const armor = maximizeArmor(atlas, 100, makeArmor());

    for (const zone of ZONES) {
      expect(armor[zone].front + armor[zone].rear).toBe(atlas[zone].maxArmor);
    }
  });

  it('reparte los puntos por igual entre las zonas', () => {
    const armor = maximizeArmor(atlas, 1, makeArmor());

    expect(calculateArmorPoints(armor)).toBe(32);
    for (const zone of ZONES) {
      expect(armor[zone].front + armor[zone].rear).toBe(4);
    }
  });

  it('usa un tercio trasero si la zona no tenía armadura', () => {
    const armor = maximizeArmor(atlas, 1, makeArmor());

    expect(armor.centerTorso).toEqual({ front: 3, rear: 1 });
    expect(armor.head).toEqual({ front: 4, rear: 0 });
  });

  it('conserva la proporción delantera y trasera anterior', () => {
    const armor = maximizeArmor(atlas, 1, makeArmor({ centerTorso: { front: 2, rear: 2 }, leftTorso: { front: 10, rear: 0 } }));

    expect(armor.centerTorso).toEqual({ front: 2, rear: 2 });
    expect(armor.leftTorso).toEqual({ front: 4, rear: 0 });
  });

  it('no pasa del tonelaje disponible', () => {
    expect(calculateArmorPoints(maximizeArmor(atlas, 0.03, makeArmor()))).toBe(0);
    expect(calculateArmorPoints(maximizeArmor(atlas, 1, makeArmor(), 35.84))).toBe(35);
  });

  it('no asigna armadura sin tonelaje disponible', () => {
    expect(calculateArmorPoints(maximizeArmor(atlas, 0, makeArmor()))).toBe(0);
    expect(calculateArmorPoints(maximizeArmor(atlas, -5, makeArmor()))).toBe(0);
  });

  it('nunca supera el máximo por zona ni el tonelaje libre en ningún mech', () => {
    for (const mech of allMechs) {
      const availableTonnage = mech.tonnageMax - mech.baseTonnage;
      const armor = maximizeArmor(mech.components, availableTonnage, createDefaultArmor(mech.components));

      expect(calculateArmorWeight(armor), mech.id).toBeLessThanOrEqual(availableTonnage);
      for (const zone of ZONES) {
        expect(armor[zone].front + armor[zone].rear, `${mech.id} ${zone}`).toBeLessThanOrEqual(mech.components[zone].maxArmor);
      }
    }
  });
});

describe('calculateCoolingRate', () => {
  it('devuelve null si el mech no tiene refrigeración base', () => {
    expect(calculateCoolingRate(makeLoadout(), undefined)).toBeNull();
  });

  it('suma la refrigeración de los disipadores a la base', () => {
    const loadout = makeLoadout({
      centerTorso: [getItem('SingleHeatSink'), getItem('SingleHeatSink')],
      leftTorso: [getItem('DoubleHeatSink'), getItem('MediumLaser')]
    });

    expect(calculateCoolingRate(loadout, 1)).toBe(1.4);
    expect(calculateCoolingRate(makeLoadout(), 1.8)).toBe(1.8);
  });
});

describe('calculateTopSpeed', () => {
  it('aplica el factor de velocidad del juego y redondea a décimas', () => {
    expect(calculateTopSpeed(54)).toBe(63);
    expect(calculateTopSpeed(48.6)).toBe(56.7);
    expect(calculateTopSpeed(0)).toBe(0);
  });
});

describe('daño y calor', () => {
  it('suma el daño por salva multiplicando los misiles de cada lanzador', () => {
    const loadout = makeLoadout({
      leftArm: [getItem('MediumLaser')],
      leftTorso: [getItem('LRM20')],
      rightTorso: [getItem('StreakSRM2')]
    });

    expect(calculateFirepower(loadout)).toBe(33.8);
  });

  it('ignora el equipo y la munición', () => {
    const loadout = makeLoadout({ centerTorso: [getItem('SingleHeatSink'), getItem('LRM_AmmoEquipment')] });

    expect(calculateFirepower(loadout)).toBe(0);
    expect(calculateHeatSpike(loadout)).toBe(0);
  });

  it('suma el calor por disparo de las armas', () => {
    const loadout = makeLoadout({ leftArm: [getItem('MediumLaser')], rightArm: [getItem('LargeLaser')] });

    expect(calculateHeatSpike(loadout)).toBe(9.8);
  });

  it('multiplica el calor por misil por el tamaño del lanzador', () => {
    expect(calculateHeatSpike(makeLoadout({ leftTorso: [getItem('LRM20')] }))).toBe(5.4);
    expect(calculateHeatSpike(makeLoadout({ leftTorso: [getItem('StreakSRM2')] }))).toBe(1.8);
    expect(calculateHeatSpike(makeLoadout({ leftTorso: [getItem('LRM10_Artemis')] }))).toBe(3.6);
  });

  it('no multiplica el calor de armas que no son lanzadores', () => {
    expect(calculateHeatSpike(makeLoadout({ rightArm: [getItem('Autocannon20')] })))
      .toBe(Math.round((getItem('Autocannon20').tiers?.['1']?.heatPerShot ?? 0) * 10) / 10);
  });

  it('multiplica el daño por cada proyectil de la salva', () => {
    expect(calculateFirepower(makeLoadout({ rightArm: [getItem('LBXAutocannon10')] }))).toBe(13);
    expect(calculateFirepower(makeLoadout({ rightArm: [getItem('Autocannon20_Burst')] }))).toBe(24);
    expect(calculateFirepower(makeLoadout({ leftTorso: [getItem('MRM20')] }))).toBe(24);
    expect(calculateFirepower(makeLoadout({ leftTorso: [getItem('C-LRM20')] }))).toBe(33.6);
  });

  it('multiplica el calor por misil y por disparo de ráfaga, pero no por perdigón', () => {
    expect(calculateHeatSpike(makeLoadout({ rightArm: [getItem('LBXAutocannon10')] }))).toBe(1.3);
    expect(calculateHeatSpike(makeLoadout({ rightArm: [getItem('Autocannon20_Burst')] }))).toBe(4.2);
    expect(calculateHeatSpike(makeLoadout({ leftTorso: [getItem('MRM20')] }))).toBe(5.4);
  });

  it('usa las estadísticas del tier seleccionado', () => {
    const mediumLaser = getItem('MediumLaser');
    const tierZero = makeLoadout({ leftArm: [{ ...mediumLaser, tier: '0' }] });

    expect(calculateHeatSpike(tierZero)).toBe(2.7);
  });

  it('vuelve al tier 1 si el tier seleccionado no existe', () => {
    const loadout = makeLoadout({ leftArm: [getItem('MediumLaser', { tier: 'Clan' })] });

    expect(calculateHeatSpike(loadout)).toBe(2.3);
    expect(calculateFirepower(loadout)).toBe(5);
  });
});

describe('getWeaponPerformance', () => {
  it('calcula daño, calor, cadencia, DPS y alcance de cada arma', () => {
    const [laser] = getWeaponPerformance(makeLoadout({ leftArm: [getItem('MediumLaser')] }));

    expect(laser).toMatchObject({ zone: 'leftArm', damage: 5, heat: 2.25, rpm: 15, dps: 1.25, range: 270 });
    expect(laser.item.id).toBe('MediumLaser');
  });

  it('multiplica el daño y el calor de los misiles por el tamaño del lanzador', () => {
    const [lrm] = getWeaponPerformance(makeLoadout({ leftTorso: [getItem('LRM20')] }));

    expect(lrm.damage).toBeCloseTo(24);
    expect(lrm.heat).toBeCloseTo(5.4);
    expect(lrm.dps).toBeCloseTo(6);
  });

  it('calcula la cadencia a partir del enfriamiento si falta rpm', () => {
    const weapon = makeItem({ type: 'weapon', weaponType: 'energy', tiers: { '1': { damage: 10, cooldown: 4 } } });
    const [performance] = getWeaponPerformance(makeLoadout({ head: [weapon] }));

    expect(performance).toMatchObject({ rpm: 15, dps: 2.5, range: null });
  });

  it('usa los valores base del item si no tiene tiers', () => {
    const weapon = makeItem({ type: 'weapon', weaponType: 'ballistic', damage: 7, heat: 3, tiers: null });
    const [performance] = getWeaponPerformance(makeLoadout({ head: [weapon] }));

    expect(performance).toMatchObject({ damage: 7, heat: 3, rpm: 0, dps: 0, range: null });
  });

  it('solo incluye armas', () => {
    const loadout = makeLoadout({
      centerTorso: [getItem('SingleHeatSink'), getItem('AC20_Standard_AmmoEquipment')],
      rightArm: [getItem('Autocannon20')]
    });

    expect(getWeaponPerformance(loadout).map(weapon => weapon.item.id)).toEqual(['Autocannon20']);
  });
});

describe('groupAmmunition', () => {
  it('agrupa la munición por familia sumando capacidad y contenedores', () => {
    const loadout = makeLoadout({
      leftTorso: [getItem('AC20_Standard_AmmoEquipment'), getItem('AC20_Standard_Half_AmmoEquipment')],
      rightTorso: [getItem('LRM_AmmoEquipment'), getItem('MediumLaser')]
    });
    const fullBin = getItem('AC20_Standard_AmmoEquipment').capacity ?? 0;
    const halfBin = getItem('AC20_Standard_Half_AmmoEquipment').capacity ?? 0;

    expect(groupAmmunition(loadout)).toEqual([
      { ammoType: 'Ammo.Ballistic.AutoCannon.Standard.AC20', label: 'AC/20', capacity: fullBin + halfBin, bins: 2, volleys: null, seconds: null },
      { ammoType: 'Ammo.Missile.LRM', label: 'LRM', capacity: getItem('LRM_AmmoEquipment').capacity, bins: 1, volleys: null, seconds: null }
    ]);
  });

  it('devuelve una lista vacía sin munición', () => {
    expect(groupAmmunition(makeLoadout({ leftArm: [getItem('MediumLaser')] }))).toEqual([]);
  });
});

describe('getBuildSummary', () => {
  it('reúne todas las estadísticas del build', () => {
    const mech = getMech('AS7-D');
    const armor = createDefaultArmor(mech.components);
    const loadout = makeLoadout({
      leftArm: [getItem('MediumLaser')],
      leftTorso: [getItem('LRM20'), getItem('LRM_AmmoEquipment')],
      centerTorso: [getItem('JumpJet_Class3_Equipment'), getItem('SingleHeatSink')]
    });

    const summary = getBuildSummary(mech, loadout, armor);

    expect(summary).toMatchObject({
      equipmentWeight: calculateEquippedWeight(loadout),
      armorWeight: calculateArmorWeight(armor),
      totalWeight: mech.baseTonnage + calculateEquippedWeight(loadout) + calculateArmorWeight(armor),
      armorPoints: calculateArmorPoints(armor),
      maxArmorPoints: calculateArmorPoints(armor),
      // Los dos Battle Fist del Atlas suman 30 cada uno.
      firepower: calculateFirepower(loadout) + calculateMeleeDamage(mech, loadout),
      heatSpike: calculateHeatSpike(loadout),
      coolingRate: calculateCoolingRate(loadout, mech.BaseCoolingRate, mech.heatSinkType),
      topSpeed: calculateTopSpeed(mech.baseSpeed),
      jumpJetCount: 1,
      maxWeaponRange: 900
    });
    expect(summary.weapons.map(weapon => weapon.item.id)).toEqual(['LRM20', 'MediumLaser']);
    expect(summary.ammunition).toEqual(groupAmmunition(loadout));
  });

  it('no tiene alcance máximo sin armas', () => {
    const mech = getMech('AS7-D');

    expect(getBuildSummary(mech, makeLoadout(), createDefaultArmor(mech.components)).maxWeaponRange).toBe(0);
  });
});

describe('clampArmorValue', () => {
  it('mantiene los valores válidos', () => {
    expect(clampArmorValue(30, 10, 60)).toBe(30);
    expect(clampArmorValue(50, 10, 60)).toBe(50);
  });

  it('no permite valores negativos', () => {
    expect(clampArmorValue(-1, 10, 60)).toBe(0);
  });

  it('limita la suma de delantera y trasera al máximo de la zona', () => {
    expect(clampArmorValue(55, 10, 60)).toBe(50);
    expect(clampArmorValue(1, 60, 60)).toBe(0);
  });
});

describe('getWeaponStats', () => {
  it('da las estadísticas de un arma suelta igual que en la tabla de rendimiento', () => {
    const lrm = getItem('LRM20');
    const [performance] = getWeaponPerformance(makeLoadout({ leftTorso: [lrm] }));

    expect(performance).toMatchObject(getWeaponStats(lrm));
  });
});

describe('duración de la munición', () => {
  it('calcula salvas y segundos de fuego con las armas que la usan', () => {
    const lrmAmmo = getItem('LRM_AmmoEquipment');
    const [group] = groupAmmunition(makeLoadout({ leftTorso: [getItem('LRM20'), lrmAmmo] }));
    const lrm = getWeaponStats(getItem('LRM20'));

    expect(group.volleys).toBe(Math.floor((lrmAmmo.capacity ?? 0) / 20));
    expect(group.seconds).toBe(Math.round((lrmAmmo.capacity ?? 0) / (20 * lrm.rpm / 60)));
  });

  it('reparte la munición entre todas las armas que la usan', () => {
    const ammo = getItem('AC20_Standard_AmmoEquipment');
    const [single] = groupAmmunition(makeLoadout({ rightArm: [getItem('Autocannon20')], leftLeg: [ammo] }));
    const [shared] = groupAmmunition(makeLoadout({ rightArm: [getItem('Autocannon20')], leftArm: [getItem('Autocannon20_Burst')], leftLeg: [ammo] }));

    expect(single.volleys).toBe(ammo.capacity);
    expect(shared.volleys).toBe(Math.floor((ammo.capacity ?? 0) / 2));
  });

  it('las ráfagas solo gastan munición por disparo cuando el arma lo indica', () => {
    expect(getItem('Autocannon20_Burst').ammoPerVolley).toBe(1);
    expect(getItem('C-LRM20').ammoPerVolley).toBe(20);
    expect(getItem('LBXAutocannon10').ammoPerVolley).toBe(1);
  });
});
