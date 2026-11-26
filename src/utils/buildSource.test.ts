import { describe, expect, it } from 'vitest';
import { filterBySource, getBuildSource, parseBuildSource, sourceForHighlighted } from './buildSource';

// El origen exclusivo de la página de builds de MW5 (docs/specs/origen-builds-publicadas.md).
const yaml = { id: 'y', code: 'Y1.eyJtIjoiYXRsYXMifQ' };
const vanilla = { id: 'v', code: '[1,"atlas"]' };

describe('origen de las builds publicadas', () => {
  it('CA1: el origen de un código', () => {
    expect(getBuildSource(yaml.code)).toBe('yaml');
    expect(getBuildSource(vanilla.code)).toBe('vanilla');
  });

  it('CA2: el origen recordado en el navegador', () => {
    expect(parseBuildSource('yaml')).toBe('yaml');
    expect(parseBuildSource('vanilla')).toBe('vanilla');
    expect(parseBuildSource(null)).toBe('vanilla');
    expect(parseBuildSource('YAML ')).toBe('vanilla');
  });

  it('CA3: el enlace a una build del otro origen cambia el origen', () => {
    const builds = [vanilla, yaml];
    expect(sourceForHighlighted(builds, 'y', 'vanilla')).toBe('yaml');
    expect(sourceForHighlighted(builds, 'v', 'yaml')).toBe('vanilla');
    expect(sourceForHighlighted(builds, 'v', 'vanilla')).toBe('vanilla');
    expect(sourceForHighlighted(builds, 'otra', 'vanilla')).toBe('vanilla');
    expect(sourceForHighlighted(builds, null, 'yaml')).toBe('yaml');
  });

  it('CA4: quedan solo las builds del origen elegido', () => {
    expect(filterBySource([vanilla, yaml], 'yaml')).toEqual([yaml]);
    expect(filterBySource([vanilla, yaml], 'vanilla')).toEqual([vanilla]);
  });
});
