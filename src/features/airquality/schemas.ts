import { z } from 'zod';
import {
  checkSeriesLengths,
  HourlySeriesSchema,
  LocalTimeSchema,
  MICROGRAMS_PER_M3,
  NullableNumberSchema,
  OptionalNumberSchema,
} from '@/lib/openMeteo';
import { toIsoWithOffset } from '@/lib/time';

const ugm3 = z.literal(MICROGRAMS_PER_M3);

/** Concentration units we depend on (CO must be µg/m³ for the NAQI mg/m³ conversion). */
const ConcentrationUnitsSchema = z.object({
  pm10: ugm3,
  pm2_5: ugm3,
  carbon_monoxide: ugm3,
  nitrogen_dioxide: ugm3,
  sulphur_dioxide: ugm3,
  ozone: ugm3,
});

const CurrentSchema = z.object({
  time: LocalTimeSchema,
  interval: z.number().int().positive(),
  pm10: NullableNumberSchema,
  pm2_5: NullableNumberSchema,
  carbon_monoxide: NullableNumberSchema,
  nitrogen_dioxide: NullableNumberSchema,
  sulphur_dioxide: NullableNumberSchema,
  ozone: NullableNumberSchema,
  us_aqi: OptionalNumberSchema,
  dust: OptionalNumberSchema,
  uv_index: OptionalNumberSchema,
});

const HourlySchema = z
  .object({
    time: z.array(LocalTimeSchema),
    pm10: HourlySeriesSchema,
    pm2_5: HourlySeriesSchema,
    carbon_monoxide: HourlySeriesSchema,
    nitrogen_dioxide: HourlySeriesSchema,
    sulphur_dioxide: HourlySeriesSchema,
    ozone: HourlySeriesSchema,
    us_aqi: HourlySeriesSchema,
  })
  .superRefine(checkSeriesLengths);

/**
 * Open-Meteo Air Quality response (DATA_SOURCES.md §1), validated and mapped to
 * unit-suffixed names with ISO times that carry the offset.
 */
export const AirQualityResponseSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string().min(1),
    utc_offset_seconds: z.number().int(),
    current: CurrentSchema,
    current_units: ConcentrationUnitsSchema,
    hourly: HourlySchema,
    hourly_units: ConcentrationUnitsSchema,
  })
  .transform((raw) => {
    const withOffset = (time: string) => toIsoWithOffset(time, raw.utc_offset_seconds);
    return {
      timezone: raw.timezone,
      utcOffsetSeconds: raw.utc_offset_seconds,
      /** The model grid cell (~45 km). Never display it as the user's location. */
      gridCell: { latitude: raw.latitude, longitude: raw.longitude },
      current: {
        time: withOffset(raw.current.time),
        intervalSeconds: raw.current.interval,
        pm25Ugm3: raw.current.pm2_5,
        pm10Ugm3: raw.current.pm10,
        coUgm3: raw.current.carbon_monoxide,
        no2Ugm3: raw.current.nitrogen_dioxide,
        so2Ugm3: raw.current.sulphur_dioxide,
        o3Ugm3: raw.current.ozone,
        usAqi: raw.current.us_aqi,
        dustUgm3: raw.current.dust,
        uvIndex: raw.current.uv_index,
      },
      hourly: {
        time: raw.hourly.time.map(withOffset),
        pm25Ugm3: raw.hourly.pm2_5,
        pm10Ugm3: raw.hourly.pm10,
        coUgm3: raw.hourly.carbon_monoxide,
        no2Ugm3: raw.hourly.nitrogen_dioxide,
        so2Ugm3: raw.hourly.sulphur_dioxide,
        o3Ugm3: raw.hourly.ozone,
        usAqi: raw.hourly.us_aqi,
      },
    };
  });

export type AirQualityData = z.output<typeof AirQualityResponseSchema>;
