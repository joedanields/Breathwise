import type { Coordinates } from '@/features/location/types';
import { fetchJson } from '@/lib/http';
import { buildForecastUrl } from './request';
import { WeatherResponseSchema } from './schemas';

export function fetchWeather({ latitude, longitude }: Coordinates, signal?: AbortSignal) {
  return fetchJson(buildForecastUrl(latitude, longitude), WeatherResponseSchema, { signal });
}
