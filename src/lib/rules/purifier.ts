import type { HouseholdProfile } from '@shared/types';

/** AQI_AND_RULES.md §7 (Breathwise convention: rule of thumb, not a standard). */
export const DEFAULT_CEILING_HEIGHT_M = 2.8;
export const TARGET_ACH = 5;

/** Purifier facts for the snapshot: room size, air changes per hour and the CADR needed. */
export interface PurifierFacts {
  has: boolean;
  roomM2: number | null;
  ceilingHeightM: number;
  targetAch: number;
  /** CADR needed for the target: room volume × target ACH, m³/h. */
  requiredCadrM3h: number | null;
  cadrM3h: number | null;
  /** Air changes per hour the user's purifier achieves: CADR / room volume. */
  achievedAch: number | null;
}

/** Purifier facts for the AI and fallback plan. `null` when the home is unknown. */
export function purifierFacts(home: HouseholdProfile['home']): PurifierFacts | null {
  if (!home) return null;
  const has = home.purifier?.has ?? false;
  const roomM2 = home.purifier?.roomM2 ?? null;
  const cadrM3h = has ? (home.purifier?.cadrM3h ?? null) : null;
  const volumeM3 = roomM2 === null ? null : roomM2 * DEFAULT_CEILING_HEIGHT_M;
  return {
    has,
    roomM2,
    ceilingHeightM: DEFAULT_CEILING_HEIGHT_M,
    targetAch: TARGET_ACH,
    requiredCadrM3h: volumeM3 === null ? null : Math.round(volumeM3 * TARGET_ACH),
    cadrM3h,
    achievedAch:
      volumeM3 === null || cadrM3h === null ? null : Math.round((cadrM3h / volumeM3) * 10) / 10,
  };
}
