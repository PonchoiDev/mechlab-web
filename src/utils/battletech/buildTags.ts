import type { BtItem } from '../../types/battletech-mechlab';
import type { BuildTag } from '../savedBuildsList';

// Etiquetas de una build de BATTLETECH en la lista de My builds: los jump jets con su número y cada
// mejora por su nombre del juego, en el orden en que se montan. Recibe todo lo que lleva el 'Mech,
// el equipo fijo incluido, porque muchas mejoras especiales vienen fijas en su chasis.
export const getBtBuildTags = (items: BtItem[]): BuildTag[] => {
  const tags: BuildTag[] = [];
  const jumpJets = items.filter(item => item.kind === 'jumpJet').length;
  if (jumpJets > 0) tags.push({ kind: 'jj', label: `JJ ${jumpJets}`, title: `${jumpJets} jump ${jumpJets === 1 ? 'jet' : 'jets'}` });

  const upgrades = new Map<string, number>();
  for (const item of items) if (item.kind === 'upgrade') upgrades.set(item.name, (upgrades.get(item.name) ?? 0) + 1);
  for (const [name, count] of upgrades) {
    tags.push({ kind: 'upgrade', label: count > 1 ? `${name} ×${count}` : name, title: count > 1 ? `${count} × ${name}` : name });
  }
  return tags;
};
