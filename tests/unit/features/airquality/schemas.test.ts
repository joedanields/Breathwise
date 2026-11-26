import { describe, expect, it } from 'vitest';
import { AirQualityResponseSchema } from '@/features/airquality/schemas';
import { loadFixture } from '../../../fixtures';

function parse(input: unknown) {
  return AirQualityResponseSchema.safeParse(input);
}

function hourlyOf(fixture: Record<string, unknown>) {
  return fixture.hourly as Record<string, unknown[]>;
}

function currentOf(fixture: Record<string, unknown>) {
  return fixture.current as Record<string, unknown>;
}

describe('AirQualityResponseSchema', () => {
  it('parses the real Delhi response into named, unit-suffixed fields', () => {
    const data = AirQualityResponseSchema.parse(loadFixture('aqDelhi'));
    expect(data.timezone).toBe('Asia/Kolkata');
    expect(data.utcOffsetSeconds).toBe(19800);
    expect(data.current).toEqual({
      time: '2026-11-26T18:30:00+05:30',
      intervalSeconds: 3600,
      pm25Ugm3: 103.4,
      pm10Ugm3: 104.8,
      coUgm3: 2471,
      no2Ugm3: 93.2,
      so2Ugm3: 50.9,
      o3Ugm3: 32,
      usAqi: 197,
      dustUgm3: 2,
      uvIndex: 0,
    });
    expect(data.hourly.time).toHaveLength(96);
    expect(data.hourly.time[0]).toBe('2026-11-25T00:00:00+05:30');
    expect(data.hourly.pm25Ugm3).toHaveLength(96);
  });

  it('keeps the grid cell separate from any user location', () => {
    const data = AirQualityResponseSchema.parse(loadFixture('aqDelhi'));

    expect(data.gridCell.latitude).toBeCloseTo(28.6, 1);
    expect(data.gridCell.longitude).toBeCloseTo(77.2, 1);
    expect(data).not.toHaveProperty('latitude');
  });

  it('parses the real Chennai response', () => {
    const result = parse(loadFixture('aqChennai'));

    expect(result.success).toBe(true);
    expect(result.data?.current.pm25Ugm3).toBe(7.4);
  });

  it('keeps hourly nulls as null, never 0 or a filled value', () => {
    const data = AirQualityResponseSchema.parse(loadFixture('aqDerivedNullGaps'));

    expect(data.hourly.pm25Ugm3[22]).toBeNull();
    expect(data.hourly.pm25Ugm3[41]).toBeNull();
    expect(data.hourly.pm25Ugm3.filter((v) => v === null)).toHaveLength(13);
    expect(data.hourly.pm10Ugm3.filter((v) => v === null)).toHaveLength(4);
    expect(data.hourly.pm25Ugm3[21]).toEqual(expect.any(Number));
  });

  it('keeps null current values as null', () => {
    const data = AirQualityResponseSchema.parse(loadFixture('aqDerivedNullGaps'));

    expect(data.current.usAqi).toBeNull();
    expect(data.current.dustUgm3).toBeNull();
    expect(data.current.pm25Ugm3).toBe(103.4);
  });

  it('treats an absent optional current value (dust, UV, US AQI) as null', () => {
    const fixture = loadFixture('aqDelhi');
    delete currentOf(fixture).dust;
    delete currentOf(fixture).uv_index;

    const data = AirQualityResponseSchema.parse(fixture);

    expect(data.current.dustUgm3).toBeNull();
    expect(data.current.uvIndex).toBeNull();
  });

  it('rejects a response missing a core pollutant', () => {
    const fixture = loadFixture('aqDelhi');
    delete currentOf(fixture).pm2_5;

    expect(parse(fixture).success).toBe(false);
  });

  it('rejects an hourly array whose length differs from time', () => {
    const fixture = loadFixture('aqDelhi');
    hourlyOf(fixture).pm10?.pop();

    const result = parse(fixture);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['hourly', 'pm10']);
  });

  it('rejects a missing hourly variable', () => {
    const fixture = loadFixture('aqDelhi');
    delete hourlyOf(fixture).pm2_5;

    expect(parse(fixture).success).toBe(false);
  });

  it('rejects non-numeric values', () => {
    const fixture = loadFixture('aqDelhi');
    hourlyOf(fixture).pm2_5?.splice(0, 1, '103.6');

    expect(parse(fixture).success).toBe(false);
  });

  it('rejects times that are not YYYY-MM-DDTHH:mm', () => {
    const fixture = loadFixture('aqDelhi');
    currentOf(fixture).time = '2026-11-26 18:30';

    expect(parse(fixture).success).toBe(false);
  });

  it('rejects unexpected units (CO must be µg/m³ for the NAQI conversion)', () => {
    const fixture = loadFixture('aqDelhi');
    (fixture.current_units as Record<string, string>).carbon_monoxide = 'mg/m³';

    expect(parse(fixture).success).toBe(false);
  });

  it('rejects the Open-Meteo error body', () => {
    expect(parse({ error: true, reason: 'Latitude must be in range of -90 to 90°.' }).success).toBe(
      false,
    );
  });
});
