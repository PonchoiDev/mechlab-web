import { describe, expect, it } from 'vitest';
import flashpointsJson from '../../data/battletech/flashpoints.json';
import starmapJson from '../../data/battletech/starmap.json';
import type { BtFlashpoint } from '../../types/battletech-flashpoints';
import {
  DEFAULT_FLASHPOINTS_VIEW,
  filterFlashpoints,
  getFlashpointMapUrl,
  groupFlashpoints,
  parseFlashpointsQuery,
  toFlashpointsQuery
} from './flashpoints';

// Criterios de aceptación de docs/specs/battletech-flashpoints.md, con los datos reales.
const flashpoints = (flashpointsJson as unknown as { flashpoints: BtFlashpoint[] }).flashpoints;
const systemNames = new Set((starmapJson as unknown as { systems: { name: string }[] }).systems.map(system => system.name));
const flashpoint = (name: string) => {
  const found = flashpoints.find(candidate => candidate.name === name);
  if (!found) throw new Error(`No está ${name}`);
  return found;
};
const names = (list: BtFlashpoint[]) => list.map(candidate => candidate.name);

describe('flashpoints de BATTLETECH', () => {
  it('CA1: 32 flashpoints de tres DLC, todos con sistema y contratos con nombre', () => {
    expect(groupFlashpoints(flashpoints).map(group => [group.source, group.flashpoints.length]))
      .toEqual([['flashpoint', 18], ['heavymetal', 4], ['urbanwarfare', 10]]);
    for (const candidate of flashpoints) {
      expect(systemNames.has(candidate.system), `${candidate.name}: ${candidate.system}`).toBe(true);
      const contracts = [...candidate.contracts, ...candidate.paths.flatMap(path => path.contracts)];
      expect(contracts.length, candidate.name).toBeGreaterThan(0);
      expect(contracts.every(contract => contract.name), candidate.name).toBe(true);
    }
  });

  it('CA2: The Baying of Hounds, con su tronco, sus dos caminos y su recompensa', () => {
    const hounds = flashpoint('The Baying of Hounds');
    expect(hounds).toMatchObject({
      id: 'morganKell', source: 'flashpoint', system: 'Viribium', employer: 'Kell Hounds', difficulty: 7, length: 'medium', cancelable: true
    });
    expect(hounds.contracts.map(contract => contract.name)).toEqual(['The Baying of Hounds', 'The Baying of Hounds II']);
    expect(hounds.paths.map(path => ({ label: path.label, contracts: path.contracts.map(contract => `${contract.name} ${contract.type}`), funds: path.funds, reputation: path.reputation })))
      .toEqual([
        { label: 'A', contracts: ['The Baying of Hounds III SimpleBattle'], funds: 1000000, reputation: [{ faction: 'Mercenary Review Board', value: 9 }] },
        { label: 'B', contracts: ['The Baying of Hounds III CaptureBase'], funds: 1000000, reputation: [{ faction: 'Mercenary Review Board', value: 9 }] }
      ]);
    expect(hounds.reward?.title).toBe('Rare Items');
  });

  it('CA3: los Mechs de las recompensas, con enlace solo si están en el MechLab', () => {
    expect(flashpoint('Hourglass').reward?.mechs).toEqual([{ id: 'bullshark_BSK-MAZ', name: 'Bull Shark BSK-MAZ', inMechLab: false }]);
    expect(flashpoint('The Steel Beast').reward?.mechs).toEqual([{ id: 'crab__fp_gladiator_BSC-27', name: 'Big Steel Claw BSC-20', inMechLab: false }]);
    expect(flashpoint('Prototype').reward?.mechs).toEqual([{ id: 'raven_RVN-1X', name: 'Raven RVN-1X', inMechLab: true }]);
  });

  it('CA4: requisitos y flashpoints que se repiten', () => {
    expect(flashpoint('Davion Alliance').requirements).toEqual({ ally: 'Federated Suns', reputation: [] });
    expect(flashpoint('Red Hunt').requirements).toEqual({ ally: null, reputation: [{ faction: 'Draconis Combine', min: 40 }] });
    expect(flashpoint('The Baying of Hounds').requirements).toEqual({ ally: null, reputation: [] });
    expect(flashpoints.filter(candidate => candidate.repeatable).map(candidate => candidate.name)).toEqual(["Yang Virtanen's Big Score"]);
  });

  it('CA5: filtro por DLC y búsqueda sin distinguir mayúsculas', () => {
    expect(filterFlashpoints(flashpoints, '', 'heavymetal')).toHaveLength(4);
    expect(names(filterFlashpoints(flashpoints, 'KELL', 'all'))).toEqual(['The Baying of Hounds']);
    expect(names(filterFlashpoints(flashpoints, 'viribium', 'all'))).toEqual(['The Baying of Hounds']);
    expect(names(filterFlashpoints(flashpoints, 'raven', 'all'))).toEqual(['Prototype']);
  });

  it('CA6: el enlace al mapa estelar', () => {
    expect(getFlashpointMapUrl(flashpoint('The Baying of Hounds'))).toBe('/battletech/starmap/?system=Viribium');
  });

  it('CA7: la vista va en la URL', () => {
    expect(parseFlashpointsQuery('', flashpoints)).toEqual(DEFAULT_FLASHPOINTS_VIEW);
    expect(toFlashpointsQuery(parseFlashpointsQuery('?dlc=heavymetal&q=hour', flashpoints))).toBe('?dlc=heavymetal&q=hour');
    expect(parseFlashpointsQuery('?fp=morganKell', flashpoints).open).toBe('morganKell');
    expect(parseFlashpointsQuery('?fp=nope&dlc=nope', flashpoints)).toEqual(DEFAULT_FLASHPOINTS_VIEW);
  });

  it('CA8: Yang Virtanen\'s Big Score, con la lanza ligera o la pesada y su Mech a elegir', () => {
    const yang = flashpoint("Yang Virtanen's Big Score");
    expect(yang.paths.map(path => ({ label: path.label, name: path.name, mechs: path.reward?.mechs.map(mech => mech.name), choice: path.reward?.choice }))).toEqual([
      { label: 'A', name: 'Light lance', mechs: ['Vindicator VND-1AA', 'Firestarter FS9-H', 'Trebuchet TBT-5N', 'Enforcer ENF-4R'], choice: true },
      { label: 'B', name: 'Heavy lance', mechs: ['Catapult CPLT-C4', 'Thunderbolt TDR-5SE', 'Dragon DRG-1N', 'Kintaro KTO-18'], choice: true }
    ]);
  });
});

