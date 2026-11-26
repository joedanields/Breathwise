import { describe, expect, it } from 'vitest';
import { formatCoordinates, roundCoordinate } from '@/lib/coords';

describe('roundCoordinate', () => {
  it.each([
    [28.613939, 28.61],
    [77.209023, 77.21],
    [18.5261, 18.53],
    [-12.3449, -12.34],
    [0, 0],
  ])('%f -> %f', (value, expected) => {
    expect(roundCoordinate(value)).toBe(expected);
  });
});

describe('formatCoordinates', () => {
  it('shows two decimals, latitude first', () => {
    expect(formatCoordinates(28.6, 77.209023)).toBe('28.60, 77.21');
  });
});
