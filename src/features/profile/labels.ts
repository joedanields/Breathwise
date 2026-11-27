// Option labels for profile forms (UI stays English; AI text uses profile.language).

export const PERSONA_OPTIONS = [
  ['parent', 'Parent or carer'],
  ['senior', 'Senior or caring for one'],
  ['commuter', 'Commuter'],
  ['student', 'Student'],
] as const;

export const AGE_BAND_OPTIONS = [
  ['infant_0_1', 'Infant (0–1)'],
  ['child_2_5', 'Child (2–5)'],
  ['child_6_12', 'Child (6–12)'],
  ['teen_13_17', 'Teen (13–17)'],
  ['adult_18_59', 'Adult (18–59)'],
  ['senior_60_plus', 'Senior (60+)'],
] as const;

export const CONDITION_OPTIONS = [
  ['asthma', 'Asthma'],
  ['copd', 'COPD'],
  ['heart_disease', 'Heart disease'],
  ['pregnancy', 'Pregnancy'],
  ['allergies', 'Allergies'],
  ['diabetes', 'Diabetes'],
] as const;

export const ACTIVITY_OPTIONS = [
  ['play', 'Outdoor play'],
  ['walk', 'Walk'],
  ['run', 'Run'],
  ['sport', 'Sport'],
  ['yoga', 'Yoga'],
] as const;

export const COMMUTE_OPTIONS = [
  ['walk', 'Walk'],
  ['cycle', 'Cycle'],
  ['two_wheeler', 'Two-wheeler'],
  ['car_petrol', 'Car (petrol)'],
  ['car_diesel', 'Car (diesel)'],
  ['car_cng', 'Car (CNG)'],
  ['auto_rickshaw', 'Auto-rickshaw'],
  ['bus', 'Bus'],
  ['metro', 'Metro'],
  ['wfh', 'Work from home'],
] as const;

export const CAR_AC_OPTIONS = [
  ['ac_closed', 'AC on, windows closed'],
  ['windows_open', 'Windows open'],
] as const;

export const HOME_OPTIONS = [
  ['apartment', 'Apartment'],
  ['independent', 'Independent house'],
  ['hostel', 'Hostel'],
] as const;

export const YES_NO_OPTIONS = [
  ['yes', 'Yes'],
  ['no', 'No'],
] as const;

export const COOKING_FUEL_OPTIONS = [
  ['lpg', 'LPG'],
  ['png', 'Piped gas (PNG)'],
  ['electric', 'Electric'],
  ['biomass', 'Wood, dung or crop waste'],
  ['kerosene', 'Kerosene'],
] as const;

export const MASK_OPTIONS = [
  ['n95_ffp2', 'N95 / FFP2'],
  ['surgical', 'Surgical'],
  ['cloth', 'Cloth'],
  ['none', 'None'],
] as const;

/** Response languages for AI text (PRD US-8). */
export const LANGUAGE_OPTIONS = [
  ['en', 'English'],
  ['hi', 'हिन्दी (Hindi)'],
  ['bn', 'বাংলা (Bengali)'],
  ['ta', 'தமிழ் (Tamil)'],
  ['mr', 'मराठी (Marathi)'],
] as const;
