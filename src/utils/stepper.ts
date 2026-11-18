// Lo que se escribe en un contador de mínimos (anclajes, jump jets). Al enfocarlo se selecciona su número,
// así que lo tecleado lo sustituye; si se teclea sobre él sin seleccionar y pasa del máximo, vale la
// última cifra, que es la que se acaba de pulsar.
export const parseStepperInput = (text: string, max: number): number => {
  const digits = text.replace(/\D/g, '');
  if (digits === '') return 0;
  const value = Number(digits) > max ? Number(digits.slice(-1)) : Number(digits);
  return Math.min(max, value);
};
