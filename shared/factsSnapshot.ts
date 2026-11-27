// Zod schemas for the household profile and the FactsSnapshot sent to the AI
// (ARCHITECTURE.md §4). Shared by the SPA and the Pages Function: no DOM, no React.
import { z } from 'zod';

export const PersonaSchema = z.enum(['parent', 'senior', 'commuter', 'student']);
export const AgeBandSchema = z.enum([
  'infant_0_1',
  'child_2_5',
  'child_6_12',
  'teen_13_17',
  'adult_18_59',
  'senior_60_plus',
]);
export const ConditionSchema = z.enum([
  'asthma',
  'copd',
  'heart_disease',
  'pregnancy',
  'allergies',
  'diabetes',
]);
export const NaqiCategorySchema = z.enum([
  'good',
  'satisfactory',
  'moderate',
  'poor',
  'very_poor',
  'severe',
]);
export const RiskLevelSchema = z.enum(['low', 'caution', 'high', 'very_high']);
export const CommuteModeSchema = z.enum([
  'walk',
  'cycle',
  'two_wheeler',
  'car_petrol',
  'car_diesel',
  'car_cng',
  'auto_rickshaw',
  'bus',
  'metro',
  'wfh',
]);
export const PollutantSchema = z.enum(['pm25', 'pm10', 'no2', 'o3', 'co', 'so2']);

/** An ISO 8601 time with an explicit offset, e.g. 2026-11-26T18:30:00+05:30. */
const IsoWithOffset = z.iso.datetime({ offset: true });
const ClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');
const Nullable = z.number().nullable();

export const MemberSchema = z.strictObject({
  id: z.string().min(1).max(64),
  /** User-entered, e.g. "Aarav (4)". Never sent beyond the AI call. */
  label: z.string().trim().min(1).max(30),
  ageBand: AgeBandSchema,
  conditions: z.array(ConditionSchema).max(ConditionSchema.options.length),
  outdoorActivity: z
    .strictObject({
      kind: z.enum(['play', 'walk', 'run', 'sport', 'yoga']),
      usualStart: ClockTime,
      durationMin: z.number().int().min(5).max(240),
    })
    .optional(),
});

export const HouseholdProfileSchema = z.strictObject({
  personas: z.array(PersonaSchema).max(PersonaSchema.options.length),
  members: z.array(MemberSchema).min(1).max(10),
  commute: z
    .strictObject({
      mode: CommuteModeSchema,
      departs: ClockTime.optional(),
      returns: ClockTime.optional(),
      oneWayKm: z.number().positive().max(200).optional(),
      daysPerWeek: z.number().int().min(1).max(7).optional(),
    })
    .optional(),
  home: z
    .strictObject({
      type: z.enum(['apartment', 'independent', 'hostel']),
      purifier: z
        .strictObject({
          has: z.boolean(),
          cadrM3h: z.number().positive().max(5000).optional(),
          roomM2: z.number().positive().max(500).optional(),
        })
        .optional(),
      ac: z.boolean().optional(),
      cookingFuel: z.enum(['lpg', 'png', 'electric', 'biomass', 'kerosene']).optional(),
    })
    .optional(),
  masks: z.array(z.enum(['n95_ffp2', 'surgical', 'cloth', 'none'])),
  language: z.enum(['en', 'hi', 'bn', 'ta', 'mr']),
});

export const TimeWindowSchema = z.strictObject({
  /** W1/W2 best outdoor, V1/V2 ventilation, X1/X2 worst (avoid). */
  label: z.string().regex(/^[WVX][1-9]$/),
  start: IsoWithOffset,
  end: IsoWithOffset,
  avgPm25Ugm3: z.number().nonnegative(),
  band: NaqiCategorySchema,
});

const ImpactFactBase = {
  id: z.string().regex(/^[a-z0-9_]+$/),
  mode: CommuteModeSchema,
  description: z.string().min(1).max(300),
  source: z.string().min(1),
  sourceUrl: z.url(),
};

