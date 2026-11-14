import { describe, expect, it } from 'vitest';
import { getMapMarks } from './marks';

// Criterios de aceptación de docs/specs/marcas-seleccion.md.
const NONE = { selectedId: null, academySystem: null, questOffer: null, campaignStart: null, mechSystem: null };

describe('marcas de lo elegido en el mapa', () => {
  it('CA1: sin nada elegido no hay marcas', () => {
    expect(getMapMarks(NONE)).toEqual([]);
  });

  it('CA2: el sistema elegido y la oferta de la HRQ, en ese orden', () => {
    expect(getMapMarks({ ...NONE, selectedId: 10, questOffer: 20 })).toEqual([
      { system: 10, kind: 'system' },
      { system: 20, kind: 'quest' }
    ]);
  });

  it('CA3: si caen en el mismo sistema, se marca una vez con el color del sistema elegido', () => {
    expect(getMapMarks({ ...NONE, selectedId: 10, questOffer: 10 })).toEqual([{ system: 10, kind: 'system' }]);
  });

  it('CA4: academia, campaña y variante, cada una con su tipo', () => {
    expect(getMapMarks({ ...NONE, academySystem: 1, campaignStart: 2, mechSystem: 3 })).toEqual([
      { system: 1, kind: 'academy' },
      { system: 2, kind: 'campaign' },
      { system: 3, kind: 'mech' }
    ]);
  });
});
