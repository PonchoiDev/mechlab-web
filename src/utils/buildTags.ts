import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { getMechSpecs } from './mechs';
import type { BuildTag } from './savedBuildsList';

const SPEC_TITLES: Record<string, string> = {
  xl: 'XL engine',
  dhs: 'Double heat sinks',
  endo: 'Endo Steel structure',
  ferro: 'Ferro-Fibrous armor'
};

// Etiquetas de una build de MW5 en la lista de My builds: la tecnología del chasis, con las mismas
// abreviaturas que el mechlab del juego, y el equipo especial montado. El AMS no lleva etiqueta
// porque ya se cuenta entre las armas.
export const getBuildTags = (mech: Mech, items: Item[]): BuildTag[] => {
  const tags: BuildTag[] = getMechSpecs(mech)
    .filter(spec => spec.kind in SPEC_TITLES)
    .map(spec => ({ kind: spec.kind, label: spec.label, title: SPEC_TITLES[spec.kind] }));

  const jumpJets = items.filter(item => item.equipmentType === 'jumpJet').length;
  if (jumpJets > 0) tags.push({ kind: 'jj', label: `JJ ${jumpJets}`, title: `${jumpJets} jump ${jumpJets === 1 ? 'jet' : 'jets'}` });
  if (items.some(item => item.ecm)) tags.push({ kind: 'ecm', label: 'ECM', title: 'ECM' });
  // Cualquier sonda montada, también la Clan Active Probe en una ranura normal.
  if (items.some(item => item.probe)) tags.push({ kind: 'ap', label: 'AP', title: 'Active probe' });
  // El MASC y el Supercharger comparten los datos de velocidad del juego; solo los distingue el nombre.
  const speedBoosters = items.filter(item => item.masc);
  if (speedBoosters.some(item => !item.name.includes('Supercharger'))) tags.push({ kind: 'masc', label: 'MASC', title: 'MASC' });
  if (speedBoosters.some(item => item.name.includes('Supercharger'))) tags.push({ kind: 'masc', label: 'SC', title: 'Supercharger' });
  if (items.some(item => item.targetingComputer)) tags.push({ kind: 'tc', label: 'TC', title: 'Targeting computer' });
  return tags;
};
