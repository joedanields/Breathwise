import type { Coordinates } from '@/features/location/types';
import { fetchJson } from '@/lib/http';
import { buildAirQualityUrl } from './request';
import { AirQualityResponseSchema } from './schemas';

export function fetchAirQuality({ latitude, longitude }: Coordinates, signal?: AbortSignal) {
  return fetchJson(buildAirQualityUrl(latitude, longitude), AirQualityResponseSchema, { signal });
}
