// Form state for onboarding and the Household sheet, and its conversion to a
// HouseholdProfile. Pure: no React. Inputs are kept as strings while editing.
import type {
  AgeBand,
  CommuteMode,
  Condition,
  HouseholdProfile,
  Member,
  Persona,
} from '@shared/types';

type HomeType = NonNullable<HouseholdProfile['home']>['type'];
type CookingFuel = NonNullable<NonNullable<HouseholdProfile['home']>['cookingFuel']>;
type ActivityKind = NonNullable<Member['outdoorActivity']>['kind'];
export type Mask = HouseholdProfile['masks'][number];
export type Language = HouseholdProfile['language'];
export type CarAc = 'ac_closed' | 'windows_open';
type YesNo = '' | 'yes' | 'no';

export interface MemberDraft {
  id: string;
  label: string;
  ageBand: AgeBand | '';
  conditions: Condition[];
  hasActivity: boolean;
  activityKind: ActivityKind | '';
  activityStart: string;
  activityDurationMin: string;
}

export interface ProfileDraft {
  personas: Persona[];
  members: MemberDraft[];
  commuteMode: CommuteMode | '';
  carAc: CarAc | '';
  departs: string;
  returns: string;
  oneWayKm: string;
  daysPerWeek: string;
  homeType: HomeType | '';
  purifier: YesNo;
  cadrM3h: string;
  roomM2: string;
  ac: YesNo;
  cookingFuel: CookingFuel | '';
  masks: Mask[];
  language: Language;
}

/** Field id -> message. Ids match the form controls' ids. */
export type DraftErrors = Record<string, string>;

/** Props shared by the profile field groups (HouseholdFields, DayHomeFields). */
export interface DraftFieldsProps {
  /** Prefix for control ids, unique per form. */
  idPrefix: string;
  draft: ProfileDraft;
  onChange: (draft: ProfileDraft) => void;
  errors: DraftErrors;
}

export const MAX_LABEL_LENGTH = 30;

function emptyMember(id: string): MemberDraft {
  return {
    id,
    label: '',
    ageBand: '',
    conditions: [],
    hasActivity: false,
    activityKind: '',
    activityStart: '',
    activityDurationMin: '',
  };
}

export function emptyDraft(): ProfileDraft {
  return {
    personas: [],
    members: [emptyMember('m1')],
    commuteMode: '',
    carAc: '',
    departs: '',
    returns: '',
    oneWayKm: '',
    daysPerWeek: '',
    homeType: '',
    purifier: '',
    cadrM3h: '',
    roomM2: '',
    ac: '',
    cookingFuel: '',
    masks: [],
    language: 'en',
  };
}

/** Appends an empty member with an id not used yet (m1, m2, …). */
export function addMember(draft: ProfileDraft): ProfileDraft {
  const used = new Set(draft.members.map((m) => m.id));
  let n = draft.members.length + 1;
  while (used.has(`m${String(n)}`)) n++;
  return { ...draft, members: [...draft.members, emptyMember(`m${String(n)}`)] };
}

const isCar = (mode: CommuteMode | '') => mode.startsWith('car_');

/** A number in [min, max], or null when blank; NaN when not a valid number. */
function parseNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : Number.NaN;
}

function outOfRange(text: string, min: number, max: number, integer = false): boolean {
  const value = parseNumber(text);
  if (value === null) return false;
  return Number.isNaN(value) || value < min || value > max || (integer && !Number.isInteger(value));
}

export function validateHousehold(draft: ProfileDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.personas.length === 0) errors.personas = 'Choose at least one option.';
  draft.members.forEach((member, i) => {
    const key = `member-${String(i)}`;
    const label = member.label.trim();
    if (label === '') errors[`${key}-label`] = 'Enter a name or nickname.';
    else if (label.length > MAX_LABEL_LENGTH)
      errors[`${key}-label`] = 'Use 30 characters or fewer.';
    if (member.ageBand === '') errors[`${key}-ageBand`] = 'Choose an age group.';
    if (member.hasActivity) {
      if (member.activityKind === '') errors[`${key}-activityKind`] = 'Choose an activity.';
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(member.activityStart)) {
        errors[`${key}-activityStart`] = 'Enter the usual start time.';
      }
      const duration = parseNumber(member.activityDurationMin);
      if (duration === null || outOfRange(member.activityDurationMin, 5, 240, true)) {
        errors[`${key}-activityDuration`] = 'Enter minutes between 5 and 240.';
      }
    }
  });
  return errors;
}

