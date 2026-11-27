import type { AdvicePlan } from '@shared/advice/planSchema';
import type { FactsSnapshot } from '@shared/types';
import { AirQualityResponseSchema } from '@/features/airquality/schemas';
import { SCENARIOS } from '@/features/profile/scenarios';
import { WeatherResponseSchema } from '@/features/weather/schemas';
import { buildFactsSnapshot } from '@/lib/snapshot';
import { loadFixture } from '../fixtures';

/** A real snapshot: Delhi capture + a scenario profile, 10 min after the reading. */
export function sampleSnapshot(scenarioIndex = 0): FactsSnapshot {
  const scenario = SCENARIOS[scenarioIndex];
  if (!scenario) throw new Error('no scenario');
  return buildFactsSnapshot({
    airQuality: AirQualityResponseSchema.parse(loadFixture('aqDelhi')),
    fetchedAt: '2026-11-26T13:05:00.000Z',
    weather: WeatherResponseSchema.parse(loadFixture('weatherDelhi')),
    location: { ...scenario.location },
    profile: scenario.profile,
    now: new Date('2026-11-26T13:10:00Z'),
  });
}

/** A schema-valid plan whose only numbers come from the snapshot (W1 15:00–16:00, 44 %). */
export function samplePlan(): AdvicePlan {
  return {
    headline: 'Air is Poor today; keep Aarav indoors until W1',
    summary: 'PM2.5 is high this evening and lowest between 3 and 4 pm tomorrow (W1).',
    routine: [
      {
        id: 'play-w1',
        title: "Move Aarav's play time to W1",
        when: 'W1, 3–4 pm',
        windowRef: 'W1',
        forMembers: ['aarav'],
        category: 'activity',
        priority: 'high',
        why: 'PM2.5 in W1 is lower than now by 44%, and Aarav has asthma.',
        impact: 'Less fine-particle exposure for Aarav during play.',
      },
    ],
    indoor: [
      {
        id: 'seal',
        title: 'Keep windows closed this evening',
        forMembers: ['all'],
        category: 'sealing',
        priority: 'medium',
        why: 'Outdoor PM2.5 is in the Poor band until tomorrow afternoon.',
        impact: 'Keeps indoor air cleaner without a purifier.',
      },
    ],
    impact: [
      {
        title: 'Carpool the school run',
        health: 'Fewer car trips also mean less traffic smoke near school.',
        emissions: 'Carpooling with 2 people would cut about 2.1 kg CO₂ a week.',
        impactFactId: 'co2_carpool_2',
      },
    ],
    memberNotes: [{ memberId: 'aarav', note: 'Keep his reliever inhaler at hand.' }],
    seekCareIf: 'Wheezing that does not ease with the reliever, or breathlessness at rest.',
  };
}
