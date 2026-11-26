// No imports: scripts/capture-fixtures.mjs loads this file directly with Node,
// so fixtures are recorded with exactly the request the app makes.

export const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/** DATA_SOURCES.md §1. Ammonia and lead are not available for India. */
export const AQ_CURRENT_VARIABLES = [
  'pm10',
  'pm2_5',
  'carbon_monoxide',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'ozone',
  'us_aqi',
  'dust',
  'uv_index',
] as const;

export const AQ_HOURLY_VARIABLES = [
  'pm10',
  'pm2_5',
  'carbon_monoxide',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'ozone',
  'us_aqi',
] as const;

/** Coordinates are sent with 2 decimals (~1 km); the CAMS grid is ~45 km. */
export function buildAirQualityUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    current: AQ_CURRENT_VARIABLES.join(','),
    hourly: AQ_HOURLY_VARIABLES.join(','),
    past_days: '1',
    forecast_days: '3',
    timezone: 'auto',
    domains: 'cams_global',
  });
  return `${AIR_QUALITY_URL}?${params.toString()}`;
}
