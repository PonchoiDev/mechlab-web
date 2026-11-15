import type { BtBuild } from '../../types/battletech-mechlab';
import type { BuildIssue } from '../issues';
import { ZONE_KEYS, ZONE_LABELS } from '../zones';
import { countJumpJets, getLocationUsage, getZoneItems } from './fitting';
import { HARDPOINT_LABELS, HARDPOINTS } from './mechlabData';
import { getBuildSummary } from './stats';

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const formatTonnage = (value: number) => String(Number(value.toFixed(2)));

// Lo que falta o sobra para terminar la build, de los errores (el juego no deja salir con ellos) a
// los avisos. Los errores solo aparecen con builds que vienen de fuera (un enlace, otra versión de los
// datos) o al pasarse de peso, que el mechlab del juego deja hacer pero marca.
export const getBtBuildIssues = (build: BtBuild): BuildIssue[] => {
  const { mech, loadout } = build;
  const summary = getBuildSummary(build);
  const issues: BuildIssue[] = [];

  if (summary.freeTonnage < 0) {
    issues.push({ id: 'overweight', severity: 'error', message: `Over tonnage by ${formatTonnage(-summary.freeTonnage)} t` });
  }

  for (const zone of ZONE_KEYS) {
    const usage = getLocationUsage(mech, loadout, zone);
    if (usage.slots.used > usage.slots.capacity) {
      issues.push({ id: `slots-${zone}`, severity: 'error', zone, message: `${ZONE_LABELS[zone]}: ${plural(usage.slots.used - usage.slots.capacity, 'slot')} over capacity` });
    }
    const over = HARDPOINTS.filter(type => usage.hardpoints[type].used > usage.hardpoints[type].capacity);
    if (over.length > 0) {
      issues.push({ id: `hardpoints-${zone}`, severity: 'error', zone, message: `${ZONE_LABELS[zone]}: more ${over.map(type => HARDPOINT_LABELS[type]).join(' and ')} weapons than hardpoints` });
    }
    const misplaced = getZoneItems(loadout, zone).filter(item => item.builtIn || !item.locations.includes(zone));
    for (const item of misplaced) {
      issues.push({ id: `location-${zone}-${item.id}`, severity: 'error', zone, message: `${item.name} cannot go in the ${ZONE_LABELS[zone].toLowerCase()}` });
    }
    for (const item of getZoneItems(loadout, zone)) {
      if (item.jumpJet && (mech.tonnage < item.jumpJet.minTonnage || mech.tonnage > item.jumpJet.maxTonnage)) {
        issues.push({ id: `jump-jet-tonnage-${zone}-${item.id}`, severity: 'error', zone, message: `${item.name} is for ${item.jumpJet.minTonnage} to ${item.jumpJet.maxTonnage} t 'Mechs` });
      }
    }
  }

  const jumpJets = countJumpJets(mech, loadout);
  if (jumpJets > mech.maxJumpJets) {
    issues.push({ id: 'jump-jets', severity: 'error', message: `${plural(jumpJets, 'jump jet')} for a maximum of ${mech.maxJumpJets}` });
  }

  for (const line of summary.ammo) {
    if (line.weapons > 0 && line.rounds === 0) {
      const zone = ZONE_KEYS.find(candidate => getZoneItems(loadout, candidate).some(item => item.weapon?.ammoCategory === line.category));
      issues.push({ id: `missing-ammo-${line.category}`, severity: 'warning', zone, message: `${line.label} has no ammo` });
    }
    if (line.weapons === 0 && line.boxes > 0) {
      const zone = ZONE_KEYS.find(candidate => getZoneItems(loadout, candidate).some(item => item.ammo?.category === line.category));
      issues.push({ id: `unused-ammo-${line.category}`, severity: 'warning', zone, message: `${line.label} ammo is not used by any weapon` });
    }
  }

  for (const zone of ZONE_KEYS) {
    const usage = getLocationUsage(mech, loadout, zone);
    const free = HARDPOINTS.reduce((total, type) => total + Math.max(0, usage.hardpoints[type].capacity - usage.hardpoints[type].used), 0);
    if (free > 0) issues.push({ id: `free-hardpoints-${zone}`, severity: 'warning', zone, message: `${ZONE_LABELS[zone]}: ${plural(free, 'free hardpoint')}` });
  }

  if (summary.heat.net > 0) {
    issues.push({ id: 'heat', severity: 'warning', message: `An alpha strike builds ${formatTonnage(summary.heat.net)} heat per turn` });
  }

  if (summary.freeTonnage > 0) {
    issues.push({ id: 'free-tonnage', severity: 'warning', message: `${formatTonnage(summary.freeTonnage)} t unused` });
  }

  return issues;
};
