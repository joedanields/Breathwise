import { describe, expect, it } from 'vitest';
import { buildAirQualityUrl } from '@/features/airquality/request';
import { buildPlaceSearchUrl, buildReverseGeocodeUrl } from '@/features/location/request';
import { buildForecastUrl } from '@/features/weather/request';

function paramsOf(url: string) {
  return Object.fromEntries(new URL(url).searchParams);
}

describe('request builders (DATA_SOURCES.md §1–4)', () => {
  it('air quality: exact variables, 1 past day, 3 forecast days, CAMS global', () => {
    const url = buildAirQualityUrl(28.613939, 77.209023);

    expect(url.startsWith('https://air-quality-api.open-meteo.com/v1/air-quality?')).toBe(true);
    expect(paramsOf(url)).toEqual({
      latitude: '28.61',
      longitude: '77.21',
      current:
        'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,dust,uv_index',
      hourly: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi',
      past_days: '1',
      forecast_days: '3',
      timezone: 'auto',
      domains: 'cams_global',
    });
  });

  it('forecast: weather variables including boundary-layer height', () => {
    const url = buildForecastUrl(13.0827, 80.2707);

    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true);
    expect(paramsOf(url)).toEqual({
      latitude: '13.08',
      longitude: '80.27',
      current:
        'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation',
      hourly:
        'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability,boundary_layer_height',
      forecast_days: '3',
      timezone: 'auto',
    });
  });

  it('place search: India only, 8 results, query encoded', () => {
    const url = buildPlaceSearchUrl('Navi Mumbai & co');

    expect(url.startsWith('https://geocoding-api.open-meteo.com/v1/search?')).toBe(true);
    expect(paramsOf(url)).toEqual({
      name: 'Navi Mumbai & co',
      count: '8',
      language: 'en',
      format: 'json',
      countryCode: 'IN',
    });
  });

  it('reverse geocode: BigDataCloud client endpoint with 2-decimal coordinates', () => {
    const url = buildReverseGeocodeUrl(18.52043, 73.856743);

    expect(url.startsWith('https://api.bigdatacloud.net/data/reverse-geocode-client?')).toBe(true);
    expect(paramsOf(url)).toEqual({
      latitude: '18.52',
      longitude: '73.86',
      localityLanguage: 'en',
    });
  });
});
