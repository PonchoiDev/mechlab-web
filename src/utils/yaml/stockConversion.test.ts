import { describe, expect, it } from 'vitest';
import { createStockBuild } from './build';
import { findYamlMech, yamlMechs } from './data';
import { getBuildTonnage } from './stats';

// Conversión de serie de YAML (ReplaceAllLegacyEquipment y FixVanillaLoadouts), criterios CA19 a CA24 de
// docs/specs/mechlab-yaml.md. La aplica tools/generar_yaml.py al generar las builds de serie.
const internalsOf = (id: string) => findYamlMech(id)!.stock.internal;

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
    const exact = yamlMechs.filter(mech => getBuildTonnage(mech, createStockBuild(mech)) === mech.tonnage);
    expect(yamlMechs).toHaveLength(639);
    expect(exact.length).toBeGreaterThanOrEqual(610);
  });
});
