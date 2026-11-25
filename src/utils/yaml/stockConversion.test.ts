import { describe, expect, it } from 'vitest';
import mw5Mechs from '../../data/mechs.json';
import { createStockBuild } from './build';
import { findYamlMech, yamlMechs } from './data';
import { getYamlStatsPanel } from './combat';
import { getBuildTonnage } from './stats';

// Conversión de serie de YAML (ReplaceAllLegacyEquipment y FixVanillaLoadouts), criterios CA19 a CA24 de
// docs/specs/mechlab-yaml.md. La aplica tools/generar_yaml.py al generar las builds de serie.
const internalsOf = (id: string) => findYamlMech(id)!.stock.internal;
const stockPanel = (id: string) => {
  const mech = findYamlMech(id)!;
  const build = createStockBuild(mech);
  const cells = Object.fromEntries(getYamlStatsPanel(mech, build).flat().map(cell => [cell.key, cell.value]));
  return { tonnage: getBuildTonnage(mech, build), ...cells };
};

describe('Conversión de serie de YAML', () => {
  it('CA19: un omnimech de la Esfera Interior lleva las piezas fijas de la Esfera Interior', () => {
    expect(internalsOf('SD1-O')).toEqual({
      Engine: 'std360_FIXED', EngineTypeSlot: 'ENGINE_XL_FIXED', Gyro: 'OMNI_GYRO_FIXED',
      Armorslot: 'ARMOR_STANDARD_FIXED', Structureslot: 'STRUCTURE_STANDARD_FIXED', enginecooling: 'Cooling_diss100_FIXED'
    });
  });

  it('CA20: un omnimech Clan lleva las piezas fijas Clan y pesa su tonelaje', () => {
    expect(internalsOf('EBJ-PRIME')).toEqual({
      Engine: 'std325_FIXED', EngineTypeSlot: 'ENGINE_XL_CLAN_FIXED', Gyro: 'CLAN_OMNI_GYRO_FIXED',
      Armorslot: 'CFERRO_FIXED', Structureslot: 'C79ENDO_FIXED', enginecooling: 'CLAN_DHS_KIT_FIXED'
    });
    const mech = findYamlMech('EBJ-PRIME')!;
    expect(getBuildTonnage(mech, createStockBuild(mech))).toBe(65);
  });

  it('CA21: un Clan que no es omni lleva las piezas Clan sin fijar y sin giroscopio', () => {
    expect(internalsOf('INC-1')).toEqual({
      Engine: 'std270', EngineTypeSlot: 'ENGINE_XL_CLAN', Armorslot: 'CFERRO', Structureslot: 'C79ENDO',
      enginecooling: 'CLAN_DHS_KIT'
    });
  });

  it('CA22: un mech de la Esfera Interior con motor estándar solo lleva el núcleo', () => {
    expect(internalsOf('GHR-5J')).toEqual({ Engine: 'std280' });
  });

  it('CA23: una pieza antigua con sufijo de calidad pasa a la pieza sin sufijo', () => {
    expect(internalsOf('ARC-T').Structureslot).toBe('ENDO');
  });

  it('CA24: al menos 610 de las 639 builds de serie pesan su tonelaje', () => {
    // Las del MechLab de MW5; las variantes nuevas de YAML van aparte (CA40).
    const mw5Ids = new Set(mw5Mechs.map(mech => mech.id));
    const variants = yamlMechs.filter(mech => mw5Ids.has(mech.id));
    const exact = variants.filter(mech => getBuildTonnage(mech, createStockBuild(mech)) === mech.tonnage);
    expect(variants).toHaveLength(639);
    expect(exact.length).toBeGreaterThanOrEqual(610);
  });

  // Capturas del mechlab del juego con YAML de las builds de serie.
  it('CA25: el KFX-C de serie da las cifras del juego', () => {
    expect(stockPanel('KFX-C')).toEqual({
      tonnage: 30, armor: '192', structure: '111', meleeDamage: '0', alphaDamage: '26.9', dps: '11.26', meleeDps: '0',
      heatPerSecond: '1.85', cooling: '2', turnRate: '110', alphaHeat: '8.19', heatCapacity: '50', torsoTwistRate: '100',
      jumpHeight: '0', speed: '103.71', torsoYaw: '130', weaponRange: '2,025', sensorRange: '1,000', armYaw: '30',
      amsIntercept: '18.38', amsRange: '300', ammo: '25,200'
    });
  });

  it('CA25: el INC-A de serie da las cifras del juego, 0,03 t por debajo de su tonelaje', () => {
    expect(stockPanel('INC-A')).toEqual({
      tonnage: 29.97, armor: '210', structure: '111', meleeDamage: '0', alphaDamage: '61.1', dps: '20.48', meleeDps: '0',
      heatPerSecond: '4.34', cooling: '2', turnRate: '110', alphaHeat: '12.94', heatCapacity: '50', torsoTwistRate: '180',
      jumpHeight: '0', speed: '155.57', torsoYaw: '130', weaponRange: '900', sensorRange: '800', armYaw: '30',
      amsIntercept: '0', amsRange: '0', ammo: '0'
    });
  });

  it('CA25: el WHM-DNC de serie, con motor XL, pesa 61,99 de 70 t', () => {
    expect(stockPanel('WHM-DNC')).toMatchObject({
      tonnage: 61.99, alphaDamage: '58', dps: '32.19', heatPerSecond: '7.54', cooling: '2.6', turnRate: '75.8',
      alphaHeat: '13.6', heatCapacity: '56', torsoTwistRate: '94.8', torsoYaw: '121', weaponRange: '900',
      sensorRange: '900', armYaw: '25', ammo: '80'
    });
  });

  it('los anclajes van en la ubicación del HPS del modelo: el Flamer del CRD-5M en el brazo derecho', () => {
    const crusader = findYamlMech('CRD-5M')!;
    expect(crusader.stock.weapons.find(weapon => weapon.item === 'Flamer')?.zone).toBe('rightArm');
    expect(crusader.zones.rightArm.hardpoints.map(hardpoint => hardpoint.id)).toContain('Clavicle_Right_EH5_flamer');
    expect(findYamlMech('AS7-D')!.zones.leftArm.hardpoints.map(hardpoint => hardpoint.type)).toContain('ams');
  });
});
