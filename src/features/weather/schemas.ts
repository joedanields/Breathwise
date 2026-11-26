import { z } from 'zod';
import {
  checkSeriesLengths,
  HourlySeriesSchema,
  LocalTimeSchema,
  NullableNumberSchema,
} from '@/lib/openMeteo';
import { toIsoWithOffset } from '@/lib/time';

/** Units our field names promise (`temperatureC`, `windKmh`, …). */
const CurrentUnitsSchema = z.object({
  temperature_2m: z.literal('°C'),
  relative_humidity_2m: z.literal('%'),
  wind_speed_10m: z.literal('km/h'),
  wind_direction_10m: z.literal('°'),
  precipitation: z.literal('mm'),
});

const HourlyUnitsSchema = z.object({
  temperature_2m: z.literal('°C'),
  relative_humidity_2m: z.literal('%'),
  wind_speed_10m: z.literal('km/h'),
  precipitation_probability: z.literal('%'),
  boundary_layer_height: z.literal('m'),
});

const CurrentSchema = z.object({
  time: LocalTimeSchema,
  interval: z.number().int().positive(),
  temperature_2m: NullableNumberSchema,
  relative_humidity_2m: NullableNumberSchema,
  wind_speed_10m: NullableNumberSchema,
  wind_direction_10m: NullableNumberSchema,
  precipitation: NullableNumberSchema,
});

const HourlySchema = z
  .object({
    time: z.array(LocalTimeSchema),
    temperature_2m: HourlySeriesSchema,
    relative_humidity_2m: HourlySeriesSchema,
    wind_speed_10m: HourlySeriesSchema,
    precipitation_probability: HourlySeriesSchema,
    boundary_layer_height: HourlySeriesSchema,
  })
  .superRefine(checkSeriesLengths);

/** Open-Meteo Forecast response (DATA_SOURCES.md §2), for weather context only. */
export const WeatherResponseSchema = z
  .object({
    timezone: z.string().min(1),
    utc_offset_seconds: z.number().int(),
    current: CurrentSchema,
    current_units: CurrentUnitsSchema,
    hourly: HourlySchema,
    hourly_units: HourlyUnitsSchema,
  })
  .transform((raw) => {
    const withOffset = (time: string) => toIsoWithOffset(time, raw.utc_offset_seconds);
    return {
      timezone: raw.timezone,
      utcOffsetSeconds: raw.utc_offset_seconds,
      current: {
        time: withOffset(raw.current.time),
        intervalSeconds: raw.current.interval,
        temperatureC: raw.current.temperature_2m,
        humidityPct: raw.current.relative_humidity_2m,
        windKmh: raw.current.wind_speed_10m,
        windDirDeg: raw.current.wind_direction_10m,
        precipitationMm: raw.current.precipitation,
      },
      hourly: {
        time: raw.hourly.time.map(withOffset),
        temperatureC: raw.hourly.temperature_2m,
        humidityPct: raw.hourly.relative_humidity_2m,
        windKmh: raw.hourly.wind_speed_10m,
        precipProbPct: raw.hourly.precipitation_probability,
        boundaryLayerHeightM: raw.hourly.boundary_layer_height,
      },
    };
  });

export type WeatherData = z.output<typeof WeatherResponseSchema>;
