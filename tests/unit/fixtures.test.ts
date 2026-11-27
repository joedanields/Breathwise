import { describe, expect, it } from 'vitest';
import { loadFixture } from '../fixtures';

// Guards the claims in tests/fixtures/README.md so the documentation can't drift.

const WINDOW_START = 19;
const CURRENT_INDEX = 42;

function trailingMean(values: (number | null)[]) {
  const window = values
    .slice(WINDOW_START, CURRENT_INDEX + 1)
    .filter((v): v is number => v !== null);
  return window.reduce((sum, v) => sum + v, 0) / window.length;
}

function hourly(name: Parameters<typeof loadFixture>[0]) {
  return loadFixture(name).hourly as {
    time: string[];
    pm2_5: (number | null)[];
    pm10: (number | null)[];
  };
}

describe('fixtures README claims', () => {
  it('index 42 is the last hour at or before the Delhi reading time', () => {
    const fixture = loadFixture('aqDelhi');
    const { time } = fixture.hourly as { time: string[] };
    expect((fixture.current as { time: string }).time).toBe('2026-11-26T18:30');
    expect(time[CURRENT_INDEX]).toBe('2026-11-26T18:00');
    expect(time[CURRENT_INDEX + 1]).toBe('2026-11-26T19:00');
  });

  it('real Delhi is not severe (24 h PM2.5 ≤ 250 and PM10 ≤ 430)', () => {
    const delhi = hourly('aqDelhi');
    expect(trailingMean(delhi.pm2_5)).toBeCloseTo(119.9, 1);
    expect(trailingMean(delhi.pm10)).toBeCloseTo(121.8, 1);
  });

  it('real Chennai: 24 h PM2.5 ≈ 7.8 (Good) but 8 h O3 ≈ 50.6 µg/m³, just over the Good edge', () => {
    const fixture = loadFixture('aqChennai');
    const chennai = fixture.hourly as { pm2_5: (number | null)[]; ozone: number[] };
    expect(trailingMean(chennai.pm2_5)).toBeCloseTo(7.8, 1);
    const ozone8h = chennai.ozone.slice(CURRENT_INDEX - 7, CURRENT_INDEX + 1);
    expect(ozone8h.reduce((sum, v) => sum + v, 0) / 8).toBeCloseTo(50.6, 1);
  });

  it('the derived severe fixture reaches the severe band', () => {
    const severe = hourly('aqDerivedSevere');
    expect(trailingMean(severe.pm2_5)).toBeCloseTo(300, 0);
    expect(trailingMean(severe.pm10)).toBeCloseTo(500, 0);
  });

  it('the null-gap fixture leaves 14 valid PM2.5 hours and 20 valid PM10 hours in the window', () => {
    const gaps = hourly('aqDerivedNullGaps');
    const valid = (values: (number | null)[]) =>
      values.slice(WINDOW_START, CURRENT_INDEX + 1).filter((v) => v !== null).length;
    expect(valid(gaps.pm2_5)).toBe(14);
    expect(valid(gaps.pm10)).toBe(20);
  });

  it('real captures contain no nulls (any nulls in tests come from derived fixtures)', () => {
    for (const name of ['aqDelhi', 'aqChennai'] as const) {
      const values = Object.values(loadFixture(name).hourly as Record<string, unknown[]>).flat();
      expect(values).not.toContain(null);
    }
  });
});
