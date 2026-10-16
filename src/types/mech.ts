import type { Item } from './item';

export interface Hardpoint {
  type: 'energy' | 'ballistic' | 'missile' | 'ams' | 'melee';
  size: 'small' | 'medium' | 'large';
}

export interface ComponentData {
  maxSlots: number;
  jumpJetSlots: number;
  engineHeatsinkSlots?: number;
  specialSlots?: Record<string, number>;
  maxArmor: number;
  structure: number;
  hasRearArmor: boolean;
  hardpoints: Hardpoint[];
}

export const getSlotTypeLabel = (slotType: string): string => {
  const labels: Record<string, string> = {
    EngineHeatsink_SlotType: 'Engine Heat Sink',
    ECM_SlotType: 'ECM',
    BAP_SlotType: 'Active Probe',
    AMS_SlotType: 'AMS',
    MASC_MKI_SlotType: 'Motive Upgrade MK I',
    MASC_MKII_SlotType: 'Motive Upgrade MK II',
    MASC_MKIII_SlotType: 'Motive Upgrade MK III',
    MASC_MKIV_SlotType: 'Motive Upgrade MK IV',
    MASC_MKV_SlotType: 'Motive Upgrade MK V',
    JumpJetClass1_SlotType: 'Jump Jets Class I',
    JumpJetClass2_SlotType: 'Jump Jets Class II',
    JumpJetClass3_SlotType: 'Jump Jets Class III',
    JumpJetClass4_SlotType: 'Jump Jets Class IV',
    JumpJetClass5_SlotType: 'Jump Jets Class V'
  };

  return labels[slotType] ?? slotType.replace(/_SlotType$/, '').replace(/_/g, ' ');
};

export interface MechComponents {
  head: ComponentData;
  centerTorso: ComponentData;
  leftTorso: ComponentData;
  rightTorso: ComponentData;
  leftArm: ComponentData;
  rightArm: ComponentData;
  leftLeg: ComponentData;
  rightLeg: ComponentData;
}

export interface Mech {
  id: string;
  name: string;
  variant: string;
  tonnageMax: number;
  baseTonnage: number;
  baseSpeed: number;
  BaseCoolingRate?: number;
  sarnaName?: string;
  techBase?: string;
  components: MechComponents;
}

export type EquippedLoadout = {
  head: Item[];
  centerTorso: Item[];
  leftTorso: Item[];
  rightTorso: Item[];
  leftArm: Item[];
  rightArm: Item[];
  leftLeg: Item[];
  rightLeg: Item[];
};

export type ArmorState = {
  [key: string]: { front: number; rear?: number };
};