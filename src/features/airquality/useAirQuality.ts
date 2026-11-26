import { skipToken, useQuery } from '@tanstack/react-query';
import type { Coordinates } from '@/features/location/types';
import { roundCoordinate } from '@/lib/coords';
import { unwrapOrThrow } from '@/lib/http';
import { fetchAirQuality } from './api';
import type { AirQualityData } from './schemas';

const MINUTE_MS = 60_000;

/** ARCHITECTURE.md §5: AQ data is cached for at most 60 min (DATA_SOURCES.md §7). */
export const LIVE_DATA_QUERY_OPTIONS = {
  staleTime: 15 * MINUTE_MS,
  gcTime: 60 * MINUTE_MS,
  refetchInterval: 15 * MINUTE_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

/** A parsed response plus when this browser fetched it (shown as "fetched N min ago"). */
export interface Fetched<T> {
  data: T;
  fetchedAt: string;
}

export function airQualityQueryKey({ latitude, longitude }: Coordinates) {
  return ['air-quality', roundCoordinate(latitude), roundCoordinate(longitude)] as const;
}

export function useAirQuality(location: Coordinates | null) {
  return useQuery({
    queryKey: location ? airQualityQueryKey(location) : ['air-quality', 'none'],
    queryFn: location
      ? async ({ signal }): Promise<Fetched<AirQualityData>> => ({
          data: unwrapOrThrow(await fetchAirQuality(location, signal)),
          fetchedAt: new Date().toISOString(),
        })
      : skipToken,
    ...LIVE_DATA_QUERY_OPTIONS,
  });
}
