import { describe, expect, it } from 'vitest';
import {
  computeAverages,
  CO_UGM3_PER_MGM3,
  currentHourIndex,
  trailingMean,
} from '@/lib/aqi/averages';
import { BREAKPOINTS, O3_ONE_HOUR_SWITCH_UGM3, POLLUTANTS, subIndex } from '@/lib/aqi/breakpoints';
import { categoryForIndex, CATEGORY_LABELS } from '@/lib/aqi/categories';
import { computeNaqi, type PollutantAverages } from '@/lib/aqi/naqi';

// Published upper edges of each band (CPCB 2014, Table 3.11) and the Severe-band
// upper bound (CPCB-adjacent calculator, convention). Index edges: 50,100,200,300,400,500.
const EDGES = {
  pm10: [50, 100, 250, 350, 430, 510],
  pm25: [30, 60, 90, 120, 250, 380],
  no2: [40, 80, 180, 280, 400, 520],
  o3: [50, 100, 168, 208, 748, 1000],
  co: [1, 2, 10, 17, 34, 50],
  so2: [40, 80, 380, 800, 1600, 2620],
} as const;
const INDEX_EDGES = [50, 100, 200, 300, 400, 500] as const;

describe('breakpoints (CPCB 2014 Table 3.11)', () => {
  it('covers the six NAQI pollutants with six contiguous segments each', () => {
    expect(POLLUTANTS).toEqual(['pm25', 'pm10', 'no2', 'o3', 'co', 'so2']);
    for (const pollutant of POLLUTANTS) {
      const segments = BREAKPOINTS[pollutant];
      expect(segments).toHaveLength(6);
      segments.forEach((segment, i) => {
        expect(segment.cHi).toBe(EDGES[pollutant][i]);
        expect(segment.iHi).toBe(INDEX_EDGES[i]);
        expect(segment.cLo).toBe(i === 0 ? 0 : EDGES[pollutant][i - 1]);
      });
    }
  });

  const edgeCases = POLLUTANTS.flatMap((pollutant) =>
    EDGES[pollutant].map(
      (concentration, i) => [pollutant, concentration, INDEX_EDGES[i] ?? Number.NaN] as const,
    ),
  );

  it.each(edgeCases)('%s at %f -> sub-index %i (band edge)', (pollutant, concentration, index) => {
    expect(subIndex(pollutant, concentration)).toBeCloseTo(index, 9);
  });

  it.each([
    ['pm25', 45, 75], // CPCB worked example
    ['pm25', 0, 0],
    ['pm25', 75, 150],
    ['pm25', 315, 450],
    ['pm10', 175, 150],
    ['no2', 340, 350],
    ['o3', 188, 250],
    ['so2', 1200, 350],
    ['co', 6, 150],
  ] as const)('%s at %f -> %f (mid-band interpolation)', (pollutant, concentration, index) => {
    expect(subIndex(pollutant, concentration)).toBeCloseTo(index, 9);
  });

  it('starts the next band just above an edge (continuous, no gaps)', () => {
    expect(Math.round(subIndex('pm25', 30.5) ?? Number.NaN)).toBe(51);
  });

  it.each([
    ['pm25', 381],
    ['pm25', 999],
    ['pm10', 600],
    ['co', 50.1],
    ['so2', 5000],
  ] as const)('caps %s at %f to 500', (pollutant, concentration) => {
    expect(subIndex(pollutant, concentration)).toBe(500);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('returns null for %f', (concentration) => {
    expect(subIndex('pm25', concentration)).toBeNull();
  });

  it('switches O3 to the 1-hour value above 208 µg/m³ (Table 3.11 footnote)', () => {
    expect(O3_ONE_HOUR_SWITCH_UGM3).toBe(208);
  });
});

describe('categoryForIndex', () => {
  it.each([
    [0, 'good'],
    [50, 'good'],
    [50.4, 'good'],
    [50.5, 'satisfactory'],
    [100, 'satisfactory'],
    [101, 'moderate'],
    [200, 'moderate'],
    [201, 'poor'],
    [300, 'poor'],
    [301, 'very_poor'],
    [400, 'very_poor'],
    [401, 'severe'],
    [500, 'severe'],
  ] as const)('%f -> %s', (index, category) => {
    expect(categoryForIndex(index)).toBe(category);
  });

  it('has a label for every category', () => {
    expect(CATEGORY_LABELS.very_poor).toBe('Very Poor');
  });
});

describe('averages', () => {
  it('converts CO from µg/m³ to mg/m³ (2500 µg/m³ -> 2.5 mg/m³ -> index ≈ 106)', () => {
    expect(CO_UGM3_PER_MGM3).toBe(1000);
    const coMgm3 = 2500 / CO_UGM3_PER_MGM3;
    expect(coMgm3).toBe(2.5);
    expect(Math.round(subIndex('co', coMgm3) ?? Number.NaN)).toBe(106);
  });

  it('trailingMean ignores nulls and needs the minimum number of valid hours', () => {
    const values = [10, null, 30, 50];
    expect(trailingMean(values, 3, 4, 3)).toEqual({ value: 30, validHours: 3 });
    expect(trailingMean(values, 3, 4, 4)).toEqual({ value: null, validHours: 3 });
  });

  it('trailingMean never reads before the start of the series', () => {
    expect(trailingMean([10, 20], 1, 24, 2)).toEqual({ value: 15, validHours: 2 });
    expect(trailingMean([10, 20], -1, 24, 1)).toEqual({ value: null, validHours: 0 });
  });

  it('finds the last hour at or before the reading time', () => {
    const times = [
      '2026-11-26T17:00:00+05:30',
      '2026-11-26T18:00:00+05:30',
      '2026-11-26T19:00:00+05:30',
    ];
    expect(currentHourIndex(times, '2026-11-26T18:30:00+05:30')).toBe(1);
    expect(currentHourIndex(times, '2026-11-26T19:00:00+05:30')).toBe(2);
    expect(currentHourIndex(times, '2026-11-26T16:59:00+05:30')).toBe(-1);
  });

  function hourly(length: number, fill: (i: number) => number | null) {
    const values = Array.from({ length }, (_, i) => fill(i));
    return {
      time: Array.from(
        { length },
        (_, i) => `2026-11-26T${String(i).padStart(2, '0')}:00:00+05:30`,
      ),
      pm25Ugm3: values,
      pm10Ugm3: values,
      no2Ugm3: values,
      so2Ugm3: values,
      o3Ugm3: values,
      coUgm3: values.map((v) => (v === null ? null : v * 1000)),
    };
  }

  it('uses 24 h for PM, NO2, SO2 (≥ 16 valid) and 8 h for O3, CO (≥ 6 valid)', () => {
    const averages = computeAverages(
      hourly(24, () => 40),
      23,
    );
    expect(averages.pm25).toEqual({ value: 40, validHours: 24, windowHours: 24 });
    expect(averages.o3).toEqual({ value: 40, validHours: 8, windowHours: 8 });
    expect(averages.co.value).toBe(40); // mg/m³
    expect(averages.o3LatestHourUgm3).toBe(40);
  });

  it('marks a 24 h average invalid with only 15 valid hours, valid with 16', () => {
    const fifteen = computeAverages(
      hourly(24, (i) => (i < 9 ? null : 50)),
      23,
    );
    const sixteen = computeAverages(
      hourly(24, (i) => (i < 8 ? null : 50)),
      23,
    );
    expect(fifteen.pm25.value).toBeNull();
    expect(fifteen.pm25.validHours).toBe(15);
    expect(sixteen.pm25.value).toBe(50);
  });

  it('marks an 8 h average invalid with only 5 valid hours', () => {
    const averages = computeAverages(
      hourly(24, (i) => (i >= 16 && i < 19 ? null : 20)),
      23,
    );
    expect(averages.o3.validHours).toBe(5);
    expect(averages.o3.value).toBeNull();
  });
});

function avg(value: number | null, validHours = 24) {
  return { value, validHours, windowHours: 24 };
}

function averagesWith(values: Partial<Record<string, number | null>>): PollutantAverages {
  return {
    pm25: avg(values.pm25 ?? null),
    pm10: avg(values.pm10 ?? null),
    no2: avg(values.no2 ?? null),
    so2: avg(values.so2 ?? null),
    o3: avg(values.o3 ?? null, 8),
    co: avg(values.co ?? null, 8),
    o3LatestHourUgm3: values.o3Hour ?? null,
  };
}

describe('computeNaqi', () => {
  it('takes the worst sub-index as the NAQI and names the dominant pollutant', () => {
    const result = computeNaqi(averagesWith({ pm25: 120, pm10: 175, no2: 40 }));
    expect(result).toEqual({
      value: 300,
      category: 'poor',
      dominant: 'pm25',
      subIndices: { pm25: 300, pm10: 150, no2: 50 },
      hoursUsed: 24,
      o3Basis: null,
    });
  });

  it('is null with fewer than 3 valid pollutants', () => {
    expect(computeNaqi(averagesWith({ pm25: 50, pm10: 60 }))).toBeNull();
  });

  it('is null without PM2.5 or PM10, even with 4 pollutants', () => {
    expect(computeNaqi(averagesWith({ no2: 50, so2: 50, o3: 50, co: 1 }))).toBeNull();
  });

  it('is valid with PM10 as the only PM', () => {
    expect(computeNaqi(averagesWith({ pm10: 100, no2: 40, so2: 40 }))?.value).toBe(100);
  });

  it('caps the overall value at 500', () => {
    expect(computeNaqi(averagesWith({ pm25: 900, pm10: 100, no2: 40 }))?.value).toBe(500);
  });

  it('breaks ties deterministically: PM2.5, PM10, NO2, O3, CO, SO2', () => {
    // pm10 100 and no2 80 and so2 80 all give exactly 100.
    expect(computeNaqi(averagesWith({ pm10: 100, no2: 80, so2: 80 }))?.dominant).toBe('pm10');
    expect(computeNaqi(averagesWith({ pm25: 60, pm10: 100, no2: 80 }))?.dominant).toBe('pm25');
    expect(computeNaqi(averagesWith({ pm10: 50, so2: 80, co: 2 }))?.dominant).toBe('co');
  });

  it('reports the fewest valid hours among the pollutants used', () => {
    const averages = { ...averagesWith({ pm25: 40, pm10: 60, no2: 30 }), pm10: avg(60, 17) };
    expect(computeNaqi(averages)?.hoursUsed).toBe(17);
  });

  it('uses the 8-hour O3 value up to 208 µg/m³', () => {
    const result = computeNaqi(averagesWith({ pm25: 20, pm10: 20, o3: 208, o3Hour: 400 }));
    expect(result?.subIndices.o3).toBe(300);
    expect(result?.o3Basis).toBe('8h');
  });

  it('switches O3 to the latest 1-hour value above 208 µg/m³', () => {
    const result = computeNaqi(averagesWith({ pm25: 20, pm10: 20, o3: 209, o3Hour: 478 }));
    expect(result?.subIndices.o3).toBe(350);
    expect(result?.o3Basis).toBe('1h');
  });

  it('keeps the 8-hour O3 value above 208 when no 1-hour value exists', () => {
    const result = computeNaqi(averagesWith({ pm25: 20, pm10: 20, o3: 478 }));
    expect(result?.subIndices.o3).toBe(350);
    expect(result?.o3Basis).toBe('8h');
  });
});