export function validateDayHome(draft: ProfileDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (outOfRange(draft.oneWayKm, 0.1, 200))
    errors.oneWayKm = 'Enter a distance between 0.1 and 200 km.';
  if (outOfRange(draft.daysPerWeek, 1, 7, true)) errors.daysPerWeek = 'Enter 1 to 7 days.';
  if (outOfRange(draft.cadrM3h, 1, 5000)) {
    errors.cadrM3h = 'Enter a CADR between 1 and 5000 m³/h, or leave it blank.';
  }
  if (outOfRange(draft.roomM2, 1, 500)) {
    errors.roomM2 = 'Enter a room size between 1 and 500 m², or leave it blank.';
  }
  const homeDetails = draft.purifier !== '' || draft.ac !== '' || draft.cookingFuel !== '';
  if (homeDetails && draft.homeType === '')
    errors.homeType = 'Choose a home type to save home details.';
  return errors;
}

const present = (text: string) => (text.trim() === '' ? undefined : text.trim());
const numberOrUndefined = (text: string) => parseNumber(text) ?? undefined;

/** Drops keys whose value is undefined, so profiles stay minimal and round-trip cleanly. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function memberFromDraft(m: MemberDraft): Member {
  return compact({
    id: m.id,
    label: m.label.trim(),
    ageBand: m.ageBand as AgeBand,
    conditions: m.conditions,
    outdoorActivity:
      m.hasActivity && m.activityKind !== ''
        ? {
            kind: m.activityKind,
            usualStart: m.activityStart,
            durationMin: Number(m.activityDurationMin),
          }
        : undefined,
  });
}

function commuteFromDraft(draft: ProfileDraft): HouseholdProfile['commute'] {
  if (draft.commuteMode === '') return undefined;
  return compact({
    mode: draft.commuteMode,
    carAc: isCar(draft.commuteMode) && draft.carAc !== '' ? draft.carAc : undefined,
    departs: present(draft.departs),
    returns: present(draft.returns),
    oneWayKm: numberOrUndefined(draft.oneWayKm),
    daysPerWeek: numberOrUndefined(draft.daysPerWeek),
  });
}

function homeFromDraft(draft: ProfileDraft): HouseholdProfile['home'] {
  if (draft.homeType === '') return undefined;
  const purifier =
    draft.purifier === ''
      ? undefined
      : compact({
          has: draft.purifier === 'yes',
          cadrM3h: draft.purifier === 'yes' ? numberOrUndefined(draft.cadrM3h) : undefined,
          roomM2: numberOrUndefined(draft.roomM2),
        });
  return compact({
    type: draft.homeType,
    purifier,
    ac: draft.ac === '' ? undefined : draft.ac === 'yes',
    cookingFuel: draft.cookingFuel === '' ? undefined : draft.cookingFuel,
  });
}

/**
 * Converts a validated draft to a HouseholdProfile. With `includeDayHome: false`
 * ("Skip for now"), step 3 is ignored and defaults apply (no masks, English).
 */
export function draftToProfile(
  draft: ProfileDraft,
  { includeDayHome }: { includeDayHome: boolean },
): HouseholdProfile {
  const members = draft.members.map(memberFromDraft);
  const base: HouseholdProfile = { personas: draft.personas, members, masks: [], language: 'en' };
  if (!includeDayHome) return base;
  return compact({
    ...base,
    commute: commuteFromDraft(draft),
    home: homeFromDraft(draft),
    masks: draft.masks,
    language: draft.language,
  });
}

const text = (value: number | string | undefined) => (value === undefined ? '' : String(value));

export function profileToDraft(profile: HouseholdProfile): ProfileDraft {
  const { commute, home } = profile;
  return {
    personas: [...profile.personas],
    members: profile.members.map((m) => ({
      id: m.id,
      label: m.label,
      ageBand: m.ageBand,
      conditions: [...m.conditions],
      hasActivity: m.outdoorActivity !== undefined,
      activityKind: m.outdoorActivity?.kind ?? '',
      activityStart: m.outdoorActivity?.usualStart ?? '',
      activityDurationMin: text(m.outdoorActivity?.durationMin),
    })),
    commuteMode: commute?.mode ?? '',
    carAc: commute?.carAc ?? '',
    departs: commute?.departs ?? '',
    returns: commute?.returns ?? '',
    oneWayKm: text(commute?.oneWayKm),
    daysPerWeek: text(commute?.daysPerWeek),
    homeType: home?.type ?? '',
    purifier: home?.purifier === undefined ? '' : home.purifier.has ? 'yes' : 'no',
    cadrM3h: text(home?.purifier?.cadrM3h),
    roomM2: text(home?.purifier?.roomM2),
    ac: home?.ac === undefined ? '' : home.ac ? 'yes' : 'no',
    cookingFuel: home?.cookingFuel ?? '',
    masks: [...profile.masks],
    language: profile.language,
  };
}
