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
});
