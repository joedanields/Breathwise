import { describe, expect, it } from 'vitest';
import { FactsSnapshotSchema, HouseholdProfileSchema } from '@shared/factsSnapshot';
import type { FactsSnapshot } from '@shared/types';

const profile = {
  personas: ['parent'],
  members: [
    { id: 'm1', label: 'Aarav (4)', ageBand: 'child_2_5', conditions: ['asthma'] },
    { id: 'm2', label: 'Mum', ageBand: 'adult_18_59', conditions: [] },
  ],
  commute: { mode: 'two_wheeler', oneWayKm: 12, daysPerWeek: 5 },
  masks: ['n95_ffp2'],
  language: 'en',
} as const;

function validSnapshot(): FactsSnapshot {
  return {
    version: 1,
    generatedAt: '2026-11-26T18:40:00+05:30',
    location: {
      name: 'Lucknow, Uttar Pradesh',
      latRounded: 26.84,
      lonRounded: 80.95,
      timezone: 'Asia/Kolkata',
    },
    provenance: {
      source: 'Open-Meteo Air Quality API',
      model: 'CAMS global',
      readingTime: '2026-11-26T18:30:00+05:30',
      fetchedAt: '2026-11-26T13:05:00.000Z',
      isModelledEstimate: true,
      note: 'Modelled estimate on a ~45 km grid, not a ground-station reading.',
    },
    current: {
      pm25Ugm3: 103,
      pm10Ugm3: 105,
      no2Ugm3: 93,
      so2Ugm3: 51,
      o3Ugm3: 32,
      coMgm3: 2.5,
      usAqi: 197,
      dustUgm3: 2,
      uvIndex: 0,
    },
    pm25Band: 'poor',
    naqi: {
      value: 300,
      category: 'poor',
      dominant: 'pm25',
      subIndices: { pm25: 300, pm10: 115 },
      hoursUsed: 24,
      isEstimate: true,
      o3Basis: '8h',
    },
    trend: 'rising',
    weather: null,
    windows: {
      bestOutdoor: [
        {
          label: 'W1',
          start: '2026-11-27T14:00:00+05:30',
          end: '2026-11-27T15:00:00+05:30',
          avgPm25Ugm3: 61,
          band: 'moderate',
        },
      ],
      ventilate: [],
      worst: [],
    },
    memberRisk: [
      {
        memberId: 'm1',
        level: 'very_high',
        reasons: ['sensitive:age_child_2_5', 'condition:asthma', 'category:poor'],
        outdoorGuidance: 'Move activity indoors',
      },
    ],
    purifier: null,
    impactFacts: [
      {
        id: 'co2_metro',
        category: 'co2',
        mode: 'metro',
        description: 'Switching to metro would add about 1.0 kg CO₂ a week.',
        kgCo2PerWeek: 5.2,
        kgCo2PerWeekDelta: 1,
        source: 'source',
        sourceUrl: 'https://example.org/source.pdf',
      },
      {
        id: 'exposure_metro',
        category: 'exposureBenefit',
        mode: 'metro',
        description: 'Lower exposure in metro carriages.',
        exposureRatioFrom: 1.3,
        exposureRatioTo: 0.8,
        source: 'Goel et al. 2015',
        sourceUrl: 'https://example.org/goel.pdf',
      },
    ],
    comparisons: [
      { id: 'w1_vs_now', text: 'PM2.5 in W1 is lower than now by', value: 41, unit: '%' },
    ],
    profile: HouseholdProfileSchema.parse(profile),
  };
}

describe('FactsSnapshotSchema', () => {
  it('accepts a complete snapshot', () => {
    expect(FactsSnapshotSchema.safeParse(validSnapshot()).success).toBe(true);
  });

  it('accepts missing data as null (no NAQI, no trend, no weather, null readings)', () => {
    const snapshot = {
      ...validSnapshot(),
      naqi: null,
      trend: null,
      pm25Band: null,
      current: { ...validSnapshot().current, usAqi: null, dustUgm3: null },
    };
    expect(FactsSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('rejects unknown keys, so the AI input cannot drift silently', () => {
    expect(FactsSnapshotSchema.safeParse({ ...validSnapshot(), extra: 1 }).success).toBe(false);
  });

  it('requires the modelled-estimate flag', () => {
    const snapshot = validSnapshot();
    const bad = { ...snapshot, provenance: { ...snapshot.provenance, isModelledEstimate: false } };
    expect(FactsSnapshotSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects times without an offset', () => {
    const snapshot = validSnapshot();
    const bad = {
      ...snapshot,
      provenance: { ...snapshot.provenance, readingTime: '2026-11-26T18:30' },
    };
    expect(FactsSnapshotSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an NAQI outside 0–500 and unknown categories', () => {
    const snapshot = validSnapshot();
    const naqi = snapshot.naqi;
    expect(naqi).not.toBeNull();
    if (!naqi) return;
    expect(
      FactsSnapshotSchema.safeParse({ ...snapshot, naqi: { ...naqi, value: 501 } }).success,
    ).toBe(false);
    expect(
      FactsSnapshotSchema.safeParse({ ...snapshot, naqi: { ...naqi, category: 'hazardous' } })
        .success,
    ).toBe(false);
  });

  it('requires a source URL on every impact fact', () => {
    const snapshot = validSnapshot();
    const [fact] = snapshot.impactFacts;
    const bad = { ...snapshot, impactFacts: [{ ...fact, sourceUrl: 'not a url' }] };
    expect(FactsSnapshotSchema.safeParse(bad).success).toBe(false);
  });
});

describe('HouseholdProfileSchema', () => {
  it('limits member labels to 30 characters', () => {
    const tooLong = {
      ...profile,
      members: [{ id: 'm1', label: 'x'.repeat(31), ageBand: 'adult_18_59', conditions: [] }],
    };
    expect(HouseholdProfileSchema.safeParse(tooLong).success).toBe(false);
  });

  it('accepts carAc for cars only', () => {
    const car = { ...profile, commute: { mode: 'car_petrol', carAc: 'windows_open' } };
    const bike = { ...profile, commute: { mode: 'two_wheeler', carAc: 'ac_closed' } };
    expect(HouseholdProfileSchema.safeParse(car).success).toBe(true);
    expect(HouseholdProfileSchema.safeParse(bike).success).toBe(false);
  });

  it('rejects an unknown commute mode', () => {
    const bad = { ...profile, commute: { mode: 'helicopter' } };
    expect(HouseholdProfileSchema.safeParse(bad).success).toBe(false);
  });
});
