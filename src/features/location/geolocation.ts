import { err, ok, type Result } from '@/lib/result';
import type { Coordinates } from './types';

/** City-level accuracy is enough for a ~45 km model grid and saves battery. */
export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 600_000,
};

export type GeolocationFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

// GeolocationPositionError codes (not exposed as a global in every environment).
const FAILURE_BY_CODE: Record<number, GeolocationFailure> = {
  1: 'denied',
  2: 'unavailable',
  3: 'timeout',
};

function browserGeolocation(): Geolocation | undefined {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
    ? navigator.geolocation
    : undefined;
}

/** Promise wrapper around `getCurrentPosition`. Call only from a user action. */
export function getCurrentPosition(
  geolocation: Geolocation | undefined = browserGeolocation(),
): Promise<Result<Coordinates, GeolocationFailure>> {
  if (!geolocation) return Promise.resolve(err('unsupported'));
  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve(ok({ latitude: coords.latitude, longitude: coords.longitude }));
      },
      (error) => {
        resolve(err(FAILURE_BY_CODE[error.code] ?? 'unavailable'));
      },
      GEOLOCATION_OPTIONS,
    );
  });
}

export function describeGeolocationFailure(reason: GeolocationFailure): string {
  const next = 'Search for a town or city instead.';
  switch (reason) {
    case 'denied':
      return `Location access is off for this site. ${next}`;
    case 'timeout':
      return `Finding your location took too long. ${next}`;
    case 'unavailable':
      return `Your location isn't available right now. ${next}`;
    case 'unsupported':
      return `This browser can't share your location. ${next}`;
  }
}
