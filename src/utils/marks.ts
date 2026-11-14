// Qué sistemas marca el mapa con el aro, las esquinas de mira y el nombre, y de qué tipo es cada
// marca: el renderer pinta cada tipo en el color de su panel.
export type MarkKind = 'system' | 'academy' | 'quest' | 'campaign' | 'mech';

export interface MapMark {
  system: number;
  kind: MarkKind;
}

export interface MarkSources {
  // Sistema buscado o pulsado (no el que está bajo el ratón).
  selectedId: number | null;
  academySystem: number | null;
  // Donde se ofrece la HRQ elegida y donde empieza la campaña elegida.
  questOffer: number | null;
  campaignStart: number | null;
  // Donde se consigue la variante de Find a 'Mech: su misión o la oferta de su HRQ.
  mechSystem: number | null;
}

// En este orden: si dos caen en el mismo sistema, la primera manda y el sistema elegido va siempre
// por delante.
export const getMapMarks = ({ selectedId, academySystem, questOffer, campaignStart, mechSystem }: MarkSources): MapMark[] => {
  const candidates: [number | null, MarkKind][] = [
    [selectedId, 'system'],
    [academySystem, 'academy'],
    [questOffer, 'quest'],
    [campaignStart, 'campaign'],
    [mechSystem, 'mech']
  ];
  const marks: MapMark[] = [];
  for (const [system, kind] of candidates) {
    if (system !== null && !marks.some(mark => mark.system === system)) marks.push({ system, kind });
  }
  return marks;
};
