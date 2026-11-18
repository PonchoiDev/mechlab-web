import { describe, expect, it } from 'vitest';
import { parseStepperInput } from './stepper';

// Los contadores de mínimos (anclajes, jump jets) se escriben también a mano.
describe('número escrito en un contador de mínimos', () => {
  it('lee el número escrito', () => {
    expect(parseStepperInput('3', 9)).toBe(3);
    expect(parseStepperInput('12', 12)).toBe(12);
  });

  it('sin número, cero; lo que no son cifras no cuenta', () => {
    expect(parseStepperInput('', 9)).toBe(0);
    expect(parseStepperInput('a', 9)).toBe(0);
    expect(parseStepperInput('2b', 9)).toBe(2);
  });

  it('si pasa del máximo vale la última cifra tecleada, como al escribir sobre un número', () => {
    expect(parseStepperInput('35', 9)).toBe(5);
    expect(parseStepperInput('19', 12)).toBe(9);
  });

  it('nunca pasa del máximo', () => {
    expect(parseStepperInput('9', 6)).toBe(6);
  });
});
