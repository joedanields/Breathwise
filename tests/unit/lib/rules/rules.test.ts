import { describe, expect, it } from 'vitest';
import { hourlyPm25Bands, pm25Band } from '@/lib/rules/bands';
import { computeTrend, TREND_THRESHOLD } from '@/lib/rules/trend';
import { durationHoursFor, findBestWindows, type HourlyPm25 } from '@/lib/rules/windows';
import { findVentilationWindows, WINDY_KMH } from '@/lib/rules/ventilation';

/** 48 hourly slots from 2026-11-27 00:00 IST; `pm` gives PM2.5 per index. */
function series(pm: (i: number) => number | null, length = 48): HourlyPm25 {
  const start = Date.parse('2026-11-27T00:00:00+05:30');
  const time = Array.from({ length }, (_, i) => {
    const local = new Date(start + i * 3_600_000 + 19_800_000).toISOString().slice(0, 19);
    return `${local}+05:30`;
  });
  return { time, pm25Ugm3: time.map((_, i) => pm(i)) };
}

const hourOf = (iso: string) => Number(iso.slice(11, 13));

describe('pm25Band (hourly signal, not NAQI)', () => {
  it.each([
    [null, null],
    [-1, null],
    [0, 'good'],
    [30, 'good'],
    [30.5, 'satisfactory'],
    [60, 'satisfactory'],
    [90, 'moderate'],
    [120, 'poor'],
    [121, 'very_poor'],
    [250, 'very_poor'],
    [251, 'severe'],
  ] as const)('%s -> %s', (value, band) => {
    expect(pm25Band(value)).toBe(band);
  });

  it('maps a series and keeps nulls', () => {
    expect(hourlyPm25Bands([20, null, 100])).toEqual(['good', null, 'poor']);
  });
});

describe('computeTrend (next 3 h vs previous 3 h, ±10 %)', () => {
  // Index 5 is "now": previous = 3,4,5; next = 6,7,8.
  const around = (prev: (number | null)[], next: (number | null)[]) => [0, 0, 0, ...prev, ...next];

  it('uses a 10 % threshold', () => {
    expect(TREND_THRESHOLD).toBe(0.1);
  });

  it.each([
    [[100, 100, 100], [111, 111, 111], 'rising'],
    [[100, 100, 100], [110, 110, 110], 'steady'], // exactly +10 % is not rising
    [[100, 100, 100], [90, 90, 90], 'steady'], // exactly −10 % is not falling
    [[100, 100, 100], [89, 89, 89], 'falling'],
    [[100, 100, 100], [105, 95, 100], 'steady'],
    [[0, 0, 0], [0, 0, 0], 'steady'],
    [[0, 0, 0], [5, 5, 5], 'rising'],
    [[100, null, 100], [150, null, 150], 'rising'], // nulls skipped
  ] as const)('prev %o, next %o -> %s', (prev, next, trend) => {
    expect(computeTrend(around([...prev], [...next]), 5)).toBe(trend);
  });

  it('is null with fewer than 2 values on either side', () => {
    expect(computeTrend(around([100, null, null], [120, 120, 120]), 5)).toBeNull();
    expect(computeTrend(around([100, 100, 100], [120, null, null]), 5)).toBeNull();
    expect(computeTrend([100, 100, 100], 2)).toBeNull(); // no future hours
  });
});