/**
 * Impact facts. `kgCo2PerWeekDelta` is signed against the household's current
 * mode: negative is a saving, positive an increase, 0 no change.
 */
export const ImpactFactSchema = z.discriminatedUnion('category', [
  z.strictObject({
    ...ImpactFactBase,
    category: z.literal('co2'),
    kgCo2PerWeek: z.number().nonnegative(),
    kgCo2PerWeekDelta: z.number(),
  }),
  z.strictObject({
    ...ImpactFactBase,
    category: z.literal('exposureBenefit'),
    /** In-transit PM2.5 as a multiple of ambient (Goel et al. 2015); `to` is null for no travel. */
    exposureRatioFrom: z.number().positive(),
    exposureRatioTo: z.number().positive().nullable(),
  }),
]);

export const FactsSnapshotSchema = z.strictObject({
  version: z.literal(1),
  generatedAt: IsoWithOffset,
  location: z.strictObject({
    name: z.string().min(1),
    state: z.string().min(1).optional(),
    latRounded: z.number().min(-90).max(90),
    lonRounded: z.number().min(-180).max(180),
    timezone: z.string().min(1),
  }),
  provenance: z.strictObject({
    source: z.string().min(1),
    model: z.string().min(1),
    readingTime: IsoWithOffset,
    fetchedAt: IsoWithOffset,
    isModelledEstimate: z.literal(true),
    note: z.string().min(1),
  }),
  /** Rounded for display (DATA_SOURCES.md §7). `null` means missing, never 0. */
  current: z.strictObject({
    pm25Ugm3: Nullable,
    pm10Ugm3: Nullable,
    no2Ugm3: Nullable,
    so2Ugm3: Nullable,
    o3Ugm3: Nullable,
    coMgm3: Nullable,
    usAqi: Nullable,
    dustUgm3: Nullable,
    uvIndex: Nullable,
  }),
  /** PM2.5 band of the current hour (hourly signal, not NAQI). */
  pm25Band: NaqiCategorySchema.nullable(),
  naqi: z
    .strictObject({
      value: z.number().int().min(0).max(500),
      category: NaqiCategorySchema,
      dominant: PollutantSchema,
      subIndices: z.partialRecord(PollutantSchema, z.number().int().min(0).max(500)),
      hoursUsed: z.number().int().min(0).max(24),
      isEstimate: z.literal(true),
      o3Basis: z.enum(['8h', '1h']).nullable(),
    })
    .nullable(),
  trend: z.enum(['rising', 'falling', 'steady']).nullable(),
  weather: z
    .strictObject({
      tempC: Nullable,
      humidityPct: Nullable,
      windKmh: Nullable,
      windDirDeg: Nullable,
      precipProbPct: Nullable,
      boundaryLayerHeightM: Nullable,
    })
    .nullable(),
  windows: z.strictObject({
    bestOutdoor: z.array(TimeWindowSchema).max(2),
    ventilate: z.array(TimeWindowSchema).max(2),
    worst: z.array(TimeWindowSchema).max(2),
  }),
  memberRisk: z.array(
    z.strictObject({
      memberId: z.string().min(1),
      level: RiskLevelSchema,
      reasons: z.array(z.string().min(1)),
      outdoorGuidance: z.string().min(1),
    }),
  ),
  purifier: z
    .strictObject({
      has: z.boolean(),
      roomM2: Nullable,
      ceilingHeightM: z.number().positive(),
      targetAch: z.number().positive(),
      requiredCadrM3h: Nullable,
      cadrM3h: Nullable,
      achievedAch: Nullable,
    })
    .nullable(),
  impactFacts: z.array(ImpactFactSchema),
  comparisons: z.array(
    z.strictObject({
      id: z.string().regex(/^[a-z0-9_]+$/),
      text: z.string().min(1),
      value: z.number(),
      unit: z.string(),
    }),
  ),
  profile: HouseholdProfileSchema,
});
