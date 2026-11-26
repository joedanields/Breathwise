// No imports: scripts/capture-fixtures.mjs loads this file directly with Node.

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** DATA_SOURCES.md §2. */
export const WEATHER_CURRENT_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'precipitation',
] as const;

export const WEATHER_HOURLY_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'wind_speed_10m',
  'precipitation_probability',
  'boundary_layer_height',
] as const;

export function buildForecastUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    current: WEATHER_CURRENT_VARIABLES.join(','),
    hourly: WEATHER_HOURLY_VARIABLES.join(','),
    forecast_days: '3',
    timezone: 'auto',
  });
  return `${FORECAST_URL}?${params.toString()}`;
}
