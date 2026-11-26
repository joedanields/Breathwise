import { describe, expect, it } from 'vitest';
import {
  describeGeolocationFailure,
  GEOLOCATION_OPTIONS,
  getCurrentPosition,
} from '@/features/location/geolocation';
import { err, ok } from '@/lib/result';
import { fakeGeolocation } from '../../../utils/geolocation';

describe('getCurrentPosition', () => {
  it('asks once with a 10 s timeout, 10 min maximumAge and low accuracy', async () => {
    const geolocation = fakeGeolocation({ coords: { latitude: 18.52, longitude: 73.86 } });

    await getCurrentPosition(geolocation);

    expect(GEOLOCATION_OPTIONS).toEqual({
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 600_000,
    });
    expect(geolocation.requests).toHaveBeenCalledOnce();
    expect(geolocation.requests.mock.calls[0]?.[2]).toBe(GEOLOCATION_OPTIONS);
  });

  it('resolves with the coordinates on success', async () => {
    const geolocation = fakeGeolocation({ coords: { latitude: 18.52, longitude: 73.86 } });

    await expect(getCurrentPosition(geolocation)).resolves.toEqual(
      ok({ latitude: 18.52, longitude: 73.86 }),
    );
  });

  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ] as const)('maps error code %i to %s', async (code, reason) => {
    const geolocation = fakeGeolocation({ errorCode: code });

    await expect(getCurrentPosition(geolocation)).resolves.toEqual(err(reason));
  });

  it('reports unsupported when the browser has no geolocation', async () => {
    await expect(getCurrentPosition(undefined)).resolves.toEqual(err('unsupported'));
  });
});

describe('describeGeolocationFailure', () => {
  it.each(['denied', 'unavailable', 'timeout', 'unsupported'] as const)(
    '%s points the user to search',
    (reason) => {
      expect(describeGeolocationFailure(reason)).toMatch(/search for a town or city/i);
    },
  );

  it('explains a denied permission without blame', () => {
    expect(describeGeolocationFailure('denied')).toMatch(/location access is off/i);
  });

  it('explains a timeout', () => {
    expect(describeGeolocationFailure('timeout')).toMatch(/took too long/i);
  });
});
