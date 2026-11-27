import { describe, expect, it } from 'vitest';
import {
  addHoursKeepingOffset,
  formatFetchedAgo,
  formatReadingTime,
  isReadingStale,
  localHour,
  minutesBetween,
  STALE_AFTER_MINUTES,
  toIsoWithOffset,
} from '@/lib/time';

describe('toIsoWithOffset', () => {
  it.each([
    ['2026-11-26T13:30', 19800, '2026-11-26T13:30:00+05:30'],
    ['2026-11-26T00:00', 0, '2026-11-26T00:00:00+00:00'],
    ['2026-11-26T09:15', 20700, '2026-11-26T09:15:00+05:45'],
    ['2026-11-26T08:00', -12600, '2026-11-26T08:00:00-03:30'],
  ])('%s with offset %i -> %s', (local, offset, expected) => {
    expect(toIsoWithOffset(local, offset)).toBe(expected);
  });

  it('produces a string that parses to the right instant', () => {
    const iso = toIsoWithOffset('2026-11-26T13:30', 19800);
    expect(new Date(iso).toISOString()).toBe('2026-11-26T08:00:00.000Z');
  });
});

describe('addHoursKeepingOffset', () => {
  it.each([
    ['2026-11-26T18:00:00+05:30', 1, '2026-11-26T19:00:00+05:30'],
    ['2026-11-26T23:00:00+05:30', 2, '2026-11-27T01:00:00+05:30'],
    ['2026-11-26T09:15:00+05:45', -1, '2026-11-26T08:15:00+05:45'],
    ['2026-11-26T02:00:00-03:30', 3, '2026-11-26T05:00:00-03:30'],
    ['2026-11-26T02:00:00Z', 1, '2026-11-26T03:00:00Z'],
  ])('%s + %i h -> %s', (iso, hours, expected) => {
    expect(addHoursKeepingOffset(iso, hours)).toBe(expected);
  });
});

describe('localHour', () => {
  it('reads the hour as written in the location time zone', () => {
    expect(localHour('2026-11-26T18:30:00+05:30')).toBe(18);
  });
});

describe('formatReadingTime', () => {
  it('formats in the location time zone with the IST abbreviation', () => {
    expect(formatReadingTime('2026-11-26T13:30:00+05:30', 'Asia/Kolkata')).toBe(
      '26 Nov, 1:30 pm IST',
    );
  });

  it('uses the given time zone, not the machine time zone', () => {
    expect(formatReadingTime('2026-11-26T08:00:00Z', 'Asia/Kolkata')).toBe('26 Nov, 1:30 pm IST');
  });
});

describe('minutesBetween', () => {
  it('floors to whole minutes and never goes negative', () => {
    const now = new Date('2026-11-26T08:10:59Z');
    expect(minutesBetween('2026-11-26T08:00:00Z', now)).toBe(10);
    expect(minutesBetween('2026-11-26T09:00:00Z', now)).toBe(0);
  });
});

describe('formatFetchedAgo', () => {
  const fetchedAt = '2026-11-26T08:00:00.000Z';

  it.each([
    ['2026-11-26T08:00:30Z', 'fetched just now'],
    ['2026-11-26T08:01:00Z', 'fetched 1 min ago'],
    ['2026-11-26T08:45:00Z', 'fetched 45 min ago'],
    ['2026-11-26T09:00:00Z', 'fetched 1 h ago'],
    ['2026-11-26T10:20:00Z', 'fetched 2 h 20 min ago'],
  ])('at %s -> %s', (now, expected) => {
    expect(formatFetchedAgo(fetchedAt, new Date(now))).toBe(expected);
  });
});

describe('isReadingStale', () => {
  const reading = '2026-11-26T13:30:00+05:30'; // 08:00 UTC

  it('uses a 90-minute threshold', () => {
    expect(STALE_AFTER_MINUTES).toBe(90);
  });

  it('is fresh at exactly 90 minutes and stale after', () => {
    expect(isReadingStale(reading, new Date('2026-11-26T09:30:00Z'))).toBe(false);
    expect(isReadingStale(reading, new Date('2026-11-26T09:31:00Z'))).toBe(true);
  });

  it('treats an unparseable reading time as stale', () => {
    expect(isReadingStale('not a time', new Date('2026-11-26T08:00:00Z'))).toBe(true);
  });
});
