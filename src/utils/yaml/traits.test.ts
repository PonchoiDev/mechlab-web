import { describe, expect, it } from 'vitest';
import type { YamlBuild } from '../../types/yaml-mechlab';
import { createStockBuild } from './build';
import { decodeYamlBuild, encodeYamlBuild } from './buildCode';
import { getYamlStatsPanel } from './combat';
import { findYamlMech, getYamlItem } from './data';
import { getBuildTonnage } from './stats';
import { canInstallYamlUpgrade, getYamlUpgrades, toggleYamlUpgrade } from './traits';

// Rasgos de 'Mech en el MechLab de YAML, criterios CA1 a CA7 de docs/specs/rasgos-yaml.md. Las fórmulas
// salen del código de YAML y de las funciones nativas del juego; las cifras del WHM-DNC, de una captura.
const panel = (id: string, build: YamlBuild) =>
  Object.fromEntries(getYamlStatsPanel(findYamlMech(id)!, build).flat().map(cell => [cell.key, cell.value]));
const withUpgrades = (id: string, build: YamlBuild, upgrades: string[]) =>
  upgrades.reduce((current, upgrade) => toggleYamlUpgrade(findYamlMech(id)!, current, upgrade), build);

const warhammer = findYamlMech('WHM-DNC')!;
const warhammerStock = createStockBuild(warhammer);
const grasshopper = findYamlMech('GHR-5J')!;
const grasshopperStock = createStockBuild(grasshopper);

describe('Rasgos de serie', () => {
  it('CA1: el WHM-DNC sale con sus tres rasgos del loadout del juego, de 7 huecos', () => {
    expect(getYamlUpgrades(warhammerStock).map(upgrade => upgrade.name)).toEqual([
      'Refined Armor II', 'Fortified Internal Structure II', 'Boosted Top Speed'
    ]);
    expect(warhammer.upgradeSlots).toBe(7);
  });

  it('CA2: el WHM-DNC de serie da las cifras de la captura del juego', () => {
    expect(panel('WHM-DNC', warhammerStock)).toMatchObject({
      armor: '375.9', structure: '299.2', speed: '85.7', alphaDamage: '58', dps: '32.19', heatPerSecond: '7.54',
      cooling: '2.6', turnRate: '75.8', alphaHeat: '13.6', heatCapacity: '56', torsoTwistRate: '94.8', torsoYaw: '121',
      weaponRange: '900', sensorRange: '900', armYaw: '25', ammo: '80'
    });
    expect(getBuildTonnage(warhammer, warhammerStock)).toBe(61.99);
  });

  it('CA3: sin sus rasgos vuelve a las cifras sin ellos y pesa lo mismo', () => {
    const bare = { ...warhammerStock, traits: [] };
    expect(panel('WHM-DNC', bare)).toMatchObject({ armor: '358', structure: '272', speed: '74.52' });
    expect(getBuildTonnage(warhammer, bare)).toBe(61.99);
  });
});

describe('Instalación', () => {
  it('CA4: cada rasgo una vez, el I y el II juntos y sin pasar de los huecos del MDA de YAML', () => {
    const empty = { ...grasshopperStock, traits: [] };
    const both = withUpgrades('GHR-5J', empty, ['IncreasedArmor_Trait1', 'IncreasedArmor_Trait2']);
    expect(both.traits).toEqual(['IncreasedArmor_Trait1', 'IncreasedArmor_Trait2']);
    // Volver a pulsar uno lo quita.
    expect(toggleYamlUpgrade(grasshopper, both, 'IncreasedArmor_Trait1').traits).toEqual(['IncreasedArmor_Trait2']);
    // 3 + 2 + 2 = 7 huecos llenos: no cabe ni uno de 1.
    const full = withUpgrades('GHR-5J', both, ['IncreasedStructure_Trait2', 'IncreasedSensorRange_Trait2']);
    expect(full.traits).toHaveLength(4);
    expect(canInstallYamlUpgrade(grasshopper, full, 'IncreasedTopSpeed_Trait1')).toBe(false);
    expect(toggleYamlUpgrade(grasshopper, full, 'IncreasedTopSpeed_Trait1')).toBe(full);
    expect(findYamlMech('ON1-P')!.upgradeSlots).toBe(8);
  });
});

describe('Cómo cuentan', () => {
  const jumpJet = (index: number) =>
    !!getYamlItem(grasshopperStock.items[index].item)?.jumpJet;
  const removed = new Set(['leftLeg', 'rightLeg'].map(zone =>
    grasshopperStock.items.findIndex((mounted, index) => mounted.zone === zone && jumpJet(index))));
  const twoJets = { ...grasshopperStock, items: grasshopperStock.items.filter((_, index) => !removed.has(index)) };

  it('CA5: refrigeración, capacidad, giro, giro del torso, sensores y salto', () => {
    expect(panel('GHR-5J', twoJets)).toMatchObject({
      cooling: '2.2', heatCapacity: '52', turnRate: '85.9', torsoTwistRate: '108', sensorRange: '800', jumpHeight: '50'
    });
    const upgraded = withUpgrades('GHR-5J', twoJets, [
      'IncreasedHeatCooling_Trait1', 'IncreasedHeatCapacity_Trait2', 'IncreasedTurnSpeed_Trait1',
      'IncreasedTorsoTwistRate_Trait1', 'IncreasedSensorRange_Trait1', 'IncreasedJJAccelXYZ_Trait1'
    ]);
    expect(upgraded.traits).toHaveLength(6);
    // 85,9437 × 1,075 = 92,39; 108 × 1,2 = 129,6; 800 × 1,1 = 880. Salto: 1.250 × 2,75 + ½ × 420 × 1,15 ×
    // 2,75² = 5.263 cm.
    expect(panel('GHR-5J', upgraded)).toMatchObject({
      cooling: '2.31', heatCapacity: '57.2', turnRate: '92.4', torsoTwistRate: '129.6', sensorRange: '880', jumpHeight: '52'
    });
  });

  it('CA6: los rasgos de armas no cambian las cifras de las armas del panel', () => {
    const weaponStats = (build: YamlBuild) => {
      const { alphaDamage, dps, alphaHeat, heatPerSecond, weaponRange, meleeDamage, meleeDps } = panel('GHR-5J', build);
      return { alphaDamage, dps, alphaHeat, heatPerSecond, weaponRange, meleeDamage, meleeDps };
    };
    const upgraded = withUpgrades('GHR-5J', grasshopperStock, [
      'IncreasedEnergyDamage_Trait2', 'IncreasedEnergyRangeAndSpeed_Trait2', 'ReducedEnergyCooldown_Trait2', 'ReducedEnergyHeat_Trait1'
    ]);
    expect(upgraded.traits).toHaveLength(4);
    expect(weaponStats(upgraded)).toEqual(weaponStats(grasshopperStock));
  });
});

describe('Enlace de la build', () => {
  it('CA7: el código conserva los rasgos y, sin rasgos, no cambia', () => {
    const decoded = decodeYamlBuild(encodeYamlBuild('WHM-DNC', warhammerStock))!;
    expect(decoded.build.traits).toEqual(warhammerStock.traits);
    const bare = { ...warhammerStock, traits: [] };
    const { traits: _traits, ...withoutField } = warhammerStock;
    expect(encodeYamlBuild('WHM-DNC', bare)).toBe(encodeYamlBuild('WHM-DNC', withoutField));
    expect(decodeYamlBuild(encodeYamlBuild('WHM-DNC', bare))!.build.traits ?? []).toEqual([]);
  });
});
