import type { Member, NaqiCategory, RiskLevel } from '@shared/types';
import { OUTDOOR_GUIDANCE, RISK_BY_CATEGORY, sensitivityReasons } from './thresholds';

export interface MemberRisk {
  memberId: string;
  level: RiskLevel;
  reasons: string[];
  outdoorGuidance: string;
}

/**
 * Per-member risk from the household's category (AQI_AND_RULES.md §6).
 * `basis` is 'naqi' normally, or 'pm25_hourly' when NAQI is unavailable and the
 * current hour's PM2.5 band is used instead (ARCHITECTURE.md §6). No category -> [].
 */
export function computeMemberRisk(
  members: readonly Member[],
  category: NaqiCategory | null,
  basis: 'naqi' | 'pm25_hourly',
): MemberRisk[] {
  if (category === null) return [];
  return members.map((member) => {
    const sensitive = sensitivityReasons(member);
    const level = RISK_BY_CATEGORY[category][sensitive.length > 0 ? 'sensitive' : 'general'];
    const reasons = [...sensitive, `category:${category}`];
    if (basis === 'pm25_hourly') reasons.push('basis:pm25_hourly');
    return { memberId: member.id, level, reasons, outdoorGuidance: OUTDOOR_GUIDANCE[level] };
  });
}
