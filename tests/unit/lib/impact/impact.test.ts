import type { CommuteMode, HouseholdProfile, ImpactFact } from '@shared/types';
import { ImpactFactSchema } from '@shared/factsSnapshot';
import { describe, expect, it } from 'vitest';
import { commuteImpactFacts, weeklyCommuteKg } from '@/lib/impact/commuteEmissions';
import {
  CEA_GRID_KG_CO2_PER_KWH,
  EMISSION_FACTORS,
  METRO_KWH_PER_PKM,
} from '@/lib/impact/emissionFactors';
import { hasExposureBenefit, IN_TRANSIT_EXPOSURE_RATIO } from '@/lib/impact/exposure';

type Commute = NonNullable<HouseholdProfile['commute']>;
const MODES: CommuteMode[] = [
  'walk',
  'cycle',
  'two_wheeler',
  'car_petrol',
  'car_diesel',
  'car_cng',
  'auto_rickshaw',
  'bus',
  'metro',
  'wfh',
];

function co2(facts: ImpactFact[], id: string) {
  const fact = facts.find((f) => f.id === id);
  if (fact?.category !== 'co2') throw new Error(`no co2 fact ${id}`);
  return fact;
}

describe('EMISSION_FACTORS (AQI_AND_RULES.md §8)', () => {
  it('has a factor for every commute mode', () => {
    expect(Object.keys(EMISSION_FACTORS).sort()).toEqual([...MODES].sort());
  });

  it.each([
    ['car_petrol', 0.14, 'vehicle_km'],
    ['car_diesel', 0.126, 'vehicle_km'],
    ['car_cng', 0.068, 'vehicle_km'],
    ['two_wheeler', 0.0368, 'vehicle_km'],
    ['auto_rickshaw', 0.10768, 'vehicle_km'],
    ['bus', 0.015161, 'passenger_km'],
    ['walk', 0, 'none'],
    ['cycle', 0, 'none'],
    ['wfh', 0, 'none'],
  ] as const)('%s = %f kg CO2/km per %s', (mode, value, basis) => {
    expect(EMISSION_FACTORS[mode].kgCo2PerKm).toBe(value);
    expect(EMISSION_FACTORS[mode].basis).toBe(basis);
  });

  it('computes metro from UNEP-DTU energy intensity × CEA v22.0 grid factor', () => {
    expect(METRO_KWH_PER_PKM).toBeCloseTo(0.061 / 0.943, 12);
    expect(CEA_GRID_KG_CO2_PER_KWH).toBe(0.675);
    expect(EMISSION_FACTORS.metro.kgCo2PerKm).toBeCloseTo(0.0437, 4);
    expect(EMISSION_FACTORS.metro.basis).toBe('passenger_km');
    expect(EMISSION_FACTORS.metro.note).toMatch(/tailpipe/);
  });

  it('gives every factor a source and an https URL', () => {
    for (const mode of MODES) {
      const factor = EMISSION_FACTORS[mode];
      expect(factor.source.length).toBeGreaterThan(10);
      expect(factor.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it('flags that the CNG car row is a smaller class than the petrol and diesel rows', () => {
    expect(EMISSION_FACTORS.car_cng.note).toMatch(/<800 cc/);
  });
});

describe('weeklyCommuteKg = factor × one-way km × 2 × days ÷ occupants', () => {
  it('divides vehicle-km factors by occupants', () => {
    expect(weeklyCommuteKg('car_petrol', 10, 5)).toBeCloseTo(14, 10);
    expect(weeklyCommuteKg('car_petrol', 10, 5, 2)).toBeCloseTo(7, 10);
    expect(weeklyCommuteKg('two_wheeler', 12, 6)).toBeCloseTo(0.0368 * 144, 10);
  });

  it('never divides passenger-km factors by occupants', () => {
    expect(weeklyCommuteKg('bus', 10, 5, 3)).toBeCloseTo(1.5161, 10);
  });

  it('is zero for walking, cycling and working from home', () => {
    expect(weeklyCommuteKg('walk', 5, 5)).toBe(0);
    expect(weeklyCommuteKg('wfh', 0, 5)).toBe(0);
  });
});

describe('commuteImpactFacts: signed weekly deltas vs the current mode', () => {
  const car: Commute = { mode: 'car_petrol', oneWayKm: 10, daysPerWeek: 5 };

  it('reports the current commute with a zero delta', () => {
    expect(co2(commuteImpactFacts(car), 'co2_current')).toMatchObject({
      mode: 'car_petrol',
      kgCo2PerWeek: 14,
      kgCo2PerWeekDelta: 0,
    });
  });

  it('a saving has a negative delta and is described as a cut', () => {
    const facts = commuteImpactFacts(car);
    const carpool = co2(facts, 'co2_carpool_2');
    expect(carpool.kgCo2PerWeek).toBe(7);
    expect(carpool.kgCo2PerWeekDelta).toBe(-7);
    expect(carpool.description).toMatch(/cut about 7 kg CO₂ a week/);
    const metro = co2(facts, 'co2_metro');
    expect(metro.kgCo2PerWeekDelta).toBeLessThan(0);
    expect(metro.description).toMatch(/power-station emissions; road figures count tailpipe only/);
  });

  it('an increase has a positive delta and is never called a saving', () => {
    const walk: Commute = { mode: 'walk', oneWayKm: 5, daysPerWeek: 5 };
    const bus = co2(commuteImpactFacts(walk), 'co2_bus');
    expect(bus.kgCo2PerWeekDelta).toBeCloseTo(0.76, 2);
    expect(bus.kgCo2PerWeekDelta).toBeGreaterThan(0);
    expect(bus.description).toMatch(/add about 0\.76 kg CO₂ a week/);
    expect(bus.description).toMatch(/not a CO₂ saving/);
    expect(bus.description).not.toMatch(/\bcut\b|\bsave/i);
  });

  it('equal emissions have a zero delta and say "about the same"', () => {
    const walk: Commute = { mode: 'walk', oneWayKm: 5, daysPerWeek: 5 };
    const wfh = co2(commuteImpactFacts(walk), 'co2_wfh_extra_day');
    expect(wfh.kgCo2PerWeekDelta).toBe(0);
    expect(wfh.description).toMatch(/about the same/);
    expect(wfh.description).not.toMatch(/\bcut\b|\badd\b/);
  });

  it('offers carpooling only for cars, and no switch to the current mode', () => {
    const ids = (commute: Commute) => commuteImpactFacts(commute).map((f) => f.id);
    expect(ids(car)).toContain('co2_carpool_3');
    expect(ids({ mode: 'bus', oneWayKm: 8, daysPerWeek: 5 })).not.toContain('co2_carpool_2');
    expect(ids({ mode: 'bus', oneWayKm: 8, daysPerWeek: 5 })).not.toContain('co2_bus');
  });

  it('working from home one more day removes one day of commuting', () => {
    expect(co2(commuteImpactFacts(car), 'co2_wfh_extra_day').kgCo2PerWeek).toBeCloseTo(11.2, 10);
  });

  it('produces no facts without distance or days, or when already working from home', () => {
    expect(commuteImpactFacts(undefined)).toEqual([]);
    expect(commuteImpactFacts({ mode: 'car_petrol', daysPerWeek: 5 })).toEqual([]);
    expect(commuteImpactFacts({ mode: 'car_petrol', oneWayKm: 10 })).toEqual([]);
    expect(commuteImpactFacts({ mode: 'wfh', oneWayKm: 0.1, daysPerWeek: 5 })).toEqual([]);
  });

  it('every fact validates against the shared schema', () => {
    for (const mode of MODES.filter((m) => m !== 'wfh')) {
      for (const fact of commuteImpactFacts({ mode, oneWayKm: 9.5, daysPerWeek: 4 })) {
        expect(ImpactFactSchema.safeParse(fact).success).toBe(true);
      }
    }
  });
});

describe('exposureBenefit facts (Goel et al. 2015)', () => {
  it.each([
    [1.3, 0.8, false, true], // two-wheeler -> metro
    [1.3, 1.2, false, false], // two-wheeler -> bus: still above ambient
    [0.8, 0.8, false, false], // no improvement
    [1.1, null, false, false], // unknown destination ratio
    [1.1, null, true, true], // trip removed (WFH)
  ] as const)(
    'hasExposureBenefit(%f -> %s, removesTrip %s) = %s',
    (from, to, removes, expected) => {
      expect(hasExposureBenefit(from, to, removes)).toBe(expected);
    },
  );

  it('records in-transit to ambient PM2.5 ratios from the study', () => {
    expect(IN_TRANSIT_EXPOSURE_RATIO).toMatchObject({
      walk: 1.4,
      cycle: 1.1,
      two_wheeler: 1.3,
      auto_rickshaw: 1.3,
      bus: 1.2,
      metro: 0.8,
      car_petrol: null,
      wfh: null,
    });
  });

  it('adds the health case for metro over a two-wheeler even though metro is not a CO₂ case here', () => {
    const facts = commuteImpactFacts({ mode: 'two_wheeler', oneWayKm: 10, daysPerWeek: 5 });
    const exposure = facts.find((f) => f.id === 'exposure_metro');
    expect(exposure).toMatchObject({
      category: 'exposureBenefit',
      mode: 'metro',
      exposureRatioFrom: 1.3,
      exposureRatioTo: 0.8,
    });
    expect(co2(facts, 'co2_metro').kgCo2PerWeekDelta).toBeGreaterThan(0);
  });

  it('does not claim an exposure benefit for buses (above ambient in the study)', () => {
    const facts = commuteImpactFacts({ mode: 'two_wheeler', oneWayKm: 10, daysPerWeek: 5 });
    expect(facts.some((f) => f.id === 'exposure_bus')).toBe(false);
  });

  it('notes the exposure avoided by working from home one more day', () => {
    const facts = commuteImpactFacts({ mode: 'walk', oneWayKm: 3, daysPerWeek: 5 });
    expect(facts.find((f) => f.id === 'exposure_wfh_extra_day')).toMatchObject({
      exposureRatioFrom: 1.4,
      exposureRatioTo: null,
    });
  });

  it('makes no exposure claim when the current mode is a car (AC status unknown)', () => {
    const facts = commuteImpactFacts({ mode: 'car_diesel', oneWayKm: 10, daysPerWeek: 5 });
    expect(facts.filter((f) => f.category === 'exposureBenefit')).toEqual([]);
  });
});
