import { fetchJson } from '@/lib/http';
import { buildPlaceSearchUrl, buildReverseGeocodeUrl } from './request';
import { PlaceSearchResponseSchema, ReverseGeocodeResponseSchema } from './schemas';
import type { Coordinates } from './types';

export function searchPlaces(query: string, signal?: AbortSignal) {
  return fetchJson(buildPlaceSearchUrl(query), PlaceSearchResponseSchema, { signal });
}

/** Browser only, after the user taps "Use my location" (DATA_SOURCES.md §4). */
export function reverseGeocode({ latitude, longitude }: Coordinates, signal?: AbortSignal) {
  return fetchJson(buildReverseGeocodeUrl(latitude, longitude), ReverseGeocodeResponseSchema, {
    signal,
  });
}
