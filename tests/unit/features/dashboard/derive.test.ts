import { describe, expect, it } from 'vitest';
import { maxPrecipProbNext12h, timelineFor } from '@/features/dashboard/derive';
import { TIMELINE_HOURS } from '@/lib/rules/timeline';
import { sampleSnapshot } from '../../../utils/advice';

const START = Date.parse('2026-11-27T00:00:00+05:30');
const hoursFrom = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    new Date(START + i * 3_600_000).toISOString().replace('.000Z', 'Z'),
  );

describe('timelineFor', () => {
  it('starts at the current hour, covers 48 hours and marks the snapshot windows', () => {
    const snapshot = sampleSnapshot();
    const time = hoursFrom(72);
    const pm25Ugm3 = time.map((_, i) => 40 + i);
    const window = {
      label: 'W1',
      start: time[5] ?? '',
      end: time[7] ?? '',
      avgPm25Ugm3: 46,
      band: 'satisfactory' as const,
    };
    const withWindow = {
      ...snapshot,
      windows: { bestOutdoor: [window], ventilate: [], worst: [] },
    };

    const hours = timelineFor(withWindow, { time, pm25Ugm3 }, new Date(START + 2.5 * 3_600_000));

    expect(hours).toHaveLength(TIMELINE_HOURS);
    expect(hours[0]?.pm25Ugm3).toBe(42);
    expect(hours.filter((h) => h.labels.includes('W1')).map((h) => h.pm25Ugm3)).toEqual([45, 46]);
  });
});

describe('maxPrecipProbNext12h', () => {
  const time = hoursFrom(24);

  it('returns the highest chance of rain in the next 12 hours, ignoring gaps', () => {
    const precipProbPct = time.map((_, i) => (i === 3 ? null : i === 10 ? 80 : i === 20 ? 99 : 10));
    expect(maxPrecipProbNext12h({ time, precipProbPct }, new Date(START + 1_000))).toBe(80);
  });

  it('is null when every value is missing', () => {
    const precipProbPct = time.map(() => null);
    expect(maxPrecipProbNext12h({ time, precipProbPct }, new Date(START))).toBeNull();
  });

  it('starts from the first hour when every hour is in the past', () => {
    const precipProbPct = time.map((_, i) => (i === 0 ? 30 : 0));
    expect(maxPrecipProbNext12h({ time, precipProbPct }, new Date(START + 48 * 3_600_000))).toBe(
      30,
    );
  });
});
