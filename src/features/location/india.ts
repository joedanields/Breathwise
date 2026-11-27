import { formatCoordinates } from '@/lib/coords';
import type { FetchError } from '@/lib/http';
import type { Result } from '@/lib/result';
import type { ReverseGeocode } from './schemas';
import type { Coordinates, SelectedLocation } from './types';

/**
 * Coarse India bounding box, used only when reverse geocoding can't tell us the
 * country (ADR-010). It also covers parts of neighbouring countries: a sanity
 * check, not proof.
 */
export const INDIA_BOUNDS = {
  minLatitude: 6,
  maxLatitude: 37.5,
  minLongitude: 68,
  maxLongitude: 97.5,
} as const;

export function isIndiaCountryCode(countryCode: string | null): boolean {
  return countryCode === 'IN';
}

export function isWithinIndiaBounds({ latitude, longitude }: Coordinates): boolean {
  return (
    latitude >= INDIA_BOUNDS.minLatitude &&
    latitude <= INDIA_BOUNDS.maxLatitude &&
    longitude >= INDIA_BOUNDS.minLongitude &&
    longitude <= INDIA_BOUNDS.maxLongitude
  );
}

export type GpsResolution =
  | { kind: 'located'; location: SelectedLocation }
  | { kind: 'outside-india'; countryName: string | null };

function coordinatesOnly(coords: Coordinates): SelectedLocation {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    label: `Near ${formatCoordinates(coords.latitude, coords.longitude)} (place name unavailable)`,
    nameAvailable: false,
    source: 'gps',
  };
}

/**
 * Decides what to do with a GPS fix (ARCHITECTURE.md §6, ADR-010):
 * a country code from reverse geocoding wins; without one, the bounding box decides.
 */
export function resolveGpsLocation(
  coords: Coordinates,
  reverse: Result<ReverseGeocode, FetchError>,
): GpsResolution {
  const place = reverse.ok ? reverse.value : null;

  if (place?.countryCode) {
    if (!isIndiaCountryCode(place.countryCode)) {
      return { kind: 'outside-india', countryName: place.countryName };
    }
    if (!place.placeName) return { kind: 'located', location: coordinatesOnly(coords) };
    const label =
      place.state && place.state !== place.placeName
        ? `${place.placeName}, ${place.state}`
        : place.placeName;
    return {
      kind: 'located',
      location: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        label,
        nameAvailable: true,
        source: 'gps',
        ...(place.state ? { state: place.state } : {}),
      },
    };
  }

  return isWithinIndiaBounds(coords)
    ? { kind: 'located', location: coordinatesOnly(coords) }
    : { kind: 'outside-india', countryName: null };
}
