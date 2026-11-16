import { describe, expect, it } from 'vitest';
import { createStockBuild } from './fitting';
import { findMech } from './mechlabData';
import { getRangeRadar } from '../rangeRadar';
import { getBuildSummary } from './stats';

// Criterio CA27 de docs/specs/battletech-mechlab.md: el daño por alcance como un campo de tiro.
describe('radar de alcance del MechLab de BATTLETECH', () => {
  it('CA27: anillos del HBK-4G de serie', () => {
    const profile = getBuildSummary(createStockBuild(findMech('HBK-4G')!)).rangeProfile;
    const radar = getRangeRadar(profile, 300);
    expect(radar.bands.map(band => band.distance)).toEqual([90, 180, 270, 360, 450, 540, 630, 720]);
    radar.bands.forEach((band, index) => {
      expect(band.outer).toBeGreaterThan(band.inner);
      if (index > 0) expect(band.inner).toBe(radar.bands[index - 1].outer);
    });
    expect(radar.bands.at(-1)!.outer).toBe(300);
    expect(radar.bands[0]).toMatchObject({ damage: 170, intensity: 1 });
    expect(radar.bands.filter(band => band.damage === 0).every(band => band.intensity === 0)).toBe(true);
    // Un semicírculo: el arco exterior va del extremo izquierdo al derecho por arriba.
    expect(radar.bands[0].path).toMatch(/^M /);
    expect(radar.bands[0].path).toContain(' A ');
  });
});
