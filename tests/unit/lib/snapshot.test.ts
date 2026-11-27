import { FactsSnapshotSchema, HouseholdProfileSchema } from '@shared/factsSnapshot';
import type { HouseholdProfile } from '@shared/types';
import { describe, expect, it, vi } from 'vitest';
import { AirQualityResponseSchema } from '@/features/airquality/schemas';
import { WeatherResponseSchema } from '@/features/weather/schemas';
import { buildFactsSnapshot, percentComparison, type SnapshotInput } from '@/lib/snapshot';
import { loadFixture } from '../../fixtures';

// 10 minutes after the fixtures' reading time (18:30 IST).
const NOW = new Date('2026-11-26T13:10:00Z');

const PROFILE: HouseholdProfile = HouseholdProfileSchema.parse({
  personas: ['parent', 'commuter'],
  members: [
    {
      id: 'kid-1',
      label: 'Aarav (4)',
      ageBand: 'child_2_5',
      conditions: ['asthma'],
      outdoorActivity: { kind: 'play', usualStart: '17:00', durationMin: 60 },
    },
    { id: 'dad', label: 'Dad', ageBand: 'adult_18_59', conditions: [] },
  ],
  commute: { mode: 'two_wheeler', oneWayKm: 12, daysPerWeek: 5 },
  home: { type: 'apartment', purifier: { has: true, cadrM3h: 250, roomM2: 14 } },
  masks: ['n95_ffp2'],
  language: 'en',
});

const aq = (name: 'aqDelhi' | 'aqChennai' | 'aqDerivedSevere' | 'aqDerivedNullGaps') =>
  AirQualityResponseSchema.parse(loadFixture(name));
const weather = (name: 'weatherDelhi' | 'weatherChennai') =>
  WeatherResponseSchema.parse(loadFixture(name));

function input(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    airQuality: aq('aqDelhi'),
    fetchedAt: '2026-11-26T13:05:00.000Z',
    weather: weather('weatherDelhi'),
    location: { label: 'Lucknow, Uttar Pradesh', latitude: 26.83928, longitude: 80.92313 },
    profile: PROFILE,
    now: NOW,
    ...overrides,
  };
}

