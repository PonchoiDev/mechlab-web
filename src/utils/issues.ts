import type { ArmorState, EquippedLoadout, Mech, Zone } from '../types/mech';
import { calculateArmorWeight, calculateEquippedWeight, getArmorPointsPerTon } from './calculators';
import { getAmmoWarnings, getComponentStatus } from './equipment';
import { ZONE_LABELS, ZONE_KEYS } from './zones';

export type BuildIssueSeverity = 'error' | 'warning';

export interface BuildIssue {
  id: string;
  severity: BuildIssueSeverity;
  message: string;
  zone?: Zone;
  hardpointIndex?: number;
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

// Lo que falta o sobra para terminar la build, del más grave al más leve.
export const getBuildIssues = (mech: Mech, loadout: EquippedLoadout, armor: ArmorState): BuildIssue[] => {
  const issues: BuildIssue[] = [];
  const totalWeight = mech.baseTonnage + calculateEquippedWeight(loadout) + calculateArmorWeight(armor, getArmorPointsPerTon(mech));
  const overweight = Math.round((totalWeight - mech.tonnageMax) * 100) / 100;

  if (overweight > 0) {
    issues.push({ id: 'overweight', severity: 'error', message: `Over tonnage by ${overweight} t` });
  }

  for (const zone of ZONE_KEYS) {
    const status = getComponentStatus(mech.components[zone], loadout[zone]);
    if (status.isOverSlots) {
      issues.push({
        id: `slots-${zone}`,
        severity: 'error',
        zone,
        message: `${ZONE_LABELS[zone]}: ${status.usedSlots - status.maxSlots} slots over capacity`
      });
    }
  }

  const ammoWarnings = getAmmoWarnings(loadout);
  for (const zone of ZONE_KEYS) {
    for (const warning of ammoWarnings[zone]) {
      issues.push({
        id: `${warning.kind}-${zone}-${warning.itemName}`,
        severity: 'warning',
        zone,
        message: warning.kind === 'missing-ammo'
          ? `${warning.itemName} has no ammo`
          : `${warning.itemName} is not used by any weapon`
      });
    }
  }

  for (const zone of ZONE_KEYS) {
    const status = getComponentStatus(mech.components[zone], loadout[zone]);
    if (status.freeHardpoints > 0) {
      issues.push({
        id: `hardpoints-${zone}`,
        severity: 'warning',
        zone,
        hardpointIndex: status.freeHardpointIndices[0],
        message: `${ZONE_LABELS[zone]}: ${plural(status.freeHardpoints, 'free hardpoint')}`
      });
    }
  }

  const lowArmorZones = ZONE_KEYS.filter(zone =>
    armor[zone].front + armor[zone].rear < mech.components[zone].maxArmor);
  if (lowArmorZones.length > 0) {
    issues.push({
      id: 'armor',
      severity: 'warning',
      zone: lowArmorZones[0],
      message: lowArmorZones.length <= 2
        ? `Armor below max: ${lowArmorZones.map(zone => ZONE_LABELS[zone]).join(', ')}`
        : `Armor below max in ${lowArmorZones.length} components`
    });
  }

  return issues;
};
