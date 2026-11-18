// Anclajes mínimos, común al selector de 'Mechs y a la lista de builds guardadas de los dos juegos.
// Los anclajes omni de MW5 sirven de comodín para energía, balística y misiles: un mech con 1E y 2O
// cumple "al menos 3E". Cada omni solo cuenta una vez, aunque se pidan varios tipos. BATTLETECH no
// tiene omni, así que ahí cada tipo se compara con lo suyo.
const OMNI_COMPATIBLE = ['energy', 'ballistic', 'missile'];

export const meetsHardpointMinimums = (
  counts: Partial<Record<string, number>>,
  minimums: Partial<Record<string, number>>
): boolean => {
  let spareOmni = (counts.omni ?? 0) - (minimums.omni ?? 0);
  if (spareOmni < 0) return false;
  for (const [type, minimum] of Object.entries(minimums)) {
    if (type === 'omni') continue;
    const missing = (minimum ?? 0) - (counts[type] ?? 0);
    if (missing <= 0) continue;
    if (!OMNI_COMPATIBLE.includes(type)) return false;
    spareOmni -= missing;
    if (spareOmni < 0) return false;
  }
  return true;
};
