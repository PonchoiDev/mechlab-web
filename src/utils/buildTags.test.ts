import { describe, expect, it } from 'vitest';
import { getBuildTags } from './buildTags';
import { getStockBuildById } from './buildCode';
import { allItems, allMechs } from '../test/fixtures';

// CA13 de docs/specs/buscar-builds-guardadas.md, con los 'Mechs de serie.
const tagsOf = (id: string) => {
  const build = getStockBuildById(id, allMechs, allItems)!;
  return getBuildTags(build.mech, Object.values(build.loadout).flat()).map(tag => tag.label);
};

describe('etiquetas de una build de MW5', () => {
  it('CA13: la tecnología del chasis y el equipo especial montado', () => {
    expect(tagsOf('HGN-732')).toEqual(['FERRO', 'JJ 3']);
    expect(tagsOf('AS7-K')).toEqual(['XL']);
    expect(tagsOf('RVN-3L')).toEqual(['XL', 'FERRO', 'ECM', 'AP']);
    expect(tagsOf('ADR-A')).toEqual(['C-XL', 'DHS', 'C-ENDO', 'C-FERRO', 'AP']);
    expect(tagsOf('NTG-C')).toContain('TC');
    expect(tagsOf('CTF-3L')).toContain('MASC');
    expect(tagsOf('BNC-3P')).toContain('SC');
  });
});
