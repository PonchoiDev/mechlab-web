import { describe, expect, it } from 'vitest';
import { createStockBuild } from './fitting';
import { BT_ITEMS, findMech } from './mechlabData';
import { getBtWeaponRangeState, getBuildSummary } from './stats';

// Criterio CA28 de docs/specs/battletech-mechlab.md: qué armas hacen daño en cada anillo del radar.
describe('armas de cada anillo del radar de BATTLETECH', () => {
  it('CA28: el CPLT-C1 a 90 y a 360 m', () => {
    const lines = getBuildSummary(createStockBuild(findMech('CPLT-C1')!)).weapons;
    const states = (distance: number) => Object.fromEntries(lines.map(line => [line.item.name, getBtWeaponRangeState(line.item, distance)]));
    expect(states(90)).toMatchObject({ 'M Laser': 'full', LRM15: 'belowMin' });
    expect(states(360)).toMatchObject({ 'M Laser': 'out', LRM15: 'full' });
  });

  it('CA29: cada anillo cubre desde el anterior, así que el alcance mínimo se mira en su borde interior', () => {
    const ppc = BT_ITEMS.find(item => item.id === 'Weapon_PPC_PPC_0-STOCK')!;
    expect([90, 180].map(distance => getBtWeaponRangeState(ppc, distance))).toEqual(['belowMin', 'full']);
    const atlas = getBuildSummary(createStockBuild(findMech('AS7-D')!));
    const at = (distance: number) => atlas.rangeProfile.find(entry => entry.distance === distance)!;
    expect([at(90).belowMin, at(180).belowMin, at(270).belowMin]).toEqual([80, 80, 0]);
  });
});

