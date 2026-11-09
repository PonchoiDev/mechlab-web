import { describe, expect, it } from 'vitest';
import starmapJson from '../data/starmap.json';
import type { StarmapData } from '../types/starmap';
import { findMercZoneAt, getCompanyZonesAt, getMercOwnerAt } from './mercs';

// Criterios de aceptación de docs/specs/mercenarios-rivales.md (issue #83).
const data = starmapJson as unknown as StarmapData;
const zone = (id: string) => {
  const found = data.mercs.zones.find(candidate => candidate.id === id);
  if (!found) throw new Error(`${id} no está en starmap.json`);
  return found;
};

describe('mercenarios rivales', () => {
  it('CA1: hay 18 compañías con logo, y los Wolf\'s Dragoons son una sola', () => {
    const companies = data.mercs.companies;
    expect(Object.keys(companies)).toHaveLength(18);
    expect(Object.values(companies).every(company => company.logo)).toBe(true);
    expect(companies.GrayDeathLegion).toEqual(expect.objectContaining({ name: 'The Gray Death Legion', skill: 'Regular' }));
    expect(Object.keys(companies).filter(id => id.startsWith('WolfsDragoons'))).toEqual(['WolfsDragoons']);
  });

  it('CA2: el dueño de una zona cambia con la fecha', () => {
    const border = zone('BorderDAVIONBaseKurita12to13');
    const names = border.systems.map(id => data.systems.find(system => system.id === id)?.name);
    expect(names).toEqual(['Kentares', 'Raman', 'Johnsondale']);
    expect(getMercOwnerAt(border, '3017-01-01')).toEqual(expect.objectContaining({ company: 'Blackhearts' }));
    expect(getMercOwnerAt(border, '3019-01-01')).toEqual(expect.objectContaining({ company: null, rotating: false }));
    expect(getMercOwnerAt(border, '3021-01-01')).toEqual(expect.objectContaining({ company: 'TheBadDream' }));
  });

  it('CA3: un tramo puede ser solo de carrera', () => {
    expect(getMercOwnerAt(zone('BorderKURITABaseSteiner13to14'), '3019-06-01')).toEqual(
      expect.objectContaining({ company: 'BrionsLegion', careerOnly: true })
    );
  });

  it('CA4: al acabar el historial, la zona rota al azar', () => {
    const border = zone('BorderDAVIONBaseKurita12to13');
    expect(getMercOwnerAt(border, '3050-06-01')).toEqual(expect.objectContaining({ company: 'WacoRangers', rotating: false }));
    expect(getMercOwnerAt(border, '3052-01-01')).toEqual(expect.objectContaining({ company: null, rotating: true }));
  });

  it('CA5: se sabe qué zona hay bajo un punto', () => {
    const border = zone('BorderDAVIONBaseKurita12to13');
    expect(findMercZoneAt(data.mercs.zones, border.center[0], border.center[1])?.id).toBe(border.id);
    expect(findMercZoneAt(data.mercs.zones, 2000, 2000)).toBeNull();
  });

  it('CA6: se saben las zonas de una compañía en una fecha', () => {
    expect(getCompanyZonesAt(data, 'Blackhearts', '3017-01-01').map(found => found.id)).toContain('BorderDAVIONBaseKurita12to13');
  });

  it('CA7: las 76 zonas tienen sus sistemas en el mapa y dueños conocidos', () => {
    const systems = new Set(data.systems.map(system => system.id));
    expect(data.mercs.zones).toHaveLength(76);
    expect(data.mercs.zones.every(found => found.systems.every(id => systems.has(id)))).toBe(true);
    const owners = data.mercs.zones.flatMap(found => found.owners.map(owner => owner.company)).filter(company => company !== null);
    expect(owners.filter(company => !data.mercs.companies[company])).toEqual([]);
  });
});
