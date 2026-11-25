import { describe, expect, it } from 'vitest';
import mw5Mechs from '../../data/mechs.json';
import yamlMechs from '../../data/yaml/mechs.json';
import { checkInternal, createStockBuild, mountWeapon, removeWeapon, setInternal, stripBuild } from './build';
import { decodeYamlBuild, encodeYamlBuild } from './buildCode';
import { findYamlMech, getYamlItem } from './data';
import { getFreeGeneralSlots } from './stats';

// Reglas del MechLab de YAML que no salen de una captura concreta: criterios CA15 a CA18 de
// docs/specs/mechlab-yaml.md.
const nightstar = findYamlMech('NSR-9J')!;
const stock = createStockBuild(nightstar);

describe('MechLab de YAML', () => {
  it('CA15: el Endo no cabe sin 14 ranuras generales libres y el motivo dice cuántas faltan', () => {
    const reason = checkInternal(nightstar, stock, 'Structureslot', 'ENDO');
    expect(reason).toMatch(/14/);
    expect(checkInternal(nightstar, stripBuild(stock), 'Structureslot', 'ENDO')).toBeNull();
    expect(checkInternal(nightstar, setInternal(stripBuild(stock), 'Structureslot', 'ENDO'), 'Armorslot', 'HEAVY_FERRO'))
      .toBeNull();
  });

  it('CA16: un arma necesita un anclaje libre de su tipo y sus ranuras libres en la misma ubicación', () => {
    const empty = stripBuild(stock);
    // Los brazos tienen anclaje balístico y 8 ranuras generales: el AC/20 (10) ocupa las 8 y 2 del torso derecho.
    expect(getFreeGeneralSlots(nightstar, empty, 'rightArm')).toBe(8);
    const ac20 = mountWeapon(nightstar, empty, 'rightArm', 'Autocannon20').build!;
    expect(getFreeGeneralSlots(nightstar, ac20, 'rightArm')).toBe(0);
    expect(getFreeGeneralSlots(nightstar, ac20, 'rightTorso')).toBe(7);
    // Los torsos laterales tienen 9 ranuras libres (12 menos 3 del motor XL), pero ningún anclaje balístico.
    expect(getFreeGeneralSlots(nightstar, empty, 'leftTorso')).toBe(9);
    expect(mountWeapon(nightstar, empty, 'leftTorso', 'Autocannon10').error).toBeDefined();
    expect(mountWeapon(nightstar, empty, 'rightArm', 'GaussRifle').build).toBeDefined();
    // Con la Gauss de serie ocupando el anclaje balístico del brazo, no cabe otra arma balística.
    expect(mountWeapon(nightstar, stock, 'rightArm', 'Autocannon2').error).toBeDefined();
    const gauss = stock.weapons.find(weapon => weapon.zone === 'rightArm' && weapon.item === 'GaussRifle')!;
    expect(mountWeapon(nightstar, removeWeapon(stock, gauss.hardpoint), 'rightArm', 'Autocannon2').build).toBeDefined();
  });

  it('CA17: las variantes son las del MechLab de MW5, con su id, y las reglas de YAML están aplicadas', () => {
    const mw5Ids = new Set(mw5Mechs.map(mech => mech.id));
    expect(yamlMechs.length).toBe(639);
    expect(yamlMechs.every(mech => mw5Ids.has(mech.id))).toBe(true);
    expect(yamlMechs.some(mech => /tutorial|boss/i.test(mech.id))).toBe(false);
    // YAML cambia al arrancar el tamaño de los tipos de ranura del juego: el AC/10 pasa de 4 a 7.
    expect(getYamlItem('Autocannon10')!.slots).toBe(7);
  });

  it('CA18: una build se codifica y se decodifica igual, y un código del MechLab de MW5 no se abre', () => {
    const changed = setInternal(stock, 'Structureslot', 'RSTRUCT');
    const code = encodeYamlBuild(nightstar.id, changed);
    expect(decodeYamlBuild(code)).toEqual({ mechId: nightstar.id, build: changed });
    expect(decodeYamlBuild('garbage')).toBeNull();
    const mw5Code = mw5Mechs.find(mech => mech.id === 'NSR-9J')!.stockBuild!;
    expect(decodeYamlBuild(mw5Code)).toBeNull();
  });
});
