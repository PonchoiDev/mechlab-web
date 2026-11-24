import type { BuildIssue } from '../issues';
import type { YamlBuild, YamlMech } from '../../types/yaml-mechlab';
import { getBuildIssues, getInternalLabel, ZONES } from './board';
import {
  getArmorPoints, getArmorTons, getBuildTonnage, getDynamicFillers, getEngineRating, getHeat,
  getStructurePoints, getTopSpeed, getTotalFreeGeneralSlots
} from './stats';

// Las diez cifras de la lectura del MechLab de MW5 (StatsReadout), con las de YAML: sin cifras de daño
// todavía, y con el motor, las ranuras libres y los rellenos, que en YAML deciden qué cabe.
export interface YamlReadout {
  label: string;
  value: string;
  unit?: string;
  title?: string;
  warn?: boolean;
}

const formatNumber = (value: number) => String(Number(value.toFixed(2)));

export function getYamlReadouts(mech: YamlMech, build: YamlBuild): YamlReadout[] {
  const tonnage = getBuildTonnage(mech, build);
  const armor = getArmorPoints(mech, build);
  const maxArmor = ZONES.reduce((sum, zone) => sum + mech.zones[zone].maxArmor, 0);
  const heat = getHeat(mech, build);
  const free = getTotalFreeGeneralSlots(mech, build);
  const fillers = getDynamicFillers(build);
  const rating = getEngineRating(build);
  return [
    { label: 'TONNAGE', value: tonnage.toFixed(2), unit: `/ ${mech.tonnage} t`, warn: tonnage > mech.tonnage },
    { label: 'ARMOR POINTS', value: String(armor.installed), unit: `/ ${maxArmor}`, title: armor.bonus ? `Plus ${armor.bonus} from quirks, which weigh nothing` : undefined },
    { label: 'ARMOR MASS', value: getArmorTons(build).toFixed(2), unit: 't' },
    { label: 'TOP SPEED', value: formatNumber(getTopSpeed(mech, build)), unit: 'km/h' },
    { label: 'ENGINE', value: rating ? String(rating) : '-', unit: getInternalLabel(build, 'EngineTypeSlot'), warn: !rating },
    { label: 'STRUCTURE', value: String(getStructurePoints(mech, build).total), title: 'Internal structure points, with quirks' },
    {
      label: 'FREE SLOTS',
      value: String(free - fillers),
      unit: `/ ${ZONES.reduce((sum, zone) => sum + mech.zones[zone].general, 0)}`,
      title: 'Free general slots, after the fixed and dynamic fillers',
      warn: free < fillers
    },
    { label: 'DYNAMIC FILLERS', value: String(fillers), title: 'General slots that Endo, Ferro and similar take anywhere in the \'Mech' },
    { label: 'TOTAL COOLING RATE', value: formatNumber(heat.cooling), unit: 'heat/s' },
    { label: 'HEAT CAPACITY', value: formatNumber(heat.capacity) }
  ];
}

// Los avisos de BuildStatus, con la ubicación a la que llevan al pulsarlos.
export function getYamlBuildIssues(mech: YamlMech, build: YamlBuild): BuildIssue[] {
  return getBuildIssues(mech, build).map((issue, index) => ({ id: `yaml-${index}`, severity: issue.severity, message: issue.message, zone: issue.zone }));
}
