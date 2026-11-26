// No imports: scripts/capture-fixtures.mjs loads this file directly with Node.

export const GEOCODING_SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

export const SEARCH_RESULT_COUNT = 8;

/** DATA_SOURCES.md §3: forward search, India only. */
export function buildPlaceSearchUrl(query: string): string {
  const params = new URLSearchParams({
    name: query,
    count: String(SEARCH_RESULT_COUNT),
    language: 'en',
    format: 'json',
    countryCode: 'IN',
  });
  return `${GEOCODING_SEARCH_URL}?${params.toString()}`;
}

/**
 * DATA_SOURCES.md §4. BigDataCloud's free endpoint is for browsers only:
 * call it only after the user taps "Use my location", never from a script or
 * the Pages Function.
 */
export function buildReverseGeocodeUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    localityLanguage: 'en',
  });
  return `${REVERSE_GEOCODE_URL}?${params.toString()}`;
}
