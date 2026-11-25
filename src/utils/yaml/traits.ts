import type { MechUpgradeStat, Upgrade } from '../../types/upgrade';
import type { YamlBuild, YamlMech } from '../../types/yaml-mechlab';
import { canInstallUpgrade, getUpgradeModifiers, getUpgrades } from '../upgrades';

// Rasgos de 'Mech (mejoras de la cantina) en el MechLab de YAML (docs/specs/rasgos-yaml.md). Se instalan con las
// reglas del MechLab de MW5, en los huecos de rasgo del MDA de YAML.

const f = Math.fround;

export const getYamlUpgrades = (build: YamlBuild): Upgrade[] => getUpgrades(build.traits ?? []);

export const canInstallYamlUpgrade = (mech: YamlMech, build: YamlBuild, upgradeId: string): boolean => {
  const [upgrade] = getUpgrades([upgradeId]);
  return !!upgrade && canInstallUpgrade(mech, getYamlUpgrades(build), upgrade);
};

// Pulsar un rasgo lo quita si está puesto y, si no, lo pone si cabe; si no cabe, la build no cambia.
export function toggleYamlUpgrade(mech: YamlMech, build: YamlBuild, upgradeId: string): YamlBuild {
  const traits = build.traits ?? [];
  if (traits.includes(upgradeId)) return { ...build, traits: traits.filter(id => id !== upgradeId) };
  return canInstallYamlUpgrade(mech, build, upgradeId) ? { ...build, traits: [...traits, upgradeId] } : build;
}

// Las funciones nativas del juego (GetInstalledArmorForPart, GetMaxStructureForPart, GetTurnSpeed,
// GetTorsoTwistSpeed, GetSensorRange, EstimateMaxJumpJetHeight) suman lo que da cada rasgo instalado para su
// estadística y multiplican por máx(0, 1 + suma). YAML hace la misma suma para la refrigeración y la capacidad.
export function getTraitMultiplier(build: YamlBuild, stat: MechUpgradeStat): number {
  if (!build.traits?.length) return 1;
  return f(Math.max(0, f(1 + getUpgradeModifiers(getYamlUpgrades(build))[stat])));
}

// Lo que suman los rasgos a una estadística (la fracción, sin el 1).
export function getTraitPercent(build: YamlBuild, stat: MechUpgradeStat): number {
  return build.traits?.length ? f(getUpgradeModifiers(getYamlUpgrades(build))[stat]) : 0;
}
