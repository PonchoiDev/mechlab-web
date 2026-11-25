import colorsData from '../../data/yaml/colors.json';
import itemsData from '../../data/yaml/items.json';
import mechsData from '../../data/yaml/mechs.json';
import quirksData from '../../data/yaml/quirks.json';
import slotsData from '../../data/yaml/slots.json';
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

// Tipos de ranura propios que restan de las generales (SlotTypeRelevantForCritCalc de YAML), por nombre en
// minúsculas: su tamaño y si cuentan ese tamaño en vez de los Slots de la pieza montada (ignoreEquipSlots).
export interface YamlSlotTypeData {
  size: number;
  ignoreItemSlots?: boolean;
}
const slotTypes = slotsData as Record<string, YamlSlotTypeData>;

export function getYamlSlotType(slotType: string): YamlSlotTypeData | undefined {
  return slotTypes[slotType.toLowerCase()];
}

export function getYamlQuirk(id: string): YamlQuirk | undefined {
  return QUIRKS[id];
}

// Los colores del mechlab de YAML con sus ajustes por defecto (tools/generar_yaml.py, construir_colores):
// cada pieza interna del color de su ranura, las armas del de su tipo de ranura y el resto del equipo de las
// ranuras generales del color general, salvo que tenga uno propio.
interface YamlColors {
  general: string;
  tintOpacity: number;
  slots: Record<string, { name: string; color: string }>;
  hardpoints: Record<string, string>;
}

export const YAML_COLORS = colorsData as YamlColors;
// Los MDA escriben a veces el tipo de ranura en minúsculas (cockpit, y el asset es Cockpit).
const SLOT_COLORS = new Map(Object.entries(YAML_COLORS.slots).map(([slotType, slot]) => [slotType.toLowerCase(), slot.color]));

export function getSlotColor(slotType: string): string | undefined {
  return SLOT_COLORS.get(slotType.toLowerCase());
}

export function getItemColor(id: string, slotType = 'General_SlotType'): string {
  const item = ITEMS[id];
  if (item?.kind === 'weapon') return (item.slotType && getSlotColor(item.slotType)) ?? YAML_COLORS.hardpoints[item.hardpoint ?? ''] ?? YAML_COLORS.general;
  if (item?.color) return item.color;
  return slotType === 'General_SlotType' ? YAML_COLORS.general : getSlotColor(slotType) ?? YAML_COLORS.general;
}

// El logo del mod de cada pieza («YA ML», «YA EC»...), como en el mechlab del juego. No lo llevan las del juego
// base ni las piezas estándar fijas de YAML (Armor Standard, Standard Engine...), que el juego enseña sin él.
export function getModLogo(id: string | undefined): string | undefined {
  const item = id ? ITEMS[id] : undefined;
  const mod = item && !item.fixed ? item.mod : undefined;
  return mod ? `${import.meta.env.BASE_URL}mechlab/yaml/mods/${mod}.png` : undefined;
}
