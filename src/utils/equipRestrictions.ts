// Restricciones de montaje del juego (EquipRestrictions de cada objeto, docs/specs/equipo-unico.md).
// KelLoadoutRestrictionFunction_UniqueEquipment (0x140f676e0 del ejecutable) busca su etiqueta en el recuento
// de etiquetas de lo montado y falla si ya hay MaxEquipment piezas. El recuento suma la etiqueta de cada pieza
// con sus padres: un Targeting Computer Mk3 (Equipment.TargetingComputer.Mk3) cuenta para Equipment.TargetingComputer.

export interface EquipRestriction {
  tag: string;
  max: number;
}

export interface RestrictedItem {
  name: string;
  restrictions?: EquipRestriction[];
}

export interface MountedTag {
  name: string;
  tag?: string;
}

const matchesTag = (tag: string | undefined, parent: string): boolean =>
  !!tag && (tag === parent || tag.startsWith(`${parent}.`));

// La primera pieza montada que impide montar el objeto, o null si se puede.
export const getRestrictionConflict = <T extends MountedTag>(item: RestrictedItem, mounted: T[]): T | null => {
  for (const restriction of item.restrictions ?? []) {
    const matching = mounted.filter(piece => matchesTag(piece.tag, restriction.tag));
    if (matching.length >= restriction.max) return matching[0];
  }
  return null;
};

// Nombre de cada tipo de equipo único, para el aviso.
const UNIQUE_LABELS: Record<string, string> = {
  'Equipment.TargetingComputer': 'Targeting Computer',
  'Equipment.AP': 'active probe',
  'Equipment.BAP': 'active probe',
  'Equipment.ECM': 'ECM'
};

// El aviso: «Only one Targeting Computer per 'Mech» si los dos son del mismo tipo y, si no (el TSM y el MASC),
// los nombres de los dos.
export const describeRestrictionConflict = (item: RestrictedItem & { tag?: string }, conflict: MountedTag): string => {
  const shared = (item.restrictions ?? []).find(restriction =>
    matchesTag(item.tag, restriction.tag) && matchesTag(conflict.tag, restriction.tag) && UNIQUE_LABELS[restriction.tag]);
  return shared ? `Only one ${UNIQUE_LABELS[shared.tag]} per 'Mech` : `${item.name} can't be mounted with ${conflict.name}`;
};
