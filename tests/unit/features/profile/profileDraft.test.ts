import { HouseholdProfileSchema } from '@shared/factsSnapshot';
import { describe, expect, it } from 'vitest';
import {
  addMember,
  draftToProfile,
  emptyDraft,
  profileToDraft,
  validateDayHome,
  validateHousehold,
} from '@/features/profile/profileDraft';
import { SCENARIOS } from '@/features/profile/scenarios';

function validDraft() {
  const draft = emptyDraft();
  draft.personas = ['parent'];
  const [first] = draft.members;
  if (!first) throw new Error('no member');
  first.label = 'Me';
  first.ageBand = 'adult_18_59';
  return draft;
}

describe('validateHousehold', () => {
  it('requires a persona, a label and an age band', () => {
    expect(validateHousehold(emptyDraft())).toEqual({
      personas: 'Choose at least one option.',
      'member-0-label': 'Enter a name or nickname.',
      'member-0-ageBand': 'Choose an age group.',
    });
  });

  it('limits labels to 30 characters', () => {
    const draft = validDraft();
    const [first] = draft.members;
    if (first) first.label = 'x'.repeat(31);
    expect(validateHousehold(draft)).toEqual({
      'member-0-label': 'Use 30 characters or fewer.',
    });
  });

  it('checks the outdoor activity only when it is turned on', () => {
    const draft = validDraft();
    const [first] = draft.members;
    if (!first) return;
    first.hasActivity = true;
    first.activityDurationMin = '500';
    expect(validateHousehold(draft)).toEqual({
      'member-0-activityKind': 'Choose an activity.',
      'member-0-activityStart': 'Enter the usual start time.',
      'member-0-activityDuration': 'Enter minutes between 5 and 240.',
    });
  });

  it('passes a complete household', () => {
    expect(validateHousehold(validDraft())).toEqual({});
  });
});

describe('validateDayHome', () => {
  it('accepts an empty step (everything optional)', () => {
    expect(validateDayHome(validDraft())).toEqual({});
  });

  it('checks number ranges', () => {
    const draft = validDraft();
    draft.commuteMode = 'bus';
    draft.oneWayKm = '0';
    draft.daysPerWeek = '9';
    draft.purifier = 'yes';
    draft.cadrM3h = '-5';
    draft.roomM2 = 'big';
    expect(validateDayHome(draft)).toEqual({
      oneWayKm: 'Enter a distance between 0.1 and 200 km.',
      daysPerWeek: 'Enter 1 to 7 days.',
      cadrM3h: 'Enter a CADR between 1 and 5000 m³/h, or leave it blank.',
      roomM2: 'Enter a room size between 1 and 500 m², or leave it blank.',
      homeType: 'Choose a home type to save home details.',
    });
  });
});

describe('draftToProfile', () => {
  it('builds a schema-valid profile, leaving out empty optional parts', () => {
    const profile = draftToProfile(validDraft(), { includeDayHome: true });
    expect(HouseholdProfileSchema.safeParse(profile).success).toBe(true);
    expect(profile).toEqual({
      personas: ['parent'],
      members: [{ id: 'm1', label: 'Me', ageBand: 'adult_18_59', conditions: [] }],
      masks: [],
      language: 'en',
    });
  });

  it('"Skip for now" ignores anything typed in step 3', () => {
    const draft = validDraft();
    draft.commuteMode = 'bus';
    draft.language = 'hi';
    expect(draftToProfile(draft, { includeDayHome: false })).not.toHaveProperty('commute');
    expect(draftToProfile(draft, { includeDayHome: false }).language).toBe('en');
  });

  it('only keeps carAc for cars', () => {
    const draft = validDraft();
    draft.commuteMode = 'two_wheeler';
    draft.carAc = 'ac_closed';
    expect(draftToProfile(draft, { includeDayHome: true }).commute).toEqual({
      mode: 'two_wheeler',
    });
  });

  it.each(SCENARIOS.map((s) => [s.id, s.profile] as const))(
    'round-trips scenario %s through the draft',
    (_id, profile) => {
      expect(draftToProfile(profileToDraft(profile), { includeDayHome: true })).toEqual(profile);
    },
  );
});

describe('addMember', () => {
  it('adds an empty member with a new unique id', () => {
    const draft = addMember(validDraft());
    expect(draft.members.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(addMember(draft).members.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });
});
