// Sample households for evaluators (docs/TEST_SCENARIOS.md — must match it).
// A scenario is a profile and a location only: air quality is always fetched live.
import type { HouseholdProfile } from '@shared/types';
import type { SelectedLocation } from '@/features/location/types';

export interface Scenario {
  id: 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';
  /** Must equal the "## S1 — …" heading text in TEST_SCENARIOS.md. */
  title: string;
  ask: string;
  location: SelectedLocation;
  profile: HouseholdProfile;
}

const place = (
  label: string,
  state: string,
  latitude: number,
  longitude: number,
): SelectedLocation => ({
  label,
  state,
  latitude,
  longitude,
  nameAvailable: true,
  source: 'search',
});

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'S1',
    title: 'Parent, young child with asthma · New Delhi',
    ask: 'Can Aarav play outside at 5 pm today?',
    location: place('New Delhi, Delhi', 'Delhi', 28.61, 77.21),
    profile: {
      personas: ['parent'],
      members: [
        { id: 'me', label: 'Me', ageBand: 'adult_18_59', conditions: [] },
        {
          id: 'aarav',
          label: 'Aarav',
          ageBand: 'child_2_5',
          conditions: ['asthma'],
          outdoorActivity: { kind: 'play', usualStart: '17:00', durationMin: 60 },
        },
      ],
      commute: { mode: 'car_petrol', carAc: 'windows_open', oneWayKm: 3, daysPerWeek: 5 },
      home: { type: 'apartment', purifier: { has: false }, cookingFuel: 'lpg' },
      masks: ['surgical'],
      language: 'en',
    },
  },
  {
    id: 'S2',
    title: 'Senior with COPD · Kolkata',
    ask: 'Is it okay for Baba to walk in the evening instead?',
    location: place('Kolkata, West Bengal', 'West Bengal', 22.57, 88.36),
    profile: {
      personas: ['senior'],
      members: [
        {
          id: 'baba',
          label: 'Baba',
          ageBand: 'senior_60_plus',
          conditions: ['copd'],
          outdoorActivity: { kind: 'walk', usualStart: '06:30', durationMin: 30 },
        },
      ],
      home: { type: 'independent', purifier: { has: true, cadrM3h: 250, roomM2: 15 } },
      masks: ['n95_ffp2'],
      language: 'en',
    },
  },
  {
    id: 'S3',
    title: 'Two-wheeler commuter · Bengaluru',
    ask: 'Should I switch to the metro this week?',
    location: place('Bengaluru, Karnataka', 'Karnataka', 12.97, 77.59),
    profile: {
      personas: ['commuter'],
      members: [{ id: 'me', label: 'Me', ageBand: 'adult_18_59', conditions: [] }],
      commute: {
        mode: 'two_wheeler',
        departs: '09:00',
        returns: '19:00',
        oneWayKm: 14,
        daysPerWeek: 5,
      },
      masks: ['n95_ffp2'],
      language: 'en',
    },
  },
  {
    id: 'S4',
    title: 'College student, early sports · Lucknow',
    ask: "What's the best time for a 2-hour practice tomorrow?",
    location: place('Lucknow, Uttar Pradesh', 'Uttar Pradesh', 26.85, 80.95),
    profile: {
      personas: ['student'],
      members: [
        {
          id: 'riya',
          label: 'Riya',
          ageBand: 'adult_18_59',
          conditions: ['allergies'],
          outdoorActivity: { kind: 'sport', usualStart: '06:00', durationMin: 120 },
        },
      ],
      commute: { mode: 'cycle', oneWayKm: 4 },
      home: { type: 'hostel', purifier: { has: false } },
      masks: [],
      language: 'en',
    },
  },
  {
    id: 'S5',
    title: 'Multi-generation household with infant, biomass cooking · Patna',
    ask: 'How do I keep the baby safe while cooking?',
    location: place('Patna, Bihar', 'Bihar', 25.59, 85.14),
    profile: {
      personas: ['parent', 'senior'],
      members: [
        { id: 'me', label: 'Me', ageBand: 'adult_18_59', conditions: [] },
        { id: 'dadi', label: 'Dadi', ageBand: 'senior_60_plus', conditions: ['heart_disease'] },
        { id: 'baby', label: 'Baby', ageBand: 'infant_0_1', conditions: [] },
      ],
      home: { type: 'independent', purifier: { has: false }, cookingFuel: 'biomass' },
      masks: ['cloth'],
      language: 'en',
    },
  },
  {
    id: 'S6',
    title: 'Hybrid professional · Mumbai',
    ask: 'Is it worth carpooling twice a week?',
    location: place('Mumbai, Maharashtra', 'Maharashtra', 19.08, 72.88),
    profile: {
      personas: ['commuter'],
      members: [
        { id: 'me', label: 'Me', ageBand: 'adult_18_59', conditions: [] },
        { id: 'partner', label: 'Partner', ageBand: 'adult_18_59', conditions: ['pregnancy'] },
      ],
      commute: { mode: 'car_diesel', carAc: 'ac_closed', oneWayKm: 18, daysPerWeek: 2 },
      home: { type: 'apartment', ac: true, purifier: { has: true, roomM2: 12 } },
      masks: ['n95_ffp2'],
      language: 'en',
    },
  },
];
