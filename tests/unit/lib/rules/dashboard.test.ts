import type { TimeWindow } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { forecastHours, TIMELINE_HOURS } from '@/lib/rules/timeline';
import { weatherContext } from '@/lib/rules/weatherContext';

describe('weatherContext (rules, not AI)', () => {
  const calm = { windKmh: 3, humidityPct: 60, maxPrecipProbPct: 10, boundaryLayerHeightM: 600 };

  it.each([
    [{ ...calm }, ['Calm air is letting pollution build up near the ground.']],
    [
      { ...calm, boundaryLayerHeightM: 150 },
      [
        'A low mixing layer is trapping pollution near the ground.',
        'Calm air is letting pollution build up near the ground.',
      ],
    ],
    [{ ...calm, windKmh: 15, humidityPct: 85 }, ['Humid air can make haze linger.']],
    [{ ...calm, windKmh: 15, maxPrecipProbPct: 70 }, ['Rain later may help clear the air.']],
    [{ ...calm, windKmh: 15 }, ['A steady breeze is helping disperse pollution.']],
  ])('%o -> %o', (input, sentences) => {
    expect(weatherContext(input)).toEqual(sentences);
  });

  it('gives at most two sentences and ignores missing values', () => {
    expect(
      weatherContext({
        windKmh: 2,
        humidityPct: 90,
        maxPrecipProbPct: 80,
        boundaryLayerHeightM: 100,
      }),
    ).toHaveLength(2);
    expect(
      weatherContext({
        windKmh: null,
        humidityPct: null,
        maxPrecipProbPct: null,
        boundaryLayerHeightM: null,
      }),
    ).toEqual([]);
  });
});

describe('forecastHours', () => {
  const time = Array.from({ length: 60 }, (_, i) => {
    const iso = new Date(Date.parse('2026-11-27T00:00:00Z') + i * 3_600_000)
      .toISOString()
      .slice(0, 19);
    return `${iso}+05:30`;
  });
  const pm = time.map((_, i) => (i === 5 ? null : 40 + i));
  const w1: TimeWindow = {
    label: 'W1',
    start: time[10] ?? '',
    end: time[12] ?? '',
    avgPm25Ugm3: 50,
    band: 'satisfactory',
  };
  const v1: TimeWindow = { ...w1, label: 'V1', start: time[11] ?? '', end: time[12] ?? '' };

  it('returns 48 hours from the start index with bands and window labels', () => {
    const hours = forecastHours({ time, pm25Ugm3: pm }, 2, [w1, v1]);
    expect(TIMELINE_HOURS).toBe(48);
    expect(hours).toHaveLength(48);
    expect(hours[0]).toEqual({ time: time[2], pm25Ugm3: 42, band: 'satisfactory', labels: [] });
    expect(hours[3]).toMatchObject({ pm25Ugm3: null, band: null }); // index 5: missing stays null
    expect(hours[8]?.labels).toEqual(['W1']); // index 10
    expect(hours[9]?.labels).toEqual(['W1', 'V1']); // index 11
    expect(hours[10]?.labels).toEqual([]); // index 12: window end is exclusive
  });

  it('stops at the end of the data', () => {
    expect(forecastHours({ time, pm25Ugm3: pm }, 50, [])).toHaveLength(10);
    expect(forecastHours({ time, pm25Ugm3: pm }, -1, [])).toHaveLength(48);
  });
});
