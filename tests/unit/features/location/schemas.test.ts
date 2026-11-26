import { describe, expect, it } from 'vitest';
import {
  formatPlaceLabel,
  PlaceSearchResponseSchema,
  ReverseGeocodeResponseSchema,
} from '@/features/location/schemas';
import { loadFixture } from '../../../fixtures';

describe('PlaceSearchResponseSchema', () => {
  it('parses the real Lucknow search', () => {
    const places = PlaceSearchResponseSchema.parse(loadFixture('geoSearchLucknow'));

    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      name: 'Lucknow',
      district: 'Lucknow',
      state: 'Uttar Pradesh',
      timezone: 'Asia/Kolkata',
    });
    expect(places[0]?.latitude).toBeCloseTo(26.85, 1);
  });

  it('parses results with missing optional fields (population, admin2)', () => {
    const fixture = loadFixture('geoSearchPun');
    const results = fixture.results as Record<string, unknown>[];
    const third = results[2];
    if (third) delete third.admin2;

    const places = PlaceSearchResponseSchema.parse(fixture);

    expect(places).toHaveLength(8);
    expect(places[2]?.district).toBeNull();
  });

  it('treats the missing results key (no matches) as an empty list', () => {
    expect(PlaceSearchResponseSchema.parse(loadFixture('geoSearchNoMatch'))).toEqual([]);
  });

  it('drops any result outside India', () => {
    const fixture = loadFixture('geoSearchLucknow');
    const results = fixture.results as Record<string, unknown>[];
    results.push({ ...results[0], id: 1, name: 'Elsewhere', country_code: 'PK' });

    expect(PlaceSearchResponseSchema.parse(fixture).map((p) => p.name)).toEqual(['Lucknow']);
  });

  it('rejects a result without coordinates', () => {
    const fixture = loadFixture('geoSearchLucknow');
    const [first] = fixture.results as Record<string, unknown>[];
    if (first) delete first.latitude;

    expect(PlaceSearchResponseSchema.safeParse(fixture).success).toBe(false);
  });
});

describe('formatPlaceLabel', () => {
  const base = { id: 1, latitude: 0, longitude: 0, timezone: null };

  it.each([
    [{ name: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh' }, 'Lucknow, Uttar Pradesh'],
    [
      { name: 'Punāsa', district: 'Khandwa', state: 'Madhya Pradesh' },
      'Punāsa, Khandwa, Madhya Pradesh',
    ],
    [{ name: 'Lu', district: null, state: 'Nagaland' }, 'Lu, Nagaland'],
    [{ name: 'Somewhere', district: null, state: null }, 'Somewhere'],
  ])('%o -> %s', (place, expected) => {
    expect(formatPlaceLabel({ ...base, ...place })).toBe(expected);
  });
});

describe('ReverseGeocodeResponseSchema', () => {
  it('parses the real Pune response', () => {
    expect(ReverseGeocodeResponseSchema.parse(loadFixture('reverseGeocodePune'))).toEqual({
      countryCode: 'IN',
      countryName: 'India',
      placeName: 'Pune',
      state: 'Maharashtra',
    });
  });

  it('parses the real Kathmandu response', () => {
    expect(
      ReverseGeocodeResponseSchema.parse(loadFixture('reverseGeocodeKathmandu')),
    ).toMatchObject({
      countryCode: 'NP',
      countryName: 'Nepal',
    });
  });

  it('uses locality when city is empty, and treats empty strings as missing', () => {
    const fixture = loadFixture('reverseGeocodePune');
    fixture.city = '';
    fixture.locality = 'Hinjawadi';
    fixture.principalSubdivision = '  ';

    expect(ReverseGeocodeResponseSchema.parse(fixture)).toMatchObject({
      placeName: 'Hinjawadi',
      state: null,
    });
  });

  it('returns null fields when the service knows nothing (open sea)', () => {
    expect(
      ReverseGeocodeResponseSchema.parse({
        latitude: 10,
        longitude: 70,
        countryCode: '',
        city: '',
      }),
    ).toEqual({ countryCode: null, countryName: null, placeName: null, state: null });
  });

  it('rejects a non-object body', () => {
    expect(ReverseGeocodeResponseSchema.safeParse('Too many requests').success).toBe(false);
  });
});
