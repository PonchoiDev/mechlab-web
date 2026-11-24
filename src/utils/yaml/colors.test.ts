import { describe, expect, it } from 'vitest';
import { getItemColor, getModLogo, getSlotColor, YAML_COLORS } from './data';

// Los colores y logos del mechlab de YAML con sus ajustes por defecto, sacados de los datos de los mods:
// los de las capturas del juego (armadura roja, estructura azul, balísticas lavanda, «YA ML» en el Endo).
describe('colores del MechLab de YAML', () => {
  it('cada ranura interna tiene el color del juego, también con el tipo en minúsculas', () => {
    expect(getSlotColor('Armorslot')).toBe('#ff0000');
    expect(getSlotColor('Gyro')).toBe('#00ff91');
    expect(getSlotColor('cockpit')).toBe(getSlotColor('Cockpit'));
  });

  it('las armas toman el color de su tipo de ranura y el equipo de las ranuras generales, el general', () => {
    expect(getItemColor('GaussRifle')).toBe('#9781b8');
    expect(YAML_COLORS.hardpoints.ballistic).toBe('#9781b8');
    expect(getItemColor('Gauss_Standard_AmmoEquipment')).toBe(YAML_COLORS.general);
    expect(getItemColor('SENSORS_PROBE')).toBe('#ff6000');
    expect(YAML_COLORS.tintOpacity).toBe(0.2);
  });

  it('las piezas de los mods llevan el logo de su mod y las del juego base, ninguno', () => {
    expect(getModLogo('ENDO')).toMatch(/mods\/yet-another-mechlab\.png$/);
    expect(getModLogo('ROYAL_DHS_KIT')).toMatch(/yet-another-equipment-collection\.png$/);
    expect(getModLogo('GaussRifle')).toBeUndefined();
    // Las piezas estándar fijas, como en el juego, tampoco: Armor Standard, Standard Engine...
    expect(getModLogo('ARMOR_STANDARD_FIXED')).toBeUndefined();
    expect(getModLogo('ENGINE_FIXED')).toBeUndefined();
    expect(getModLogo('ENGINE_XL')).toBeDefined();
  });
});
