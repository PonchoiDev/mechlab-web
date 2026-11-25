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

// Tamaños de los anclajes sacados del modelo (HPS), comprobados en el juego.
describe('tamaño de los anclajes', () => {
  const sizes = (id: string, zone: keyof NonNullable<(typeof allMechs)[number]>['components']) =>
    allMechs.find(mech => mech.id === id)!.components[zone].hardpoints.map(hardpoint => `${hardpoint.type} ${hardpoint.size}`);

  it('NSR-WP: cuatro anclajes grandes de misiles en los torsos', () => {
    expect(sizes('NSR-WP', 'leftTorso')).toEqual(['missile large', 'missile large']);
    expect(sizes('NSR-WP', 'rightTorso')).toEqual(['missile large', 'missile large']);
    expect(sizes('NSR-WP', 'rightArm')).toEqual(['energy large', 'energy medium', 'melee medium']);
  });

  it('KFX-S: omni mediano aunque su build de fábrica traiga ahí un láser grande', () => {
    expect(sizes('KFX-S', 'rightArm')).toEqual(['omni medium', 'energy large', 'melee medium']);
    expect(sizes('KFX-S', 'leftArm')).toEqual(['energy medium', 'missile medium', 'melee medium']);
    expect(sizes('KFX-S', 'leftTorso')).toEqual(['ballistic small']);
    expect(sizes('KFX-S', 'rightTorso')).toEqual(['ballistic medium']);
  });
});

// La ubicación de cada anclaje sale del HPS del modelo (MechPart), no de su nombre: los «Clavicle» van en el brazo.
describe('ubicación de los anclajes', () => {
  const types = (id: string, zone: keyof NonNullable<(typeof allMechs)[number]>['components']) =>
    allMechs.find(mech => mech.id === id)!.components[zone].hardpoints.map(hardpoint => hardpoint.type);

  it('CRD-5M: el Flamer de Clavicle_Right está en el brazo derecho', () => {
    expect(types('CRD-5M', 'rightArm')).toEqual(['energy', 'energy', 'missile', 'ballistic', 'melee']);
    expect(types('CRD-5M', 'rightTorso')).toEqual(['missile']);
    const stock = decodeBuild(allMechs.find(mech => mech.id === 'CRD-5M')!.stockBuild!, allMechs, allItems)!;
    expect(stock.loadout.rightArm.map(item => item.id)).toContain('Flamer');
  });

  it('AS7-K: el AMS de Clavicle_Left está en el brazo izquierdo', () => {
    expect(types('AS7-K', 'leftArm')).toEqual(['energy', 'ams', 'melee']);
  });
});
