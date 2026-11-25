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
  // Un loadout cargado se queda con los rellenos dinámicos que caben (board.ts): se enseñan los puestos y, si
  // faltan, los que pide.
  const placed = Math.min(fillers, Math.max(free, 0));
  return [
    { label: 'TONNAGE', value: tonnage.toFixed(2), unit: `/ ${mech.tonnage} t`, warn: tonnage > mech.tonnage },
    {
      label: 'FREE SLOTS',
      value: String(Math.max(free - fillers, 0)),
      unit: `/ ${ZONES.reduce((sum, zone) => sum + getGeneralSlots(mech, build, zone), 0)}`,
      title: 'Free general slots, after the fixed and dynamic fillers'
    },
    {
      label: 'DYNAMIC FILLERS',
      value: String(placed),
      ...(placed < fillers ? { unit: `/ ${fillers}` } : {}),
      title: placed < fillers
        ? `Endo, Ferro and similar ask for ${fillers} general slots; only ${placed} fit, as in the game when it loads this loadout`
        : 'General slots that Endo, Ferro and similar take anywhere in the \'Mech'
    }
  ];
}

// Los avisos de BuildStatus, con la ubicación a la que llevan al pulsarlos.
export function getYamlBuildIssues(mech: YamlMech, build: YamlBuild): BuildIssue[] {
  return getBuildIssues(mech, build).map((issue, index) => ({ id: `yaml-${index}`, severity: issue.severity, message: issue.message, zone: issue.zone }));
}
