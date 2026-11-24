import itemsData from '../../data/yaml/items.json';
import mechsData from '../../data/yaml/mechs.json';
import quirksData from '../../data/yaml/quirks.json';
import type { YamlItem, YamlMech, YamlQuirk } from '../../types/yaml-mechlab';

export const yamlMechs = mechsData as unknown as YamlMech[];
const ITEMS = itemsData as unknown as Record<string, YamlItem>;
const QUIRKS = quirksData as unknown as Record<string, YamlQuirk>;
const MECHS_BY_ID = new Map(yamlMechs.map(mech => [mech.id, mech]));

export function findYamlMech(id: string): YamlMech | undefined {
  return MECHS_BY_ID.get(id);
}

export function getYamlItem(id: string | undefined): YamlItem | undefined {
  return id ? ITEMS[id] : undefined;
}

export function yamlItemIds(): string[] {
  return Object.keys(ITEMS);
}

export function getYamlQuirk(id: string): YamlQuirk | undefined {
  return QUIRKS[id];
}
