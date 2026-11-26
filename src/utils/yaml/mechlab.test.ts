import { describe, expect, it } from 'vitest';
import mw5Mechs from '../../data/mechs.json';
import yamlMechs from '../../data/yaml/mechs.json';
import { checkInternal, createStockBuild, mountItem, mountWeapon, removeWeapon, setInternal, stripBuild } from './build';
import { decodeYamlBuild, encodeYamlBuild } from './buildCode';
import { getYamlStatsPanel } from './combat';
import { findYamlMech, getYamlItem } from './data';
import { getBuildTonnage, getFreeGeneralSlots } from './stats';

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
    // Las 639 del MechLab de MW5 están, con su id; las demás son las variantes nuevas de YAML (CA40).
    const yamlIds = new Set(yamlMechs.map(mech => mech.id));
    expect([...mw5Ids].filter(id => !yamlIds.has(id))).toEqual([]);
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

  it('CA40: las variantes nuevas de YAML, sin rellenos técnicos', () => {
    const annihilator = findYamlMech('ANH-1G')!;
    expect(annihilator).toMatchObject({ chassis: 'Annihilator', variant: 'ANH-1G', tonnage: 100 });
    expect(annihilator.stock.weapons.length).toBeGreaterThan(0);
    for (const id of ['Partial Mech Salvage', 'None']) expect(findYamlMech(id), id).toBeUndefined();
    expect(yamlMechs.filter(mech => mech.id === 'AS7-D-H')).toHaveLength(1);
    expect(new Set(yamlMechs.map(mech => mech.id)).size).toBe(yamlMechs.length);
  });

  it('CA41: el ANH-1P sale con el loadout de reemplazo de Yet Another Weapon, como en la captura', () => {
    const annihilator = findYamlMech('ANH-1P')!;
    const build = createStockBuild(annihilator);
    expect(getBuildTonnage(annihilator, build)).toBe(100);
    const panel = Object.fromEntries(getYamlStatsPanel(annihilator, build).flat().map(cell => [cell.key, cell.value]));
    expect(panel).toMatchObject({
      armor: '400', structure: '313', alphaDamage: '35.2', dps: '41.75', heatPerSecond: '13.13', alphaHeat: '18.12',
      speed: '48.6', weaponRange: '1,080', ammo: '2,670'
    });
  });

  it('CA44: el nombre de YAML de cada variante, con sus quirks, y las nuevas que se llaman como una del juego', () => {
    expect(findYamlMech('AS7-D-H')).toMatchObject({ variant: 'AS7-D-H(S)' });
    expect(findYamlMech('AS7-D-H')!.quirks).toEqual(expect.arrayContaining(['AS7-D-HS', 'AS7-II-HERO']));
    expect(findYamlMech('CPLT-C3')).toMatchObject({ variant: 'CPLT-C3CS' });
    expect(findYamlMech('CPLT-C3')!.quirks).toContain('CLANBUSTER');
    expect(findYamlMech('BSK-1')).toMatchObject({ variant: 'BSK-M1' });
    for (const [id, chassis, variant] of [['AS7-D-H_YAML', 'Atlas II', 'AS7-D-H'], ['CPLT-C3L', 'Catapult', 'CPLT-C3']]) {
      const mech = findYamlMech(id)!;
      expect(mech, id).toMatchObject({ chassis, variant });
      expect(mech.stock.weapons.length, id).toBeGreaterThan(0);
    }
  });

  it('CA45: la cabina que el loadout trae en «Cockpit» va en la ranura de cabina, como en la captura del CN9-CALM', () => {
    const centurion = findYamlMech('CN9-CALM')!;
    const stock = createStockBuild(centurion);
    expect(stock.internal.cockpit).toBe('COCKPIT_SMALL');
    expect(stock.items.filter(mounted => mounted.zone === 'head')).toEqual([]);
    expect(getFreeGeneralSlots(centurion, stock, 'head')).toBe(2);
  });
});

// docs/specs/equipo-unico.md
describe('equipo que no se puede repetir en el MechLab de YAML', () => {
  const empty = stripBuild(stock);

  it('CA7: el Triple Strength Myomer no se monta con un MASC MK I (C)', () => {
    const withMasc = mountItem(nightstar, empty, 'leftTorso', 'C79_MASC_MKI').build!;
    expect(mountItem(nightstar, withMasc, 'rightTorso', 'TSMYOMER').error).toBe("Triple Strength Myomer can't be mounted with MASC MK I (C)");
    expect(mountItem(nightstar, empty, 'rightTorso', 'TSMYOMER').build).toBeDefined();
  });

  it('CA8: el Targeting Computer Mk. 3 (C) no se monta con el Mk. 1 de YAML', () => {
    const withComputer = mountItem(nightstar, empty, 'leftTorso', 'TCLVL1').build!;
    expect(mountItem(nightstar, withComputer, 'rightTorso', 'TargetingComputer_Mk3').error).toBe("Only one Targeting Computer per 'Mech");
  });
});
