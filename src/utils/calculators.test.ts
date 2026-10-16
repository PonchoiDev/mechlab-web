import { describe, expect, it } from 'vitest';
import {
  calculateArmorPoints,
  calculateArmorWeight,
  calculateCoolingRate,
  calculateEquippedWeight,
  calculateFirepower,
  calculateHeatSpike,
  calculateTopSpeed,
  createDefaultArmor,
  getWeaponPerformance,
  maximizeArmor
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

  it('convierte puntos en toneladas a razón de 32 por tonelada, redondeando a centésimas', () => {
    expect(calculateArmorWeight(makeArmor({ head: { front: 32, rear: 0 } }))).toBe(1);
    expect(calculateArmorWeight(makeArmor({ centerTorso: { front: 70, rear: 30 } }))).toBe(3.13);
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

  it('aprovecha el margen del redondeo a centésimas', () => {
    const armor = maximizeArmor(atlas, 0.03, makeArmor());

    expect(calculateArmorPoints(armor)).toBe(1);
    expect(armor.head).toEqual({ front: 1, rear: 0 });
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
