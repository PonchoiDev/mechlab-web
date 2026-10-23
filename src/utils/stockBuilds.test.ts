import { describe, expect, it } from 'vitest';
import { decodeBuild } from './buildCode';
import { ZONE_KEYS } from './zones';
import { allItems, allMechs } from '../test/fixtures';

const fromBase64Url = (code: string) => JSON.parse(atob(code.replace(/-/g, '+').replace(/_/g, '/')));

describe('builds de fábrica', () => {
  it('todos los mechs tienen la suya', () => {
    expect(allMechs.filter(mech => !mech.stockBuild).map(mech => mech.id)).toEqual([]);
  });

  it('se reconstruyen sin perder ninguna pieza', () => {
    const lost = allMechs.flatMap(mech => {
      const coded = fromBase64Url(mech.stockBuild!)[3] as unknown[][];
      const decoded = decodeBuild(mech.stockBuild!, allMechs, allItems);
      if (!decoded) return [`${mech.id}: no se puede abrir`];
      return ZONE_KEYS.flatMap((zone, index) => coded[index].length === decoded.loadout[zone].length
        ? []
        : [`${mech.id} ${zone}: ${coded[index].length} -> ${decoded.loadout[zone].length}`]);
    });
    expect(lost).toEqual([]);
  });
});
