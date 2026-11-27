import { AdvicePlanSchema } from '@shared/advice/planSchema';
import { allowedNumbers, planTexts, ungroundedNumbers } from '@shared/advice/groundingGuard';
import type { FactsSnapshot, RiskLevel } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { AirQualityResponseSchema } from '@/features/airquality/schemas';
import { buildFallbackPlan } from '@/features/advice/fallbackPlan';
import { SCENARIOS } from '@/features/profile/scenarios';
import { WeatherResponseSchema } from '@/features/weather/schemas';
import { buildFactsSnapshot } from '@/lib/snapshot';
import { loadFixture } from '../../../fixtures';
import { sampleSnapshot } from '../../../utils/advice';

type AqFixture = 'aqDelhi' | 'aqChennai' | 'aqDerivedSevere' | 'aqDerivedNullGaps';

function snapshotFor(scenarioIndex: number, aq: AqFixture): FactsSnapshot {
  const scenario = SCENARIOS[scenarioIndex];
  if (!scenario) throw new Error('no scenario');
  return buildFactsSnapshot({
    airQuality: AirQualityResponseSchema.parse(loadFixture(aq)),
    fetchedAt: '2026-11-26T13:05:00.000Z',
    weather: WeatherResponseSchema.parse(loadFixture('weatherDelhi')),
    location: scenario.location,
    profile: scenario.profile,
    now: new Date('2026-11-26T13:10:00Z'),
  });
}

const ALL: [number, AqFixture][] = [0, 1, 2, 3, 4, 5].flatMap((i) =>
  (['aqDelhi', 'aqChennai', 'aqDerivedSevere', 'aqDerivedNullGaps'] as const).map(
    (aq) => [i, aq] as [number, AqFixture],
  ),
);

describe('buildFallbackPlan', () => {
  it.each(ALL)('scenario S%i on %s: valid AdvicePlan, grounded numbers only', (i, aq) => {
    const snapshot = snapshotFor(i, aq);
    const plan = buildFallbackPlan(snapshot);
    const parsed = AdvicePlanSchema.safeParse(plan);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(ungroundedNumbers(planTexts(plan), allowedNumbers(snapshot))).toEqual([]);
  });

  it.each(['low', 'caution', 'high', 'very_high'] as RiskLevel[])(
    'gives activity advice that matches risk level %s',
    (level) => {
      const base = sampleSnapshot(0);
      const snapshot = {
        ...base,
        memberRisk: base.memberRisk.map((r) => ({ ...r, level })),
      };
      const plan = buildFallbackPlan(snapshot);
      const play = plan.routine.find((a) => a.forMembers.includes('aarav'));
      expect(play).toBeDefined();
      if (level === 'very_high') expect(play?.title).toMatch(/indoors/i);
      if (level === 'high' || level === 'caution') expect(play?.windowRef).toBe('W1');
      if (level === 'low') expect(play?.priority).toBe('low');
    },
  );

  it('suggests a clean room without a purifier, and running it when there is one', () => {
    const without = buildFallbackPlan(sampleSnapshot(0)); // S1: no purifier
    expect(
      without.indoor.some((a) => a.category === 'sealing' && /clean room/i.test(a.title)),
    ).toBe(true);
    const withPurifier = buildFallbackPlan(sampleSnapshot(1)); // S2: CADR 250, 15 m²
    const purifier = withPurifier.indoor.find((a) => a.category === 'purifier');
    expect(purifier?.why).toMatch(/6 air changes an hour/);
  });

  it('says no masks for the infant and prioritises cooking smoke with biomass', () => {
    const plan = buildFallbackPlan(sampleSnapshot(4)); // S5
    expect(plan.memberNotes.find((n) => n.memberId === 'baby')?.note).toMatch(/No mask/);
    const cooking = plan.indoor.find((a) => a.category === 'cooking');
    expect(cooking?.priority).toBe('high');
    expect(cooking?.forMembers).toEqual(expect.arrayContaining(['dadi', 'baby']));
  });

  it('notes limited protection of surgical masks and suggests N95 for adults', () => {
    const plan = buildFallbackPlan(sampleSnapshot(0)); // S1: surgical masks
    const mask = plan.routine.find((a) => a.category === 'mask');
    expect(mask?.why).toMatch(/limited protection/);
    expect(mask?.title).toMatch(/N95/);
  });

  it('cites the best CO₂ saving and the exposure fact without calling an increase a saving', () => {
    const plan = buildFallbackPlan(sampleSnapshot(2)); // S3 two-wheeler: metro adds CO₂
    expect(plan.impact.some((i) => i.impactFactId === 'co2_bus')).toBe(true);
    const metro = plan.impact.find((i) => i.impactFactId === 'exposure_metro');
    expect(metro?.health).toMatch(/0\.8×/);
    expect(metro?.emissions ?? '').not.toMatch(/sav/i);
  });

  it('asks to seek care for asthma warning signs', () => {
    expect(buildFallbackPlan(sampleSnapshot(0)).seekCareIf).toMatch(/wheez/i);
  });
});
