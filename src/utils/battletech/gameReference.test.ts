import { describe, expect, it } from 'vitest';
import type { BtBuild } from '../../types/battletech-mechlab';
import { createStockBuild, getHardpointSummary, getLocationUsage } from './fitting';
import { findMech, getItem } from './mechlabData';
import { getBuildTonnage } from './stats';

// Cifras de las capturas del juego (pantallas Mech Bay y Refit de un Rifleman RFL-3C reequipado), como
// gameReference.test.ts del MechLab de MW5: si el MechLab y el juego no coinciden, manda el juego.
// Criterios CA22 a CA25 de docs/specs/battletech-mechlab.md.
const rifleman = findMech('RFL-3C')!;

const UAC2 = 'Weapon_Autocannon_UAC2_2-Imperator';
const HEAVY_JUMP_JET = 'Gear_JumpJet_Generic_Heavy';
const AC2_AMMO = 'Ammo_AmmunitionBox_Generic_AC2';

// El RFL-3C de la captura: 4 UAC/2 + + en los brazos, 4 Jump Jet (H) en el torso central, 4 cajas de
// AC/2 Ammo en las piernas, el Rangefinder Suite fijo en la cabeza y el blindaje de la pantalla Refit.
const refit: BtBuild = {
  mech: rifleman,
  loadout: {
    head: [],
    centerTorso: [HEAVY_JUMP_JET, HEAVY_JUMP_JET, HEAVY_JUMP_JET, HEAVY_JUMP_JET],
    leftTorso: [],
    rightTorso: [],
    leftArm: [UAC2, UAC2],
    rightArm: [UAC2, UAC2],
    leftLeg: [AC2_AMMO, AC2_AMMO],
    rightLeg: [AC2_AMMO, AC2_AMMO]
  },
  armor: {
    head: { front: 45, rear: 0 },
    centerTorso: { front: 75, rear: 20 },
    leftTorso: { front: 100, rear: 20 },
    rightTorso: { front: 100, rear: 20 },
    leftArm: { front: 80, rear: 0 },
    rightArm: { front: 80, rear: 0 },
    leftLeg: { front: 70, rear: 0 },
    rightLeg: { front: 70, rear: 0 }
  }
};

describe('referencia del juego: Rifleman RFL-3C', () => {
  it('CA22: máximos de blindaje, estructura y rol de serie de la pantalla Refit', () => {
    const limits = Object.fromEntries(Object.entries(rifleman.locations)
      .map(([zone, location]) => [zone, [location.maxArmor, location.maxRearArmor, location.structure]]));
    expect(limits).toEqual({
      head: [45, null, 16],
      centerTorso: [200, 100, 100],
      leftTorso: [140, 70, 70],
      rightTorso: [140, 70, 70],
      leftArm: [100, null, 50],
      rightArm: [100, null, 50],
      leftLeg: [140, null, 70],
      rightLeg: [140, null, 70]
    });
    expect(rifleman.role).toBe('Sniper');
  });

  it('CA23: el reequipo de la captura pesa 60 de 60 t con 4/4 B, 0/4 E, 0/0 M, 0/0 S y 4/4 JJ', () => {
    expect(getBuildTonnage(refit)).toBe(60);
    expect(getHardpointSummary(refit.mech, refit.loadout)).toEqual({
      ballistic: { used: 4, capacity: 4 },
      energy: { used: 0, capacity: 4 },
      missile: { used: 0, capacity: 0 },
      support: { used: 0, capacity: 0 },
      jumpJets: { used: 4, capacity: 4 }
    });
    const stock = createStockBuild(rifleman);
    expect(getHardpointSummary(stock.mech, stock.loadout).ballistic).toEqual({ used: 2, capacity: 4 });
  });

  it('CA24: nombres, fabricantes y bonificaciones como en el juego', () => {
    expect(getItem(UAC2)).toMatchObject({ name: 'UAC/2 + +', manufacturer: 'Imperator', bonuses: ['+ 10 Dmg.', '- 2 Tons'] });
    expect(getItem('Weapon_Autocannon_AC2_1-Mydron')).toMatchObject({
      name: 'AC/2 +', manufacturer: 'Mydron', bonuses: ['+ 10 Stb.Dmg.'],
      weapon: { damage: 25, instability: 15, heat: 4 }
    });
    expect(getItem(AC2_AMMO)?.name).toBe('AC/2 Ammo');
    expect(getItem(HEAVY_JUMP_JET)?.name).toBe('Jump Jet (H)');
    expect(getItem('Gear_General_Rangefinder_Suite')?.name).toBe('Rangefinder Suite');
  });

  it('CA25: los anclajes de cada ubicación, como los iconos de la pantalla Refit', () => {
    const usage = (zone: 'rightArm' | 'rightTorso' | 'head') => Object.fromEntries(
      (['ballistic', 'energy', 'missile', 'support'] as const).map(type => {
        const { used, capacity } = getLocationUsage(refit.mech, refit.loadout, zone).hardpoints[type];
        return [type, `${used}/${capacity}`];
      }));
    expect(usage('rightArm')).toEqual({ ballistic: '2/2', energy: '0/0', missile: '0/0', support: '0/0' });
    expect(usage('rightTorso')).toEqual({ ballistic: '0/0', energy: '0/2', missile: '0/0', support: '0/0' });
    expect(usage('head')).toEqual({ ballistic: '0/0', energy: '0/0', missile: '0/0', support: '0/0' });
  });
});

