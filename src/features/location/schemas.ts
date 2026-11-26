import { z } from 'zod';

/** A place from the Open-Meteo Geocoding API. Only id, name, coordinates and country are guaranteed. */
const GeocodingResultSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  country_code: z.string(),
  admin1: z.string().optional(),
  admin2: z.string().optional(),
  timezone: z.string().optional(),
});

/**
 * Search response (DATA_SOURCES.md §3). With no matches the API omits `results`
 * entirely, which means "no places", so it becomes an empty list.
 */
export const PlaceSearchResponseSchema = z
  .object({ results: z.array(GeocodingResultSchema).optional() })
  .transform(({ results = [] }) =>
    results
      .filter((result) => result.country_code === 'IN')
      .map((result) => ({
        id: result.id,
        name: result.name,
        district: result.admin2 ?? null,
        state: result.admin1 ?? null,
        latitude: result.latitude,
        longitude: result.longitude,
        timezone: result.timezone ?? null,
      })),
  );

export type Place = z.output<typeof PlaceSearchResponseSchema>[number];

/** "Punāsa, Khandwa, Madhya Pradesh"; parts that are missing or repeat the name are skipped. */
export function formatPlaceLabel(place: Pick<Place, 'name' | 'district' | 'state'>): string {
  const parts = [place.name];
  for (const part of [place.district, place.state]) {
    if (part && !parts.includes(part)) parts.push(part);
  }
  return parts.join(', ');
}

/** BigDataCloud sends "" for unknown fields; empty and whitespace-only text means missing. */
const OptionalTextSchema = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed === undefined || trimmed === '' ? null : trimmed;
  });

/** BigDataCloud reverse geocode (DATA_SOURCES.md §4). */
export const ReverseGeocodeResponseSchema = z
  .object({
    countryCode: OptionalTextSchema,
    countryName: OptionalTextSchema,
    principalSubdivision: OptionalTextSchema,
    city: OptionalTextSchema,
    locality: OptionalTextSchema,
  })
  .transform((raw) => ({
    countryCode: raw.countryCode?.toUpperCase() ?? null,
    countryName: raw.countryName,
    placeName: raw.city ?? raw.locality,
    state: raw.principalSubdivision,
  }));

export type ReverseGeocode = z.output<typeof ReverseGeocodeResponseSchema>;
