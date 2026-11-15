import { describe, expect, it } from 'vitest';
import { createStockBuild } from './fitting';
import { findMech } from './mechlabData';
import { getBtReadouts } from './readouts';

// Criterio CA26 de docs/specs/battletech-mechlab.md: las cifras de la imagen para compartir son las de la
// lectura de la página, en su orden.
describe('cifras de la imagen del MechLab de BATTLETECH', () => {
  it('CA26: las diez cifras del HBK-4G de serie', () => {
    const readouts = getBtReadouts(createStockBuild(findMech('HBK-4G')!));
    expect(readouts.map(({ label, value, unit }) => [label, value, unit ?? null])).toEqual([
      ['TONNAGE', '50.00', '/ 50 t'],
      ['ARMOR POINTS', '800', '/ 1045'],
      ['ARMOR MASS', '10.00', 't'],
      ['WALK / SPRINT', '120', '/ 200 m'],
      ['JUMP JETS', '0', '/ 4'],
      ['ALPHA DAMAGE', '170', null],
      ['MELEE DAMAGE', '80', null],
      ['ALPHA HEAT', '54', null],
      ['HEAT SINKING', '39', 'per turn'],
      ['MAX WEAPON RANGE', '270', 'm']
    ]);
    expect(readouts.some(readout => readout.warn)).toBe(false);
  });
});
