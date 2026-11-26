import { type Mock, vi } from 'vitest';

type FakeOutcome =
  | { coords: { latitude: number; longitude: number } }
  | { errorCode: 1 | 2 | 3 }
  | { pending: true };

export type FakeGeolocation = Geolocation & {
  /** The same mock as `getCurrentPosition`, as a property (safe to pass around unbound). */
  requests: Mock<Geolocation['getCurrentPosition']>;
};

/** A Geolocation stand-in that answers `getCurrentPosition` with the given outcome. */
export function fakeGeolocation(outcome: FakeOutcome): FakeGeolocation {
  const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((success, error) => {
    if ('coords' in outcome) {
      success({ coords: outcome.coords, timestamp: Date.now() } as unknown as GeolocationPosition);
    } else if ('errorCode' in outcome) {
      error?.({
        code: outcome.errorCode,
        message: 'fake',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    }
  });
  return {
    getCurrentPosition,
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
    requests: getCurrentPosition,
  };
}

/** Installs a fake `navigator.geolocation`; returns a cleanup function. */
export function installGeolocation(geolocation: Geolocation | undefined): () => void {
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  return () => {
    Reflect.deleteProperty(navigator, 'geolocation');
  };
}
