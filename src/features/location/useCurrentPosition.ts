import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { roundCoordinate } from '@/lib/coords';
import { type FetchError, FetchFailure, unwrapOrThrow } from '@/lib/http';
import { err, ok, type Result } from '@/lib/result';
import { reverseGeocode } from './api';
import { type GeolocationFailure, getCurrentPosition } from './geolocation';
import { resolveGpsLocation } from './india';
import type { ReverseGeocode } from './schemas';
import type { Coordinates, SelectedLocation } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type LocateState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'located'; location: SelectedLocation }
  | { status: 'failed'; reason: GeolocationFailure }
  | { status: 'outside-india'; countryName: string | null };

/**
 * "Use my location": GPS, then BigDataCloud for the place name and country,
 * then the India check (ARCHITECTURE.md §6, ADR-010). Runs only when `locate`
 * is called from a user action.
 */
export function useCurrentPosition(onLocated: (location: SelectedLocation) => void) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<LocateState>({ status: 'idle' });
  const latestRequest = useRef(0);

  const lookUpPlace = useCallback(
    async (coords: Coordinates): Promise<Result<ReverseGeocode, FetchError>> => {
      try {
        const place = await queryClient.query({
          queryKey: [
            'reverse-geocode',
            roundCoordinate(coords.latitude),
            roundCoordinate(coords.longitude),
          ],
          queryFn: async ({ signal }) => unwrapOrThrow(await reverseGeocode(coords, signal)),
          staleTime: DAY_MS,
          gcTime: DAY_MS,
          retry: false,
        });
        return ok(place);
      } catch (error) {
        return err(
          error instanceof FetchFailure
            ? error.detail
            : { kind: 'network', message: String(error) },
        );
      }
    },
    [queryClient],
  );

  const locate = useCallback(async () => {
    const request = ++latestRequest.current;
    const isCurrent = () => request === latestRequest.current;
    setState({ status: 'locating' });

    const position = await getCurrentPosition();
    if (!isCurrent()) return;
    if (!position.ok) {
      setState({ status: 'failed', reason: position.error });
      return;
    }

    const resolution = resolveGpsLocation(position.value, await lookUpPlace(position.value));
    if (!isCurrent()) return;
    if (resolution.kind === 'outside-india') {
      setState({ status: 'outside-india', countryName: resolution.countryName });
      return;
    }
    setState({ status: 'located', location: resolution.location });
    onLocated(resolution.location);
  }, [lookUpPlace, onLocated]);

  return { state, locate };
}
