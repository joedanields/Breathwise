import { describe, expect, it } from 'vitest';
import { formatMeasurement, NOT_AVAILABLE, ugm3ToMgm3 } from '@/lib/format';

describe('formatMeasurement', () => {
  it.each([
    [103.4, 'µg/m³', 0, '103 µg/m³'],
    [2471, 'µg/m³', 0, '2,471 µg/m³'],
    [19.06, '°C', 1, '19.1 °C'],
    [0, 'mm', 1, '0.0 mm'],
    [197, '', 0, '197'],
    [252, '°', 0, '252°'],
  ])('%f %s (%i dp) -> %s', (value, unit, decimals, expected) => {
    expect(formatMeasurement(value, unit, decimals)).toBe(expected);
  });

  it('shows missing values as "Not available", never 0', () => {
    expect(formatMeasurement(null, 'µg/m³')).toBe(NOT_AVAILABLE);
    expect(NOT_AVAILABLE).toBe('Not available');
  });
});

describe('ugm3ToMgm3', () => {
  it('divides by 1000 and keeps null', () => {
    expect(ugm3ToMgm3(2471)).toBe(2.471);
    expect(ugm3ToMgm3(null)).toBeNull();
  });
});
