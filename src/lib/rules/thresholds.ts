import type { AgeBand, Member, NaqiCategory, RiskLevel } from '@shared/types';

/** AQI_AND_RULES.md §6 (Breathwise convention, informed by CPCB health statements). */
export const SENSITIVE_AGE_BANDS: readonly AgeBand[] = [
  'infant_0_1',
  'child_2_5',
  'child_6_12',
  'senior_60_plus',
];

export const RISK_BY_CATEGORY: Readonly<
  Record<NaqiCategory, { general: RiskLevel; sensitive: RiskLevel }>
> = {
  good: { general: 'low', sensitive: 'low' },
  satisfactory: { general: 'low', sensitive: 'caution' },
  moderate: { general: 'caution', sensitive: 'high' },
  poor: { general: 'high', sensitive: 'very_high' },
  very_poor: { general: 'very_high', sensitive: 'very_high' },
  severe: { general: 'very_high', sensitive: 'very_high' },
};

/** Outdoor-activity guidance by risk (AQI_AND_RULES.md §6). */
export const OUTDOOR_GUIDANCE: Readonly<Record<RiskLevel, string>> = {
  low: 'Normal activity',
  caution: 'Prefer lighter exertion; use the best window',
  high: 'Short, light activity only in W1; consider an indoor alternative',
  very_high: 'Move activity indoors; essential trips only with a well-fitted N95/FFP2 (adults)',
};

/** Mask facts, not AI judgement (AQI_AND_RULES.md §6). */
export const MASK_FACTS: readonly string[] = [
  'A well-fitted N95/FFP2 respirator is the effective option against PM2.5; surgical and cloth masks offer limited protection against fine particles.',
  'No masks for infants or children under 2.',
  'People with heart or lung conditions should ask their doctor about respirator use.',
];

/** Machine-readable reasons a member is sensitive ([] for a general adult). */
export function sensitivityReasons(member: Member): string[] {
  const reasons = SENSITIVE_AGE_BANDS.includes(member.ageBand)
    ? [`sensitive:age_${member.ageBand}`]
    : [];
  return [...reasons, ...member.conditions.map((condition) => `condition:${condition}`)];
}

/** True when the member's age or health conditions make them sensitive to pollution. */
export function isSensitive(member: Member): boolean {
  return sensitivityReasons(member).length > 0;
}
