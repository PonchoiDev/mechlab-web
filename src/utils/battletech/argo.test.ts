import { describe, expect, it } from 'vitest';
import argoJson from '../../data/battletech/argo.json';
import type { ArgoData } from '../../types/battletech-argo';
import {
  addToPlan, formatEffect, getAllPlan, getAncestors, getPathCost, getPlanEffects, getPlanTotals, getStartingPlan, getStatus, getTreeLayout,
  getUnlocks, getUpgrade, groupBySection, parseArgoQuery, removeFromPlan, toArgoQuery
} from './argo';

// Criterios de aceptación de docs/specs/battletech-argo.md.
const data = argoJson as unknown as ArgoData;
const names = (ids: Iterable<string>) => [...ids].map(id => getUpgrade(data, id).name);
const effectTexts = (id: string) => getUpgrade(data, id).effects.map(effect => formatEffect(data, effect.stat, effect.value, effect.set));
const planEffects = (owned: ReadonlySet<string>) => getPlanEffects(data, owned).map(effect => effect.text);

describe('la Argo de BATTLETECH', () => {
  it('CA1: 35 mejoras en 9 categorías, con 5 iniciales gratis', () => {
    expect(data.upgrades).toHaveLength(35);
    expect(data.categories).toHaveLength(9);
    const ids = new Set(data.upgrades.map(upgrade => upgrade.id));
    expect(ids.size).toBe(35);
    expect(data.upgrades.every(upgrade => upgrade.requires.every(id => ids.has(id)))).toBe(true);
    expect(data.upgrades.every(upgrade => data.categories.some(category => category.id === upgrade.category))).toBe(true);
    const starting = data.upgrades.filter(upgrade => upgrade.starting);
    expect(starting.map(upgrade => upgrade.id).sort()).toEqual(['drive0', 'mechBay1', 'medBay1', 'pod1', 'structure0']);
    expect(starting.every(upgrade => upgrade.cost === 0 && upgrade.upkeep === 0)).toBe(true);
  });

  it('CA2: Mech Bay 2, con su precio, requisitos, lo que abre y sus efectos', () => {
    const upgrade = getUpgrade(data, 'mechBay2');
    expect(upgrade.name).toBe('Mech Bay 2');
    expect(upgrade.cost).toBe(900000);
    expect(upgrade.upkeep).toBe(25000);
    expect(names(upgrade.requires)).toEqual(['Mech Bay 1', 'Repaired Power Conduits']);
    expect(names(getUnlocks(data, 'mechBay2')).sort()).toEqual(['Improved Automation', 'Mech Bay 3']);
    expect(effectTexts('mechBay2')).toEqual(['The MechBay supports up to 12 BattleMechs ready for battle', '+3 Tech Points']);
  });

  it('CA3: Hospital Bay, en el nivel 5, con 12 requisitos en total', () => {
    const upgrade = getUpgrade(data, 'medBay_hospital');
    expect(upgrade.tier).toBe(5);
    expect(effectTexts('medBay_hospital')).toContain('Chance of death from Lethal damage is 5% less likely');
    const ancestors = getAncestors(data, 'medBay_hospital');
    expect(ancestors).toHaveLength(12);
    expect(names(ancestors)).toEqual(expect.arrayContaining(['Med Bay 1', 'Gamma Pod', 'High-Capacity Power Conduits']));
  });

  it('CA4: el camino a Hospital Bay desde el plan inicial', () => {
    const path = getPathCost(data, getStartingPlan(data), 'medBay_hospital');
    expect(path.upgrades).toHaveLength(10);
    expect(path.upgrades).toContain('medBay_hospital');
    expect(path.cost).toBe(10620000);
    expect(path.upkeep).toBe(57000);
    expect(getPathCost(data, getAllPlan(data), 'medBay_hospital')).toEqual({ upgrades: [], cost: 0, upkeep: 0 });
  });

  it('CA5: los totales del plan inicial y de la nave completa', () => {
    expect(getPlanTotals(data, getStartingPlan(data))).toEqual({ owned: 5, bought: 0, cost: 0, upgradesUpkeep: 0, monthly: 80000 });
    expect(getPlanTotals(data, getAllPlan(data))).toEqual({ owned: 35, bought: 30, cost: 20155000, upgradesUpkeep: 197650, monthly: 277650 });
  });

  it('CA6: marcar trae los requisitos y desmarcar quita lo que depende', () => {
    const start = getStartingPlan(data);
    const withBay3 = addToPlan(data, start, 'mechBay3');
    expect([...withBay3].filter(id => !start.has(id)).sort()).toEqual(['mechBay2', 'mechBay3', 'power1', 'power2', 'structure1']);
    const withoutPower = removeFromPlan(data, withBay3, 'power1');
    expect([...withoutPower].sort()).toEqual(['drive0', 'mechBay1', 'medBay1', 'pod1', 'structure0', 'structure1']);
    expect(removeFromPlan(data, withBay3, 'mechBay1')).toEqual(withBay3);
    expect([...removeFromPlan(data, getAllPlan(data), 'power1')]).not.toContain('medBay_hospital');
  });

  it('CA7: el efecto conjunto del plan', () => {
    expect(planEffects(getStartingPlan(data))).toEqual(expect.arrayContaining([
      'The MechBay supports up to 6 BattleMechs ready for battle',
      'The Barracks support up to 8 MechWarriors',
      '+2 Tech Points',
      '+1 Medical Points'
    ]));
    expect(planEffects(getStartingPlan(data))).toHaveLength(4);
    expect(planEffects(getAllPlan(data))).toEqual(expect.arrayContaining([
      'The MechBay supports up to 18 BattleMechs ready for battle',
      'The Barracks support up to 24 MechWarriors',
      'Travel time to and from Jump Points reduced by 30%',
      '+20 Tech Points',
      '+6 Medical Points',
      '+10 Morale',
      'MechWarriors gain 50 Experience each day',
      'MechWarriors with less than 30000 total Experience can benefit from this training',
      'Chance of death from Incapacitating damage is 5% less likely',
      'Chance of death from Lethal damage is 5% less likely'
    ]));
  });

  it('CA8: el plan y la vista en la URL', () => {
    const view = parseArgoQuery(data, '?own=mechBay2&view=list');
    expect(view.view).toBe('list');
    expect([...view.owned].sort()).toEqual(['drive0', 'mechBay1', 'mechBay2', 'medBay1', 'pod1', 'power1', 'structure0']);
    expect(toArgoQuery(data, view)).toBe('?own=mechBay2&view=list');
    expect(parseArgoQuery(data, '?own=noExiste,power1').owned).toEqual(addToPlan(data, getStartingPlan(data), 'power1'));
    const empty = parseArgoQuery(data, '');
    expect(empty).toEqual({ view: 'ship', owned: getStartingPlan(data) });
    expect(toArgoQuery(data, empty)).toBe('');
    const tree = parseArgoQuery(data, '?view=tree');
    expect(tree.view).toBe('tree');
    expect(toArgoQuery(data, tree)).toBe('?view=tree');
  });

  it('CA9: el árbol, por categoría y nivel', () => {
    const tree = getTreeLayout(data);
    expect(tree.tiers).toBe(6);
    expect(tree.rows).toHaveLength(9);
    const medBay = tree.rows.find(row => row.category.id === 'MED_BAY');
    expect(medBay?.cells[5].map(upgrade => upgrade.id)).toEqual(['medBay_hospital']);
    expect(tree.rows.every(row => row.cells.length === 6)).toBe(true);
  });

  it('CA10: la carrera cuesta lo mismo que la campaña', () => {
    expect(data.careerCostMultiplier).toBe(1);
    expect(data.careerUpkeepMultiplier).toBe(1);
    expect(data.reducedCostMultiplier).toBe(0.5);
    expect(data.baseUpkeep).toBe(80000);
  });

  it('CA11: las tres secciones de la pantalla Ship Upgrades, con sus categorías en orden', () => {
    const sections = groupBySection(data);
    expect(sections.map(({ section, categories }) => [section.name, categories.map(({ category }) => category.label)])).toEqual([
      ['Systems & Support', ['Power System', 'Structure', 'Drive System', 'Habitat Pods']],
      ['Combat & Deployment', ['Mech Bays', 'Repair & Refit', 'Training Modules']],
      ['Personnel & Medical', ['Med Bays', 'Recreation']]
    ]);
    const ids = sections.flatMap(({ categories }) => categories.flatMap(({ upgrades }) => upgrades.map(upgrade => upgrade.id)));
    expect(ids).toHaveLength(35);
    expect(new Set(ids).size).toBe(35);
    const labels = sections.flatMap(({ categories }) => categories.map(({ category }) => category.id));
    expect(new Set(labels).size).toBe(9);
  });

  it('CA12: cada caja, en el orden del juego', () => {
    const box = (label: string) => groupBySection(data)
      .flatMap(({ categories }) => categories)
      .find(({ category }) => category.label === label)?.upgrades.map(upgrade => upgrade.name);
    expect(box('Repair & Refit')).toEqual(['Automation', 'Improved Automation', 'Machine Shop', 'Refit Harness', 'Repair Scaffolding']);
    expect(box('Med Bays')).toEqual(['Med Bay 1', 'Med Bay 2', 'Med Bay 3', 'Hospital Bay']);
    expect(box('Habitat Pods')).toEqual(['Alpha Pod', 'Beta Pod', 'Gamma Pod']);
  });

  it('CA13: los iconos del juego, de cada mejora y de cada sección', () => {
    expect(data.upgrades.every(upgrade => upgrade.icon.length > 0)).toBe(true);
    expect(data.sections.every(section => section.icon.length > 0)).toBe(true);
    expect(getUpgrade(data, 'structure1').icon).toBe('structure1');
    expect(getUpgrade(data, 'medBay_hospital').icon).toBe('medbay4');
  });

  it('CA14: el estado de cada icono según el plan', () => {
    const owned = addToPlan(data, getStartingPlan(data), 'power1');
    expect(getStatus(data, owned, 'mechBay1')).toBe('starting');
    expect(getStatus(data, owned, 'power1')).toBe('owned');
    expect(getStatus(data, owned, 'mechBay2')).toBe('available');
    expect(getStatus(data, owned, 'mechBay3')).toBe('locked');
  });
});
