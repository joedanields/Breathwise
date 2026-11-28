// Types inferred from the Zod schemas, so the runtime check and the type can't drift.
import type { z } from 'zod';
import type {
  AgeBandSchema,
  CommuteModeSchema,
  ConditionSchema,
  FactsSnapshotSchema,
  HouseholdProfileSchema,
  ImpactFactSchema,
  MemberSchema,
  NaqiCategorySchema,
  PersonaSchema,
  PollutantSchema,
  RiskLevelSchema,
  TimeWindowSchema,
} from './factsSnapshot';

/** Who the household plans for (parent, senior, commuter, student…). */
export type Persona = z.infer<typeof PersonaSchema>;
/** A member's age group. */
export type AgeBand = z.infer<typeof AgeBandSchema>;
/** A health condition that raises sensitivity to air pollution. */
export type Condition = z.infer<typeof ConditionSchema>;
/** An India NAQI category, from Good to Severe. */
export type NaqiCategory = z.infer<typeof NaqiCategorySchema>;
/** A member's risk level today. */
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
/** How the household commutes. */
export type CommuteMode = z.infer<typeof CommuteModeSchema>;
/** A pollutant used in the India NAQI. */
export type Pollutant = z.infer<typeof PollutantSchema>;
/** One household member. */
export type Member = z.infer<typeof MemberSchema>;
/** The household: members, commute, home, masks and language. */
export type HouseholdProfile = z.infer<typeof HouseholdProfileSchema>;
/** A labelled time window with its mean PM2.5 and band. */
export type TimeWindow = z.infer<typeof TimeWindowSchema>;
/** A computed CO2 or exposure fact the AI may cite. */
export type ImpactFact = z.infer<typeof ImpactFactSchema>;
/** Everything the AI receives: live readings, computed rules and the profile. */
export type FactsSnapshot = z.infer<typeof FactsSnapshotSchema>;
