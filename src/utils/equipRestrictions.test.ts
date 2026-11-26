import { describe, expect, it } from 'vitest';
import { getRestrictionConflict } from './equipRestrictions';
import { getItem } from '../test/fixtures';

// docs/specs/equipo-unico.md
describe('restricciones de montaje del juego', () => {
  it('CA1: los computadores de puntería llevan su etiqueta y la restricción de uno por \'Mech', () => {
    expect(getItem('TargetingComputer_Mk1')).toEqual(expect.objectContaining({
      equipmentTag: 'Equipment.TargetingComputer.Mk1',
      restrictions: [{ tag: 'Equipment.TargetingComputer', max: 1 }]
    }));
    expect(getItem('TargetingComputer_Mk7').equipmentTag).toBe('Equipment.TargetingComputer.Mk7');
  });

  it('una etiqueta cuenta para sus padres, no para sus hermanas ni por prefijo de texto', () => {
    const restrictions = [{ tag: 'Equipment.TargetingComputer', max: 1 }];
    const item = { name: 'Nuevo', restrictions };
    expect(getRestrictionConflict(item, [{ name: 'Mk3', tag: 'Equipment.TargetingComputer.Mk3' }])?.name).toBe('Mk3');
    expect(getRestrictionConflict(item, [{ name: 'Igual', tag: 'Equipment.TargetingComputer' }])?.name).toBe('Igual');
    expect(getRestrictionConflict(item, [{ name: 'Otro', tag: 'Equipment.TargetingComputerX' }])).toBeNull();
    expect(getRestrictionConflict(item, [{ name: 'Sonda', tag: 'Equipment.BAP' }])).toBeNull();
    expect(getRestrictionConflict({ name: 'Sin', restrictions: undefined }, [{ name: 'Mk3', tag: 'Equipment.TargetingComputer.Mk3' }])).toBeNull();
  });

  it('el máximo cuenta las piezas montadas con esa etiqueta', () => {
    const item = { name: 'Nuevo', restrictions: [{ tag: 'Equipment.ECM', max: 2 }] };
    const ecm = { name: 'ECM', tag: 'Equipment.ECM.Guardian' };
    expect(getRestrictionConflict(item, [ecm])).toBeNull();
    expect(getRestrictionConflict(item, [ecm, ecm])?.name).toBe('ECM');
  });
});
