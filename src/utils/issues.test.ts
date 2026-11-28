import { describe, expect, it } from 'vitest';
import { getBuildIssues } from './issues';
import { createDefaultArmor } from './calculators';
import { createEquippedItem } from './equipment';
import { createEmptyArmor, createEmptyLoadout } from './zones';
import { getItem, getMech } from '../test/fixtures';

const mech = getMech('ASN-21');

describe('getBuildIssues', () => {
  it('avisa de anclajes libres por componente, con el primero libre para abrirlo', () => {
    const issues = getBuildIssues(mech, createEmptyLoadout(), createDefaultArmor(mech.components));
    const leftArm = issues.find(issue => issue.id === 'hardpoints-leftArm');

    expect(leftArm).toMatchObject({ severity: 'warning', zone: 'leftArm', hardpointIndex: 0 });
  });

  it('no avisa de armadura si está al máximo', () => {
    const issues = getBuildIssues(mech, createEmptyLoadout(), createDefaultArmor(mech.components));

    expect(issues.some(issue => issue.id === 'armor')).toBe(false);
  });

  it('agrupa la armadura incompleta en un único aviso', () => {
    const issues = getBuildIssues(mech, createEmptyLoadout(), createEmptyArmor());

    expect(issues.filter(issue => issue.id === 'armor')).toEqual([
      expect.objectContaining({ message: 'Armor below max in 8 components', zone: 'head' })
    ]);
  });

  it('avisa de armas sin munición y de munición sin uso', () => {
    const loadout = {
      ...createEmptyLoadout(),
      rightTorso: [createEquippedItem(getItem('LRM_AmmoEquipment'), 'General_SlotType')],
      leftTorso: [createEquippedItem(getItem('SRM4'), undefined, 0)]
    };
    const messages = getBuildIssues(mech, loadout, createDefaultArmor(mech.components)).map(issue => issue.message);

    expect(messages).toContain(`${getItem('SRM4').name} has no ammo`);
    expect(messages).toContain('LRM Ammo is not used by any weapon');
  });

  it('marca como error el exceso de tonelaje y va primero', () => {
    const heavy = createEquippedItem(getItem('Autocannon20'), undefined, 0);
    const loadout = { ...createEmptyLoadout(), centerTorso: Array.from({ length: 3 }, () => heavy) };
    const [first] = getBuildIssues(mech, loadout, createDefaultArmor(mech.components));

    expect(first).toMatchObject({ id: 'overweight', severity: 'error' });
  });

  // El juego trunca el peso a centésimas antes de compararlo con el máximo (GetCurrentTonnage e IsOverMaxTonnage).
  it('no marca sobrepeso si el peso truncado a centésimas es el máximo', () => {
    const huntsman = getMech('HMN-PRIME');
    // 340 puntos de Ferro son 9,4866 t: con 26 t de equipo, 50,0066 t, que el juego muestra como 50,00.
    const withEquipment = { ...huntsman, baseTonnage: huntsman.baseTonnage + 26 };
    const armor = { ...createEmptyArmor(), centerTorso: { front: 340, rear: 0 } };
    const issues = getBuildIssues(withEquipment, createEmptyLoadout(), armor);

    expect(issues.some(issue => issue.id === 'overweight')).toBe(false);
  });

  it('da el sobrepeso con el peso truncado', () => {
    const huntsman = getMech('HMN-PRIME');
    // 341 puntos son 9,5145 t: 50,0345 t, que el juego muestra como 50,03.
    const withEquipment = { ...huntsman, baseTonnage: huntsman.baseTonnage + 26 };
    const armor = { ...createEmptyArmor(), centerTorso: { front: 341, rear: 0 } };
    const [first] = getBuildIssues(withEquipment, createEmptyLoadout(), armor);

    expect(first).toMatchObject({ id: 'overweight', message: 'Over tonnage by 0.03 t' });
  });
});
