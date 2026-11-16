import { describe, expect, it } from 'vitest';
import { getRangeRadar } from './rangeRadar';

// Criterio CA10 de docs/specs/analisis-armas.md: los anillos seguidos con el mismo daño se leen como un
// solo tramo, con una etiqueta.
describe('tramos del radar de daño por alcance', () => {
  it('CA10: junta los anillos seguidos con el mismo daño', () => {
    const damages = [63.4, 63.4, 46.8, 39.4, 39, 39, 24, 24, 24];
    const radar = getRangeRadar(damages.map((damage, index) => ({ distance: (index + 1) * 100, damage, belowMin: 0 })), 300);
    expect(radar.groups.map(group => [group.from, group.to, group.damage])).toEqual([
      [100, 200, 63.4],
      [300, 300, 46.8],
      [400, 400, 39.4],
      [500, 600, 39],
      [700, 900, 24]
    ]);
    const [first, , , , last] = radar.groups;
    expect(first.inner).toBe(radar.bands[0].inner);
    expect(first.outer).toBe(radar.bands[1].outer);
    expect(last.outer).toBe(300);
  });

  it('CA10: el daño por debajo del alcance mínimo también separa tramos', () => {
    const radar = getRangeRadar([
      { distance: 90, damage: 100, belowMin: 120 },
      { distance: 180, damage: 100, belowMin: 0 },
      { distance: 270, damage: 100, belowMin: 0 }
    ], 300);
    expect(radar.groups.map(group => [group.from, group.to, group.belowMin])).toEqual([[90, 90, 120], [180, 270, 0]]);
  });
});
