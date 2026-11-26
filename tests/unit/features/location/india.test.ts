import { describe, expect, it } from 'vitest';
import {
  INDIA_BOUNDS,
  isIndiaCountryCode,
  isWithinIndiaBounds,
  resolveGpsLocation,
} from '@/features/location/india';
import { ReverseGeocodeResponseSchema } from '@/features/location/schemas';
import { err, ok } from '@/lib/result';
import { loadFixture } from '../../../fixtures';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const KATHMANDU = { latitude: 27.7172, longitude: 85.324 };
const DELHI = { latitude: 28.6139, longitude: 77.209 };
const LONDON = { latitude: 51.5072, longitude: -0.1276 };

const pune = ReverseGeocodeResponseSchema.parse(loadFixture('reverseGeocodePune'));
const kathmandu = ReverseGeocodeResponseSchema.parse(loadFixture('reverseGeocodeKathmandu'));
const failure = err({ kind: 'network', message: 'offline' } as const);

describe('isIndiaCountryCode', () => {
  it.each([
    ['IN', true],
    ['NP', false],
    [null, false],
  ])('%s -> %s', (code, expected) => {
    expect(isIndiaCountryCode(code)).toBe(expected);
  });
});

describe('isWithinIndiaBounds (ADR-010)', () => {
  it('uses lat 6–37.5, lon 68–97.5', () => {
    expect(INDIA_BOUNDS).toEqual({
      minLatitude: 6,
      maxLatitude: 37.5,
      minLongitude: 68,
      maxLongitude: 97.5,
    });
  });

  it.each([
    [DELHI, true],
    [PUNE, true],
    [{ latitude: 8.08, longitude: 77.55 }, true], // Kanyakumari
    [{ latitude: 6, longitude: 68 }, true], // corner is inclusive
    [{ latitude: 37.5, longitude: 97.5 }, true],
    [LONDON, false],
    [{ latitude: 5.99, longitude: 80 }, false],
    [{ latitude: 20, longitude: 97.51 }, false],
  ])('%o -> %s', (coords, expected) => {
    expect(isWithinIndiaBounds(coords)).toBe(expected);
  });
});

describe('resolveGpsLocation', () => {
  it('names the place when BigDataCloud says India', () => {
    expect(resolveGpsLocation(PUNE, ok(pune))).toEqual({
      kind: 'located',
      location: {
        latitude: 18.5204,
        longitude: 73.8567,
        label: 'Pune, Maharashtra',
        nameAvailable: true,
        source: 'gps',
      },
    });
  });

  it('is India-only when BigDataCloud names another country', () => {
    expect(resolveGpsLocation(KATHMANDU, ok(kathmandu))).toEqual({
      kind: 'outside-india',
      countryName: 'Nepal',
    });
  });

  it('a successful reverse geocode wins over the bounding box', () => {
    // Kathmandu is inside the coarse box, but the country code says Nepal.
    expect(isWithinIndiaBounds(KATHMANDU)).toBe(true);
    expect(resolveGpsLocation(KATHMANDU, ok(kathmandu)).kind).toBe('outside-india');
  });

  it('falls back to "Near lat, lon (place name unavailable)" inside the box when the lookup fails', () => {
    expect(resolveGpsLocation(DELHI, failure)).toEqual({
      kind: 'located',
      location: {
        latitude: 28.6139,
        longitude: 77.209,
        label: 'Near 28.61, 77.21 (place name unavailable)',
        nameAvailable: false,
        source: 'gps',
      },
    });
  });

  it('is India-only outside the box when the lookup fails', () => {
    expect(resolveGpsLocation(LONDON, failure)).toEqual({
      kind: 'outside-india',
      countryName: null,
    });
  });

  it('uses the box when the lookup returns no country code', () => {
    const unknown = { countryCode: null, countryName: null, placeName: null, state: null };
    expect(resolveGpsLocation(DELHI, ok(unknown)).kind).toBe('located');
    expect(resolveGpsLocation(LONDON, ok(unknown)).kind).toBe('outside-india');
  });

  it('uses coordinates when India is confirmed but there is no place name', () => {
    const noName = { ...pune, placeName: null };
    const result = resolveGpsLocation(PUNE, ok(noName));

    expect(result.kind === 'located' && result.location.label).toBe(
      'Near 18.52, 73.86 (place name unavailable)',
    );
  });

  it('omits the state when it is missing or repeats the name', () => {
    const delhi = { countryCode: 'IN', countryName: 'India', placeName: 'Delhi', state: 'Delhi' };
    const result = resolveGpsLocation(DELHI, ok(delhi));

    expect(result.kind === 'located' && result.location.label).toBe('Delhi');
  });
});
