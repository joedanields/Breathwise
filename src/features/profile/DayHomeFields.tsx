import { CheckboxGroup, RadioGroup, SelectField, TextField } from '@/components/ui/fields';
import {
  CAR_AC_OPTIONS,
  COMMUTE_OPTIONS,
  COOKING_FUEL_OPTIONS,
  HOME_OPTIONS,
  LANGUAGE_OPTIONS,
  MASK_OPTIONS,
  YES_NO_OPTIONS,
} from './labels';
import type { DraftErrors, DraftFieldsProps, ProfileDraft } from './profileDraft';

/** What each fieldset needs: control ids, the draft, its errors and a patch setter. */
interface SectionProps {
  id: (key: string) => string;
  draft: ProfileDraft;
  errors: DraftErrors;
  set: (patch: Partial<ProfileDraft>) => void;
}

/** "Your day & home" (UI_UX.md §3.1 step 3). Everything is optional. */
export function DayHomeFields({ idPrefix, draft, onChange, errors }: DraftFieldsProps) {
  const section: SectionProps = {
    id: (key) => `${idPrefix}-${key}`,
    draft,
    errors,
    set: (patch) => {
      onChange({ ...draft, ...patch });
    },
  };
  const { id, set } = section;

  return (
    <div className="space-y-8">
      <CommuteFieldset {...section} />
      <HomeFieldset {...section} />
      <CheckboxGroup
        id={id('masks')}
        legend="Masks you have"
        chips
        options={MASK_OPTIONS}
        values={draft.masks}
        onChange={(masks) => {
          set({ masks });
        }}
      />
      <SelectField
        id={id('language')}
        label="Language for advice"
        hint="The plan and chat answers use this language. The app itself stays in English."
        placeholder="English"
        options={LANGUAGE_OPTIONS.filter(([value]) => value !== 'en')}
        value={draft.language === 'en' ? '' : draft.language}
        onChange={(language) => {
          set({ language: language === '' ? 'en' : language });
        }}
      />
    </div>
  );
}

function CommuteFieldset({ id, draft, errors, set }: SectionProps) {
  const isCar = draft.commuteMode.startsWith('car_');
  const commuting = draft.commuteMode !== '' && draft.commuteMode !== 'wfh';
  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold">Commute</legend>
      <SelectField
        id={id('commuteMode')}
        label="Usual way to work or school"
        placeholder="No regular commute"
        options={COMMUTE_OPTIONS}
        value={draft.commuteMode}
        onChange={(commuteMode) => {
          set({ commuteMode, carAc: commuteMode.startsWith('car_') ? draft.carAc : '' });
        }}
      />
      {isCar && (
        <RadioGroup
          id={id('carAc')}
          name={id('carAc')}
          legend="In the car, usually…"
          hint="AC with windows closed keeps out much more traffic smoke."
          options={CAR_AC_OPTIONS}
          value={draft.carAc}
          onChange={(carAc) => {
            set({ carAc });
          }}
        />
      )}
      {commuting && <CommuteDetails id={id} draft={draft} errors={errors} set={set} />}
    </fieldset>
  );
}

function CommuteDetails({ id, draft, errors, set }: SectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        id={id('departs')}
        label="Leave at"
        type="time"
        value={draft.departs}
        onChange={(departs) => {
          set({ departs });
        }}
      />
      <TextField
        id={id('returns')}
        label="Return at"
        type="time"
        value={draft.returns}
        onChange={(returns) => {
          set({ returns });
        }}
      />
      <TextField
        id={id('oneWayKm')}
        label="Distance one way (km)"
        inputMode="decimal"
        value={draft.oneWayKm}
        error={errors.oneWayKm}
        onChange={(oneWayKm) => {
          set({ oneWayKm });
        }}
      />
      <TextField
        id={id('daysPerWeek')}
        label="Days a week"
        inputMode="numeric"
        value={draft.daysPerWeek}
        error={errors.daysPerWeek}
        onChange={(daysPerWeek) => {
          set({ daysPerWeek });
        }}
      />
    </div>
  );
}

function HomeFieldset({ id, draft, errors, set }: SectionProps) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold">Home</legend>
      <SelectField
        id={id('homeType')}
        label="Home type"
        options={HOME_OPTIONS}
        value={draft.homeType}
        error={errors.homeType}
        onChange={(homeType) => {
          set({ homeType });
        }}
      />
      <RadioGroup
        id={id('purifier')}
        name={id('purifier')}
        legend="Air purifier at home?"
        options={YES_NO_OPTIONS}
        value={draft.purifier}
        onChange={(purifier) => {
          set({ purifier });
        }}
      />
      {draft.purifier !== '' && <PurifierDetails id={id} draft={draft} errors={errors} set={set} />}
      <RadioGroup
        id={id('ac')}
        name={id('ac')}
        legend="Air conditioner at home?"
        options={YES_NO_OPTIONS}
        value={draft.ac}
        onChange={(ac) => {
          set({ ac });
        }}
      />
      <SelectField
        id={id('cookingFuel')}
        label="Cooking fuel"
        options={COOKING_FUEL_OPTIONS}
        value={draft.cookingFuel}
        onChange={(cookingFuel) => {
          set({ cookingFuel });
        }}
      />
    </fieldset>
  );
}

function PurifierDetails({ id, draft, errors, set }: SectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {draft.purifier === 'yes' && (
        <TextField
          id={id('cadrM3h')}
          label="Purifier CADR (m³/h)"
          hint="On the box or label. Leave blank if unknown."
          inputMode="decimal"
          value={draft.cadrM3h}
          error={errors.cadrM3h}
          onChange={(cadrM3h) => {
            set({ cadrM3h });
          }}
        />
      )}
      <TextField
        id={id('roomM2')}
        label="Main room size (m²)"
        hint="A 3 m × 4 m room is 12 m²."
        inputMode="decimal"
        value={draft.roomM2}
        error={errors.roomM2}
        onChange={(roomM2) => {
          set({ roomM2 });
        }}
      />
    </div>
  );
}
