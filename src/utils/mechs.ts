import type { Mech } from '../types/mech';
import { getSarnaTitle } from '../services/sarna';

export const getMechDisplayName = (mech: Mech): string => {
  const sarnaTitle = getSarnaTitle(mech);
  return sarnaTitle.toLocaleLowerCase() !== mech.name.toLocaleLowerCase()
    ? `${mech.name} (${sarnaTitle})`
    : mech.name;
};

export const matchesMechQuery = (mech: Mech, query: string): boolean => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return !normalizedQuery || [mech.name, mech.sarnaName ?? mech.name, getSarnaTitle(mech), mech.variant, mech.id]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery));
};
