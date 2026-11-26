import { z } from 'zod';

/** Open-Meteo local time without offset, e.g. "2026-11-26T13:30" (DATA_SOURCES.md §1). */
export const LocalTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Expected a local time like 2026-11-26T13:30');

/** A value that may be missing. `null` stays `null`: never replaced with 0 or a default. */
export const NullableNumberSchema = z.number().nullable();

/** An optional variable: absent and `null` both become `null` (missing), never a default. */
export const OptionalNumberSchema = z
  .number()
  .nullish()
  .transform((value) => value ?? null);

export const HourlySeriesSchema = z.array(NullableNumberSchema);

/** Concentration unit used by the Air Quality API (Greek small letter mu). */
export const MICROGRAMS_PER_M3 = 'μg/m³';

/**
 * Adds an issue for every hourly array whose length differs from `time`.
 * Arrays of different lengths would silently misalign hours.
 */
export function checkSeriesLengths(
  hourly: Record<string, readonly unknown[]> & { time: readonly string[] },
  ctx: z.RefinementCtx,
): void {
  for (const [key, values] of Object.entries(hourly)) {
    if (values.length !== hourly.time.length) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `Expected ${hourly.time.length} values to match hourly.time, got ${values.length}`,
      });
    }
  }
}
