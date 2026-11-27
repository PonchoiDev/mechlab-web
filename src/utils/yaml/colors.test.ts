import { describe, expect, it } from 'vitest';
import { getItemColor, getModLogo, getSlotColor, getYamlQuirkColor, YAML_COLORS, yamlMechs } from './data';

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

// docs/specs/quirks-colores-yaml.md
describe('colores de los quirks de YAML', () => {
  it('CA1: el color de cada quirk, del lineal del juego a sRGB', () => {
    expect(getYamlQuirkColor('SLDF')).toBe('#ffaa00');
    expect(getYamlQuirkColor('CMD-MECH')).toBe('#00a2ff');
  });

  it('CA2: un color con un paréntesis de más', () => {
    expect(getYamlQuirkColor('BATTLECOMP')).toBe(getYamlQuirkColor('CMD-MECH'));
  });

  it('CA3: dos quirks con el mismo nombre, cada uno con su color', () => {
    expect(getYamlQuirkColor('DIFFICULTTOMAINTAIN')).toBe('#ff00aa');
    expect(getYamlQuirkColor('NSR-DIFFICULTTOMAINTAIN')).toBe('#ffbc00');
  });

  it('CA4: sin color, el general del mechlab', () => {
    expect(getYamlQuirkColor('EXTENDED-TORSO-TWIST')).toBe(YAML_COLORS.general);
  });

  it('CA5: todos los quirks de las variantes tienen color', () => {
    for (const id of new Set(yamlMechs.flatMap(mech => mech.quirks))) expect(getYamlQuirkColor(id), id).toMatch(/^#[0-9a-f]{6}$/);
  });
});
