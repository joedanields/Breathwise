import { skipToken, useQuery } from '@tanstack/react-query';
import { type Fetched, LIVE_DATA_QUERY_OPTIONS } from '@/features/airquality/useAirQuality';
import type { Coordinates } from '@/features/location/types';
import { roundCoordinate } from '@/lib/coords';
import { unwrapOrThrow } from '@/lib/http';
import { fetchWeather } from './api';
import type { WeatherData } from './schemas';

export function weatherQueryKey({ latitude, longitude }: Coordinates) {
  return ['weather', roundCoordinate(latitude), roundCoordinate(longitude)] as const;
}

/** Weather is optional context: callers continue without it on failure (ARCHITECTURE.md §6). */
export function useWeather(location: Coordinates | null) {
  return useQuery({
    queryKey: location ? weatherQueryKey(location) : ['weather', 'none'],
    queryFn: location
      ? async ({ signal }): Promise<Fetched<WeatherData>> => ({
          data: unwrapOrThrow(await fetchWeather(location, signal)),
          fetchedAt: new Date().toISOString(),
        })
      : skipToken,
    ...LIVE_DATA_QUERY_OPTIONS,
  });
}
