import { describe, expect, it } from 'vitest';
import { joinWithCounts } from './format';

describe('joinWithCounts', () => {
  it('agrupa los nombres repetidos en el orden en que aparecen', () => {
    expect(joinWithCounts(['M Laser', 'M Laser', 'LRM15', 'M Laser', 'LRM15'])).toBe('M Laser ×3, LRM15 ×2');
    expect(joinWithCounts(['Gauss'])).toBe('Gauss');
    expect(joinWithCounts([])).toBe('');
  });
});
