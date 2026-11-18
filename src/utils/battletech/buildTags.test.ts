import { describe, expect, it } from 'vitest';
import { getBtBuildTags } from './buildTags';
import { createStockBuild, getAllItems } from './fitting';
import { findMech } from './mechlabData';

// CA14 de docs/specs/buscar-builds-guardadas.md, con los 'Mechs de serie.
const tagsOf = (variant: string) => {
  const mech = findMech(variant)!;
  return getBtBuildTags(getAllItems(mech, createStockBuild(mech).loadout)).map(tag => tag.label);
};

describe('etiquetas de una build de BATTLETECH', () => {
  it('CA14: los jump jets con su número y las mejoras por su nombre', () => {
    expect(tagsOf('ASN-21')).toEqual(['JJ 7', 'Intercept System']);
    expect(tagsOf('FLE-15')).toEqual(['Targeting Baffle ×2']);
    expect(tagsOf('CP-10-HQ')).toEqual(['Battle Computer', 'Adv. Command Mod']);
    expect(tagsOf('HBK-4G')).toEqual([]);
  });
});
