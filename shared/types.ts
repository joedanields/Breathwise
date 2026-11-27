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

export type Persona = z.infer<typeof PersonaSchema>;
export type AgeBand = z.infer<typeof AgeBandSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type NaqiCategory = z.infer<typeof NaqiCategorySchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type CommuteMode = z.infer<typeof CommuteModeSchema>;
export type Pollutant = z.infer<typeof PollutantSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type HouseholdProfile = z.infer<typeof HouseholdProfileSchema>;
export type TimeWindow = z.infer<typeof TimeWindowSchema>;
export type ImpactFact = z.infer<typeof ImpactFactSchema>;
export type FactsSnapshot = z.infer<typeof FactsSnapshotSchema>;
