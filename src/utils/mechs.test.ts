import { describe, expect, it } from 'vitest';
import { getMechDisplayName, matchesMechQuery } from './mechs';
import { allMechs, getMech } from '../test/fixtures';

describe('getMechDisplayName', () => {
  it('añade el nombre de Sarna cuando es distinto del chasis', () => {
    expect(getMechDisplayName(getMech('ADR-A'))).toBe('PUMA (Adder)');
  });

  it('usa solo el chasis cuando coincide con el nombre de Sarna', () => {
    expect(getMechDisplayName(getMech('AS7-D'))).toBe('Atlas');
  });
});

describe('matchesMechQuery', () => {
  const adder = getMech('ADR-A');

  it('acepta cualquier mech con una búsqueda vacía', () => {
    expect(matchesMechQuery(adder, '')).toBe(true);
    expect(matchesMechQuery(adder, '   ')).toBe(true);
  });

  it('busca por chasis, nombre de Sarna, variante e ID sin distinguir mayúsculas', () => {
    expect(matchesMechQuery(adder, 'puma')).toBe(true);
    expect(matchesMechQuery(adder, 'ADDER')).toBe(true);
    expect(matchesMechQuery(adder, 'adr-a')).toBe(true);
    expect(matchesMechQuery(adder, ' adr ')).toBe(true);
  });

  it('busca también por los alias de Sarna', () => {
    const loaderKing = allMechs.find(mech => mech.sarnaName === 'Loaderking');
    expect(loaderKing).toBeDefined();
    expect(matchesMechQuery(loaderKing!, 'loader king')).toBe(true);
  });

  it('descarta los mechs que no coinciden', () => {
    expect(matchesMechQuery(adder, 'atlas')).toBe(false);
  });
});