describe('findBestWindows', () => {
  it('converts activity minutes to whole hours (at least 1)', () => {
    expect(durationHoursFor(undefined)).toBe(1);
    expect(durationHoursFor(30)).toBe(1);
    expect(durationHoursFor(60)).toBe(1);
    expect(durationHoursFor(61)).toBe(2);
  });

  it('only uses waking hours (06:00–21:00)', () => {
    const hourly = series((i) => (hourOf(series(() => 0).time[i] ?? '') === 3 ? 5 : 80));
    const { best } = findBestWindows(hourly, { fromIndex: 0 });
    for (const window of best) {
      expect(hourOf(window.start)).toBeGreaterThanOrEqual(6);
      expect(hourOf(window.end)).toBeLessThanOrEqual(21);
    }
    expect(best.every((w) => w.avgPm25Ugm3 === 80)).toBe(true);
  });

  it('returns the lowest windows as W1, W2 with average and band', () => {
    const hourly = series((i) => (i === 14 ? 20 : i === 10 ? 40 : 100));
    const { best } = findBestWindows(hourly, { fromIndex: 0 });
    expect(best).toEqual([
      {
        label: 'W1',
        start: '2026-11-27T14:00:00+05:30',
        end: '2026-11-27T15:00:00+05:30',
        avgPm25Ugm3: 20,
        band: 'good',
      },
      {
        label: 'W2',
        start: '2026-11-27T10:00:00+05:30',
        end: '2026-11-27T11:00:00+05:30',
        avgPm25Ugm3: 40,
        band: 'satisfactory',
      },
    ]);
  });

  it('averages over the activity duration and never runs past 21:00', () => {
    const hourly = series((i) => (i === 20 ? 1 : i === 15 || i === 16 ? 30 : 90));
    const { best } = findBestWindows(hourly, { fromIndex: 0, durationH: 2 });
    expect(best[0]).toMatchObject({
      start: '2026-11-27T15:00:00+05:30',
      end: '2026-11-27T17:00:00+05:30',
      avgPm25Ugm3: 30,
    });
    // 20:00–22:00 would contain the 1 µg/m³ hour but ends after 21:00.
    expect(best.some((w) => w.start.includes('T20:'))).toBe(false);
  });

  it('never returns overlapping windows', () => {
    const hourly = series((i) => (i >= 12 && i <= 14 ? 10 : 90));
    const { best } = findBestWindows(hourly, { fromIndex: 0, durationH: 2 });
    expect(best).toHaveLength(2);
    const [first, second] = best;
    expect(first?.start).toBe('2026-11-27T12:00:00+05:30');
    expect(
      Date.parse(second?.start ?? '') >= Date.parse(first?.end ?? '') ||
        Date.parse(second?.end ?? '') <= Date.parse(first?.start ?? ''),
    ).toBe(true);
  });

  it('stays within the horizon and after fromIndex', () => {
    const hourly = series((i) => (i === 8 ? 1 : i === 40 ? 2 : 90)); // 08:00 today, 16:00 tomorrow
    const { best } = findBestWindows(hourly, { fromIndex: 9, horizonH: 24 });
    expect(best.map((w) => w.avgPm25Ugm3)).toEqual([90, 90]);
    const wide = findBestWindows(hourly, { fromIndex: 9, horizonH: 36 });
    expect(wide.best[0]?.start).toBe('2026-11-28T16:00:00+05:30');
  });

  it('skips windows containing missing hours', () => {
    const hourly = series((i) => (i === 10 ? null : i === 11 ? 5 : 50));
    const { best } = findBestWindows(hourly, { fromIndex: 0, durationH: 2 });
    expect(best.every((w) => !w.start.includes('T09:') && !w.start.includes('T10:'))).toBe(true);
    expect(best[0]?.start).toBe('2026-11-27T11:00:00+05:30');
  });

  it('is deterministic on an all-equal series (earliest windows first)', () => {
    const { best, worst } = findBestWindows(
      series(() => 70),
      { fromIndex: 0 },
    );
    expect(best.map((w) => w.start)).toEqual([
      '2026-11-27T06:00:00+05:30',
      '2026-11-27T07:00:00+05:30',
    ]);
    expect(worst.map((w) => w.label)).toEqual(['X1', 'X2']);
  });

  it('labels the highest windows X1, X2 to avoid', () => {
    const hourly = series((i) => (i === 19 ? 300 : i === 7 ? 200 : 50));
    const { worst } = findBestWindows(hourly, { fromIndex: 0 });
    expect(worst.map((w) => [w.label, w.avgPm25Ugm3, w.band])).toEqual([
      ['X1', 300, 'severe'],
      ['X2', 200, 'very_poor'],
    ]);
  });

  it('returns nothing when there is no data in range', () => {
    expect(
      findBestWindows(
        series(() => null),
        { fromIndex: 0 },
      ),
    ).toEqual({ best: [], worst: [] });
  });
});

describe('findVentilationWindows', () => {
  it('uses an 8 km/h wind threshold', () => {
    expect(WINDY_KMH).toBe(8);
  });

  it('returns [] when every waking hour is Very Poor or Severe', () => {
    const hourly = series((i) => (i % 2 === 0 ? 130 : 300));
    expect(findVentilationWindows(hourly, null, { fromIndex: 0 })).toEqual([]);
  });

  it('picks the lowest-PM hours as V1, V2 without weather', () => {
    const hourly = series((i) => (i === 15 ? 25 : i === 11 ? 45 : 100));
    const windows = findVentilationWindows(hourly, null, { fromIndex: 0 });
    expect(windows).toEqual([
      {
        label: 'V1',
        start: '2026-11-27T15:00:00+05:30',
        end: '2026-11-27T16:00:00+05:30',
        avgPm25Ugm3: 25,
        band: 'good',
      },
      {
        label: 'V2',
        start: '2026-11-27T11:00:00+05:30',
        end: '2026-11-27T12:00:00+05:30',
        avgPm25Ugm3: 45,
        band: 'satisfactory',
      },
    ]);
  });

  it('prefers windy hours within the same band', () => {
    const hourly = series((i) => (i === 10 ? 35 : i === 16 ? 50 : 100));
    const wind = new Map(hourly.time.map((t, i) => [t, i === 16 ? 12 : 2]));
    const [first] = findVentilationWindows(hourly, wind, { fromIndex: 0 });
    expect(first?.start).toBe('2026-11-27T16:00:00+05:30'); // windy 50 beats calm 35
  });

  it('does not let wind beat a cleaner band', () => {
    const hourly = series((i) => (i === 10 ? 20 : i === 16 ? 50 : 100));
    const wind = new Map(hourly.time.map((t, i) => [t, i === 16 ? 20 : 0]));
    const [first] = findVentilationWindows(hourly, wind, { fromIndex: 0 });
    expect(first?.start).toBe('2026-11-27T10:00:00+05:30'); // good beats satisfactory
  });

  it('skips Very Poor/Severe hours, night hours and hours beyond the horizon', () => {
    const hourly = series((i) => (i === 2 ? 5 : i === 30 ? 5 : i === 12 ? 200 : 110));
    const windows = findVentilationWindows(hourly, null, { fromIndex: 6, horizonH: 12 });
    expect(windows.every((w) => w.avgPm25Ugm3 === 110)).toBe(true);
  });
});