describe('buildFactsSnapshot from the real Delhi fixture', () => {
  const snapshot = buildFactsSnapshot(input());

  it('validates against FactsSnapshotSchema', () => {
    const result = FactsSnapshotSchema.safeParse(snapshot);
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it('carries location (rounded to 2 dp), provenance and generation time', () => {
    expect(snapshot.location).toEqual({
      name: 'Lucknow, Uttar Pradesh',
      latRounded: 26.84,
      lonRounded: 80.92,
      timezone: 'Asia/Kolkata',
    });
    expect(snapshot.generatedAt).toBe('2026-11-26T18:40:00+05:30');
    expect(snapshot.provenance).toMatchObject({
      readingTime: '2026-11-26T18:30:00+05:30',
      fetchedAt: '2026-11-26T13:05:00.000Z',
      isModelledEstimate: true,
    });
    expect(snapshot.provenance.note).toMatch(/nearest model grid point ~45 km/);
  });

  it('rounds current values for display, CO in mg/m³', () => {
    expect(snapshot.current).toEqual({
      pm25Ugm3: 103,
      pm10Ugm3: 105,
      no2Ugm3: 93,
      so2Ugm3: 51,
      o3Ugm3: 32,
      coMgm3: 2.5,
      usAqi: 197,
      dustUgm3: 2,
      uvIndex: 0,
    });
    expect(snapshot.pm25Band).toBe('poor');
  });

  it('computes NAQI Poor from the 24 h PM2.5 mean (119.9 µg/m³)', () => {
    expect(snapshot.naqi).toMatchObject({
      value: 300,
      category: 'poor',
      dominant: 'pm25',
      isEstimate: true,
      o3Basis: '8h',
    });
    expect(snapshot.naqi?.subIndices.pm25).toBe(300);
  });

  it('finds windows after "now", within waking hours', () => {
    const { bestOutdoor, worst } = snapshot.windows;
    expect(bestOutdoor.map((w) => w.label)).toEqual(['W1', 'W2']);
    expect(worst.map((w) => w.label)).toEqual(['X1', 'X2']);
    for (const window of [...bestOutdoor, ...worst]) {
      expect(Date.parse(window.start)).toBeGreaterThan(NOW.getTime());
      expect(Number(window.start.slice(11, 13))).toBeGreaterThanOrEqual(6);
      expect(Number.isInteger(window.avgPm25Ugm3)).toBe(true);
    }
    expect(bestOutdoor[0]?.avgPm25Ugm3).toBeLessThanOrEqual(worst[0]?.avgPm25Ugm3 ?? 0);
  });

  it('rates the asthmatic child higher than the adult', () => {
    expect(snapshot.memberRisk.map((r) => [r.memberId, r.level])).toEqual([
      ['kid-1', 'very_high'],
      ['dad', 'high'],
    ]);
  });

  it('includes purifier, impact and comparison facts', () => {
    expect(snapshot.purifier).toMatchObject({ achievedAch: 6.4, requiredCadrM3h: 196 });
    expect(snapshot.impactFacts.map((f) => f.id)).toEqual(
      expect.arrayContaining(['co2_current', 'co2_metro', 'exposure_metro']),
    );
    expect(snapshot.comparisons.map((c) => c.id)).toEqual(
      expect.arrayContaining(['w1_vs_now', 'w1_vs_usual_kid_1']),
    );
  });

  it('adds weather for the current hour', () => {
    expect(snapshot.weather).toMatchObject({
      tempC: 19.1,
      humidityPct: 59,
      windKmh: 5.1,
      windDirDeg: 252,
    });
    expect(snapshot.weather?.boundaryLayerHeightM).toEqual(expect.any(Number));
  });

  it('is deterministic and never reads the clock', () => {
    const spy = vi.spyOn(Date, 'now');
    expect(buildFactsSnapshot(input())).toEqual(snapshot);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('buildFactsSnapshot edge cases', () => {
  it('keeps the state when the location has one', () => {
    const snapshot = buildFactsSnapshot(
      input({
        location: { label: 'Pune', state: 'Maharashtra', latitude: 18.52, longitude: 73.86 },
      }),
    );
    expect(snapshot.location.state).toBe('Maharashtra');
  });

  it('has no windows or W1 comparisons when "now" is after the forecast', () => {
    const snapshot = buildFactsSnapshot(input({ now: new Date('2026-12-30T00:00:00Z') }));
    expect(snapshot.windows).toEqual({ bestOutdoor: [], ventilate: [], worst: [] });
    expect(snapshot.comparisons).toEqual([]);
    expect(FactsSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('leaves hourly weather facts null when the weather hours do not line up', () => {
    const data = weather('weatherDelhi');
    const shifted = {
      ...data,
      hourly: { ...data.hourly, time: data.hourly.time.map((t) => t.replace('+05:30', '+05:45')) },
    };
    const snapshot = buildFactsSnapshot(input({ weather: shifted }));
    expect(snapshot.weather).toMatchObject({ precipProbPct: null, boundaryLayerHeightM: null });
  });
});

describe('percentComparison', () => {
  it.each([
    [60, 100, 'PM2.5 in W1 is lower than now by', 40],
    [130, 100, 'PM2.5 in W1 is higher than now by', 30],
    [100.2, 100, 'PM2.5 in W1 is about the same as now', 0],
  ])('W1 %f vs now %f', (value, reference, text, pct) => {
    expect(percentComparison('w1_vs_now', 'PM2.5 in W1', 'now', value, reference)).toEqual({
      id: 'w1_vs_now',
      text,
      value: pct,
      unit: '%',
    });
  });
});

describe('buildFactsSnapshot from other fixtures', () => {
  it('Chennai (real): PM is Good, but the 8 h O3 mean (50.6 µg/m³) makes NAQI Satisfactory', () => {
    const snapshot = buildFactsSnapshot(
      input({ airQuality: aq('aqChennai'), weather: weather('weatherChennai') }),
    );
    expect(FactsSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.naqi).toMatchObject({ value: 51, category: 'satisfactory', dominant: 'o3' });
    expect(snapshot.naqi?.subIndices.pm25).toBe(13);
    expect(snapshot.memberRisk.map((r) => r.level)).toEqual(['caution', 'low']);
    expect(snapshot.windows.ventilate.length).toBeGreaterThan(0);
  });

  it('derived severe: validates, NAQI Severe led by PM10, everyone very high risk', () => {
    const snapshot = buildFactsSnapshot(input({ airQuality: aq('aqDerivedSevere') }));
    expect(FactsSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.naqi).toMatchObject({ category: 'severe', dominant: 'pm10' });
    expect(snapshot.memberRisk.every((r) => r.level === 'very_high')).toBe(true);
    for (const window of snapshot.windows.ventilate) {
      expect(['very_poor', 'severe']).not.toContain(window.band);
    }
  });

  it('derived null gaps: validates, PM2.5 too sparse for 24 h, missing values stay null', () => {
    const snapshot = buildFactsSnapshot(input({ airQuality: aq('aqDerivedNullGaps') }));
    expect(FactsSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.naqi).not.toBeNull();
    expect(snapshot.naqi?.subIndices.pm25).toBeUndefined();
    expect(snapshot.naqi?.dominant).not.toBe('pm25');
    expect(snapshot.current.usAqi).toBeNull();
    expect(snapshot.current.dustUgm3).toBeNull();
  });

  it('without NAQI, member risk falls back to the hourly PM2.5 band', () => {
    const data = aq('aqDerivedNullGaps');
    const noPm = {
      ...data,
      hourly: { ...data.hourly, pm10Ugm3: data.hourly.pm10Ugm3.map(() => null) },
    };
    const snapshot = buildFactsSnapshot(input({ airQuality: noPm }));
    expect(snapshot.naqi).toBeNull();
    expect(snapshot.memberRisk[0]?.reasons).toContain('basis:pm25_hourly');
    expect(FactsSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('builds without weather (weather is optional)', () => {
    const snapshot = buildFactsSnapshot(input({ weather: null }));
    expect(snapshot.weather).toBeNull();
    expect(FactsSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('has no impact facts without a commute, and no purifier facts without a home', () => {
    const snapshot = buildFactsSnapshot(
      input({ profile: { ...PROFILE, commute: undefined, home: undefined } }),
    );
    expect(snapshot.impactFacts).toEqual([]);
    expect(snapshot.purifier).toBeNull();
    expect(FactsSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });
});
