import { describe, expect, it } from 'vitest';
import { WeatherResponseSchema } from '@/features/weather/schemas';
import { loadFixture } from '../../../fixtures';

describe('WeatherResponseSchema', () => {
  it('parses the real Delhi response', () => {
    const data = WeatherResponseSchema.parse(loadFixture('weatherDelhi'));
    expect(data.timezone).toBe('Asia/Kolkata');
    expect(data.current).toEqual({
      time: '2026-11-26T18:45:00+05:30',
      intervalSeconds: 900,
      temperatureC: 19.1,
      humidityPct: 59,
      windKmh: 5.1,
      windDirDeg: 252,
      precipitationMm: 0,
    });
    expect(data.hourly.time).toHaveLength(72);
    expect(data.hourly.boundaryLayerHeightM).toHaveLength(72);
    expect(data.hourly.precipProbPct).toHaveLength(72);
  });

  it('parses the real Chennai response', () => {
    expect(
      WeatherResponseSchema.safeParse(loadFixture('weatherChennai')).data?.current.humidityPct,
    ).toBe(84);
  });

  it('keeps nulls in hourly and current values', () => {
    const fixture = loadFixture('weatherDelhi');
    const hourly = fixture.hourly as Record<string, unknown[]>;
    hourly.boundary_layer_height?.splice(5, 1, null);
    (fixture.current as Record<string, unknown>).wind_speed_10m = null;

    const data = WeatherResponseSchema.parse(fixture);

    expect(data.hourly.boundaryLayerHeightM[5]).toBeNull();
    expect(data.current.windKmh).toBeNull();
  });

  it('rejects mismatched hourly lengths', () => {
    const fixture = loadFixture('weatherDelhi');
    (fixture.hourly as Record<string, unknown[]>).temperature_2m?.push(20);

    expect(WeatherResponseSchema.safeParse(fixture).success).toBe(false);
  });

  it('rejects wind speed in units other than km/h', () => {
    const fixture = loadFixture('weatherDelhi');
    (fixture.current_units as Record<string, string>).wind_speed_10m = 'm/s';

    expect(WeatherResponseSchema.safeParse(fixture).success).toBe(false);
  });
});
