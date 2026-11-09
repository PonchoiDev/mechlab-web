import type { GameDate, MercZone, StarmapData } from '../types/starmap';
import { dateToDays } from './starmap';

export interface MercOwner {
  company: string | null;
  // Tramo que solo ocurre en carrera (HideInCampaign).
  careerOnly: boolean;
  // Acabado el historial, el juego reparte la zona al azar entre las compañías.
  rotating: boolean;
  from: GameDate;
}

// Dueño de una zona en una fecha: el del último tramo que empieza ese día o antes. En las zonas con
// rotación, el último tramo dura sus días con dueño (o vacía) y después la zona rota al azar.
export const getMercOwnerAt = (zone: MercZone, date: GameDate): MercOwner => {
  const index = zone.owners.findLastIndex(owner => owner.from <= date);
  const owner = zone.owners[Math.max(0, index)];
  const isLast = index === zone.owners.length - 1;
  if (isLast && zone.rotation) {
    const lasts = owner.company ? zone.rotation.owned : zone.rotation.empty;
    if (dateToDays(date) >= dateToDays(owner.from) + lasts) {
      return { company: null, careerOnly: false, rotating: true, from: owner.from };
    }
  }
  return { company: owner.company, careerOnly: Boolean(owner.careerOnly), rotating: false, from: owner.from };
};

// Zonas ocupadas en una fecha, con su dueño; las vacías no.
export const getMercZonesAt = (data: StarmapData, date: GameDate): { zone: MercZone; owner: MercOwner }[] =>
  data.mercs.zones
    .map(zone => ({ zone, owner: getMercOwnerAt(zone, date) }))
    .filter(({ owner }) => owner.company || owner.rotating);

export const getCompanyZonesAt = (data: StarmapData, companyId: string, date: GameDate): MercZone[] =>
  getMercZonesAt(data, date).filter(({ owner }) => owner.company === companyId).map(({ zone }) => zone);

// La zona más cercana cuyo círculo contiene el punto.
export const findMercZoneAt = (zones: MercZone[], x: number, y: number): MercZone | null => {
  let found: MercZone | null = null;
  let best = Infinity;
  for (const zone of zones) {
    const distance = Math.hypot(x - zone.center[0], y - zone.center[1]);
    if (distance <= zone.radius && distance < best) {
      best = distance;
      found = zone;
    }
  }
  return found;
};
