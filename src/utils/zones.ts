import type { ArmorState, EquippedLoadout, Zone } from '../types/mech';

export const ZONES: { zone: Zone; label: string; position: string }[] = [
  { zone: 'head', label: 'Head', position: 'head' },
  { zone: 'centerTorso', label: 'Center torso', position: 'center-torso' },
  { zone: 'leftTorso', label: 'Left torso', position: 'left-torso' },
  { zone: 'rightTorso', label: 'Right torso', position: 'right-torso' },
  { zone: 'leftArm', label: 'Left arm', position: 'left-arm' },
  { zone: 'rightArm', label: 'Right arm', position: 'right-arm' },
  { zone: 'leftLeg', label: 'Left leg', position: 'left-leg' },
  { zone: 'rightLeg', label: 'Right leg', position: 'right-leg' }
];

export const ZONE_KEYS: Zone[] = ZONES.map(({ zone }) => zone);

export const ZONE_LABELS = Object.fromEntries(ZONES.map(({ zone, label }) => [zone, label])) as Record<Zone, string>;

export const mapZones = <T>(createValue: (zone: Zone) => T): Record<Zone, T> =>
  Object.fromEntries(ZONE_KEYS.map(zone => [zone, createValue(zone)])) as Record<Zone, T>;

export const createEmptyLoadout = (): EquippedLoadout => mapZones(() => []);

export const createEmptyArmor = (): ArmorState => mapZones(() => ({ front: 0, rear: 0 }));
