import { describe, expect, it } from 'vitest';
import availabilityJson from '../data/availability.json';
import mechsJson from '../data/mechs.json';
import starmapJson from '../data/starmap.json';
import type { AvailabilityData, StarmapData } from '../types/starmap';
import {
  countSources,
  describeRewardSource,
  getAvailabilityAt,
  getFactionTable,
  getFixedSources,
  getLaterVariants,
  getMarketRarity,
  getMechFocus,
  getOnePlaceMechs,
  isProduced,
  parseMechQuery,
  searchMechs
} from './availability';
import { toMapQuery } from './starmap';
import { getQuestRoute } from './quests';

// Criterios de aceptación de docs/specs/buscar-mech.md (issue #76).
const data = starmapJson as unknown as StarmapData;
const availability = availabilityJson as unknown as AvailabilityData;
const mech = (id: string) => {
  const found = availability.mechs.find(candidate => candidate.id === id);
  if (!found) throw new Error(`${id} no está en availability.json`);
  return found;
};
const groupOf = (groups: ReturnType<typeof getAvailabilityAt>, faction: string) =>
  groups.find(group => group.factions.some(entry => entry.id === faction))?.rarity;

describe('rareza de cada variante por facción', () => {
  it('CA1: el AS7-D existe desde 2755 y es común en Steiner, poco común en Kurita y muy raro en Liao', () => {
    const atlas = mech('AS7-D');
    expect(atlas.from).toBe('2755-01-01');
    expect(getMarketRarity(availability, atlas, 'Steiner')).toBe('common');
    expect(getMarketRarity(availability, atlas, 'Kurita')).toBe('uncommon');
    expect(getMarketRarity(availability, atlas, 'Liao')).toBe('veryRare');
  });

  it('CA2: las facciones menores usan la tabla de su alianza', () => {
    expect(getFactionTable(availability, 'MagistracyOfCanopus')).toBe('Periphery');
    expect(getFactionTable(availability, 'ElysianFields')).toBe('Outlaws');
    expect(getFactionTable(availability, 'LyranAlliance')).toBe('LyranAlliance');
    expect(getFactionTable(availability, 'ArcRoyalDefenseCordon')).toBeNull();
    expect(getMarketRarity(availability, mech('AS7-D'), 'MagistracyOfCanopus')).toBe('veryRare');
  });

  it('CA3: en 3025 las facciones del mapa se agrupan por rareza, con su número de sistemas', () => {
    const groups = getAvailabilityAt(data, availability, mech('AS7-D'), '3025-06-01');
    expect(groups[0].rarity).toBe('common');
    const steiner = groups[0].factions.find(entry => entry.id === 'Steiner');
    expect(steiner?.systems).toBeGreaterThan(0);
    expect(groupOf(groups, 'Liao')).toBe('veryRare');
    expect(groupOf(groups, 'MagistracyOfCanopus')).toBe('veryRare');
    // En 3052 los Clanes tienen sistemas y su tabla no trae el AS7-D: van al final, como no vendido.
    const invasion = getAvailabilityAt(data, availability, mech('AS7-D'), '3052-06-01');
    expect(invasion.at(-1)?.rarity).toBeNull();
    expect(groupOf(invasion, 'ClanWolf')).toBeNull();
  });

  it('CA4: el ARC-AGC es Unique en Marik, existe desde 3045 y es recompensa de Bow and Arrow', () => {
    const archer = mech('ARC-AGC');
    expect(archer.hero).toBe(true);
    expect(archer.from).toBe('3045-01-01');
    expect(getMarketRarity(availability, archer, 'Marik')).toBe('unique');
    expect(isProduced(archer, '3030-01-01')).toBe(false);
    expect(isProduced(archer, '3045-01-01')).toBe(true);
    expect(getFixedSources(data, 'ARC-AGC').quests.map(quest => quest.name)).toEqual(['Bow and Arrow']);
  });

  it('CA5: el AS7-D-H está en Romulus desde 3043 y el TDR-5S se vende en Rasalhague', () => {
    const romulus = data.systems.find(system => system.name === 'Romulus')!;
    const atlasII = getFixedSources(data, 'AS7-D-H');
    expect(atlasII.uniques).toEqual([expect.objectContaining({ system: romulus.id, from: '3043-05-10' })]);
    const rasalhague = data.systems.find(system => system.name === 'Rasalhague')!;
    const thunderbolt = getFixedSources(data, 'TDR-5S');
    expect(thunderbolt.markets.some(market => market.dlc === 4 && market.system === rasalhague.id)).toBe(true);
  });

  it('CA6: hay 14 \'Mechs hero de un solo sitio, ordenados por nombre', () => {
    const { heroes } = getOnePlaceMechs(data, availability);
    expect(heroes).toHaveLength(14);
    expect(heroes.every(hero => hero.mech.hero && !hero.mech.heroMarket)).toBe(true);
    expect(heroes.every(({ sources }) => countSources(sources) > 0)).toBe(true);
    const names = heroes.map(hero => hero.mech.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const ids = heroes.map(hero => hero.mech.id);
    expect(ids).toEqual(expect.arrayContaining(['ARC-AGC', 'AS7-D-H', 'MAD-BH', 'PXH-KB']));
  });

  it('CA7: una variante sin rareza no la vende ninguna facción', () => {
    const groups = getAvailabilityAt(data, availability, mech('BLR-1GHE'), '3025-06-01');
    expect(groups).toHaveLength(1);
    expect(groups[0].rarity).toBeNull();
  });

  it('CA8: la búsqueda encuentra por nombre y por variante', () => {
    const atlas = searchMechs(availability, 'atlas').map(found => found.id);
    expect(atlas).toContain('AS7-D');
    expect(atlas).toContain('AS7-D-H');
    expect(searchMechs(availability, 'as7-d')[0].id).toBe('AS7-D');
    expect(searchMechs(availability, '  ')).toEqual([]);
  });

  it('CA9: la variante se lee y se escribe en la URL', () => {
    expect(parseMechQuery('?mech=AS7-D', availability)).toBe('AS7-D');
    expect(parseMechQuery('?mech=NO-EXISTE', availability)).toBeNull();
    expect(toMapQuery({ date: '3025-06-01', systemId: null, mechId: 'AS7-D' }, data)).toContain('mech=AS7-D');
  });

  it('CA11: la búsqueda solo muestra las variantes que ya existen en la fecha del mapa', () => {
    expect(searchMechs(availability, 'atlas', '3030-01-01').map(found => found.id)).not.toContain('AS7-D-H');
    expect(searchMechs(availability, 'atlas', '3045-01-01').map(found => found.id)).toContain('AS7-D-H');
  });

  it('CA12: un hero que es recompensa de una HRQ encuadra su ruta y la marca', () => {
    const bowAndArrow = data.quests.find(quest => quest.name === 'Bow and Arrow')!;
    expect(getMechFocus(data, availability, mech('ARC-AGC'), '3046-01-01')).toEqual({
      systemIds: getQuestRoute(bowAndArrow),
      questId: bowAndArrow.id
    });
  });

  it('CA13: se encuadra el sitio pequeño donde se consigue, y nada si se vende en todas partes', () => {
    const romulus = data.systems.find(system => system.name === 'Romulus')!;
    const outreach = data.systems.find(system => system.name === 'Outreach')!;
    expect(getMechFocus(data, availability, mech('AS7-D-H'), '3044-01-01')).toEqual({ systemIds: [romulus.id], questId: null });
    expect(getMechFocus(data, availability, mech('ARC-2W'), '3050-06-01')).toEqual({ systemIds: [outreach.id], questId: null });
    expect(getMechFocus(data, availability, mech('AS7-D'), '3025-06-01')).toEqual({ systemIds: [], questId: null });
    expect(getMechFocus(data, availability, mech('ARC-T'), '3025-06-01')).toEqual({ systemIds: [], questId: null });
  });

  it('CA14: las facciones con pocos sistemas traen la lista de sus sistemas', () => {
    const groups = getAvailabilityAt(data, availability, mech('AS7-D'), '3025-06-01');
    const factions = groups.flatMap(group => group.factions);
    const terra = data.systems.find(system => system.name === 'Terra')!;
    expect(factions.find(entry => entry.id === 'ComStar')?.systemIds).toEqual([terra.id]);
    expect(factions.find(entry => entry.id === 'Steiner')?.systemIds).toBeUndefined();
  });

  it('CA15: si lo buscado todavía no existe, se sabe cuántas variantes llegan y cuándo la siguiente', () => {
    expect(searchMechs(availability, 'as7-d-h', '3030-01-01')).toEqual([]);
    expect(getLaterVariants(availability, 'as7-d-h', '3030-01-01')).toEqual({ count: 1, next: '3041-11-11' });
    // El ACW-1 existe desde 3059, pero el ACW-PRIME no llega hasta después del final del mapa.
    expect(getLaterVariants(availability, 'arctic wolf', '3030-01-01')).toEqual({ count: 5, next: '3059-01-01' });
    expect(getLaterVariants(availability, 'acw-prime', '3030-01-01')).toEqual({ count: 1, next: '3067-01-01' });
    expect(getLaterVariants(availability, 'no existe', '3030-01-01')).toEqual({ count: 0, next: null });
  });

  it('CA16: aunque haya resultados, se avisa de las variantes que llegan después', () => {
    expect(searchMechs(availability, 'archer', '3015-01-01')).toHaveLength(5);
    expect(getLaterVariants(availability, 'archer', '3015-01-01')).toEqual({ count: 5, next: '3016-02-20' });
  });

  it('CA17: hay 13 variantes especiales de un solo sitio, como el Wolverine de Razer', () => {
    const { special } = getOnePlaceMechs(data, availability);
    expect(special).toHaveLength(13);
    expect(special.every(({ mech }) => !mech.hero && Object.keys(mech.rarity).length === 0)).toBe(true);
    const razer = special.find(({ mech }) => mech.id === 'WVR-7H');
    expect(razer?.sources.rewards).toEqual([expect.objectContaining({ title: 'Hidden Cache Found' })]);
    expect(razer?.sources.rewards[0].system).toBe(data.systems.find(system => system.name === 'Valentina')?.id);
    expect(special.find(({ mech }) => mech.id === 'TDR-5SE')?.sources.markets[0].dlc).toBe(2);
  });

  it('CA18: el MAD-BH es la recompensa de Head Hunting en Robinson, y se encuadra Robinson', () => {
    const robinson = data.systems.find(system => system.name === 'Robinson')!;
    const [reward] = getFixedSources(data, 'MAD-BH').rewards;
    expect(reward).toEqual(expect.objectContaining({ title: 'Head Hunting', dlc: 4, system: robinson.id }));
    expect(getMechFocus(data, availability, mech('MAD-BH'), '3050-01-01')).toEqual({ systemIds: [robinson.id], questId: null });
  });

  it('CA19: los hero que pueden salir a la venta no están en la lista', () => {
    expect(mech('WVR-Q').heroMarket).toBe(true);
    expect(mech('ARC-T').heroMarket).toBe(true);
    const { heroes, special } = getOnePlaceMechs(data, availability);
    const ids = [...heroes, ...special].map(entry => entry.mech.id);
    expect(ids).not.toContain('WVR-Q');
    expect(ids).not.toContain('ARC-T');
  });

  it('CA20: las recompensas fuera de las HRQ no repiten las de las HRQ y encuentran su variante', () => {
    expect(data.rewards.some(reward => reward.title === 'Bow and Arrow Pt.4')).toBe(false);
    expect(data.rewards.find(reward => reward.title === 'Gunzburg Pt.3')?.mechs.map(entry => entry.id)).toEqual(['AS7-D']);
    expect(data.rewards.find(reward => reward.title === 'Battle at New Starburg')?.mechs.map(entry => entry.id)).toEqual(['HBR-A']);
  });

  it('CA21: una recompensa cuya acción está en otra carpeta también tiene sistema', () => {
    const vega = data.systems.find(system => system.name === 'Vega')!;
    expect(data.rewards.find(reward => reward.title === 'Shielded Withdrawal')?.system).toBe(vega.id);
  });

  it('CA22: el Wolverine de Razer y el PXH-KB son promociones, sin sistema', () => {
    const valentina = data.systems.find(system => system.name === 'Valentina')!;
    const [razer] = getFixedSources(data, 'WVR-7H').rewards;
    expect(razer).toEqual(expect.objectContaining({ kind: 'promotion', partner: 'Razer', system: valentina.id }));
    expect(getMechFocus(data, availability, mech('WVR-7H'), '3030-01-01')).toEqual({ systemIds: [valentina.id], questId: null });
    const [microsoft] = getFixedSources(data, 'PXH-KB').rewards;
    expect(microsoft).toEqual(expect.objectContaining({ kind: 'promotion', partner: 'Microsoft' }));
    expect(microsoft.system).toBeUndefined();
    expect(getFixedSources(data, 'MAD-BH').rewards[0].kind).toBe('mission');
  });

  it('CA23: toda recompensa dice cómo se consigue, aunque no esté en el mapa', () => {
    const describe = (mechId: string) => describeRewardSource(getFixedSources(data, mechId).rewards[0]);
    expect(describe('WVR-7H')).toBe('Razer promotion: arrives as a message (Hidden Cache Found) when you arrive');
    expect(describe('FS9-A')).toBe('Reach Bounty Hunter intel level 3 (DLC 4)');
    expect(describe('SNV-BR')).toBe('Complete the DLC 9 campaign (Promises Kept)');
    expect(describe('PXH-KB')).toBe('Microsoft promotion, career mode only: arrives as a message (Heya Ryana, I\'m Back!)');
  });

  it('CA24: la búsqueda encuentra por el otro nombre, como el MechLab', () => {
    const adder = searchMechs(availability, 'adder');
    expect(adder.map(found => found.id)).toContain('ADR-PRIME');
    expect(adder.every(found => found.name === 'Puma' && found.otherName === 'Adder')).toBe(true);
  });

  it('CA25: la plantilla de los rangos de la arena no es una recompensa', () => {
    expect(getFixedSources(data, 'AS7-BH').rewards).toEqual([]);
    expect(getFixedSources(data, 'CRD-CR').rewards).toEqual([]);
    expect(data.rewards.some(reward => reward.id.endsWith('Template'))).toBe(false);
    expect(mech('AS7-BH').heroMarket).toBe(true);
  });

  it('CA10: las variantes están en el MechLab y todas las facciones del mapa tienen tabla salvo el ARDC', () => {
    const names = new Map(mechsJson.map(entry => [entry.id, entry.name]));
    expect(availability.mechs.filter(entry => names.get(entry.id) !== entry.name)).toEqual([]);
    const withoutTable = Object.keys(data.factions).filter(faction => !getFactionTable(availability, faction));
    expect(withoutTable).toEqual(['ArcRoyalDefenseCordon']);
  });
});
