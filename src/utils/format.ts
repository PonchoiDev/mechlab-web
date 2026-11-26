// Lo que se enseña en una celda sin dato. Es un guion corto: la interfaz no usa guiones largos.
export const EMPTY_VALUE = '-';

// En lugar del tiempo hasta el calor máximo cuando la refrigeración iguala o supera al calor disparando:
// el 'Mech no llega nunca al máximo.
export const COOLING_KEEPS_UP = 'Cooling keeps up';

// Nombres repetidos agrupados, en el orden en que aparecen: «M Laser ×4, LRM15 ×2».
export const joinWithCounts = (names: string[]): string => {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(', ');
};


// Sin mayúsculas ni acentos, para buscar en listas («ármor» encuentra «Armor»).
const foldText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Las opciones de un desplegable cuyo nombre contiene lo escrito; sin texto, todas.
export const filterOptionsByText = <T extends { label: string }>(options: T[], query: string): T[] => {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  return words.length === 0 ? options : options.filter(option => words.every(word => foldText(option.label).includes(word)));
};
