import type { BuildIssue } from '../issues';
import type { YamlBuild, YamlMech } from '../../types/yaml-mechlab';
import { getBuildIssues, ZONES } from './board';
import { getBuildTonnage, getDynamicFillers, getGeneralSlots, getTotalFreeGeneralSlots } from './stats';

// La cabecera del panel de estadísticas: el peso, donde lo enseña el juego, y las ranuras libres y los
// rellenos dinámicos, que en YAML deciden qué cabe. Las 21 cifras del panel están en combat.ts.
export interface YamlReadout {
  label: string;
  value: string;
  unit?: string;
  title?: string;
  warn?: boolean;
}

export function getYamlReadouts(mech: YamlMech, build: YamlBuild): YamlReadout[] {
  const tonnage = getBuildTonnage(mech, build);
  const free = getTotalFreeGeneralSlots(mech, build);
  const fillers = getDynamicFillers(build);
  return [
    { label: 'TONNAGE', value: tonnage.toFixed(2), unit: `/ ${mech.tonnage} t`, warn: tonnage > mech.tonnage },
    {
      label: 'FREE SLOTS',
      value: String(free - fillers),
      unit: `/ ${ZONES.reduce((sum, zone) => sum + getGeneralSlots(mech, build, zone), 0)}`,
      title: 'Free general slots, after the fixed and dynamic fillers',
      warn: free < fillers
    },
    { label: 'DYNAMIC FILLERS', value: String(fillers), title: 'General slots that Endo, Ferro and similar take anywhere in the \'Mech' }
  ];
}

// Los avisos de BuildStatus, con la ubicación a la que llevan al pulsarlos.
export function getYamlBuildIssues(mech: YamlMech, build: YamlBuild): BuildIssue[] {
  return getBuildIssues(mech, build).map((issue, index) => ({ id: `yaml-${index}`, severity: issue.severity, message: issue.message, zone: issue.zone }));
}
