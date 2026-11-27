import { Button } from '@/components/ui/Button';
import { Checkbox, CheckboxGroup, SelectField, TextField } from '@/components/ui/fields';
import { ACTIVITY_OPTIONS, AGE_BAND_OPTIONS, CONDITION_OPTIONS, PERSONA_OPTIONS } from './labels';
import {
  addMember,
  type DraftErrors,
  MAX_LABEL_LENGTH,
  type MemberDraft,
  type ProfileDraft,
} from './profileDraft';

interface FieldsProps {
  /** Prefix for control ids, unique per form. */
  idPrefix: string;
  draft: ProfileDraft;
  onChange: (draft: ProfileDraft) => void;
  errors: DraftErrors;
}

/** "Who's at home?" (UI_UX.md §3.1 step 2): personas and members. */
export function HouseholdFields({ idPrefix, draft, onChange, errors }: FieldsProps) {
  const id = (key: string) => `${idPrefix}-${key}`;
  const updateMember = (index: number, patch: Partial<MemberDraft>) => {
    onChange({
      ...draft,
      members: draft.members.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    });
  };

  return (
    <div className="space-y-6">
      <CheckboxGroup
        id={id('personas')}
        legend="Who is this plan for?"
        hint="Choose all that apply."
        chips
        options={PERSONA_OPTIONS}
        values={draft.personas}
        error={errors.personas}
        onChange={(personas) => {
          onChange({ ...draft, personas });
        }}
      />

      <ol className="space-y-6">
        {draft.members.map((member, index) => {
          const key = `member-${String(index)}`;
          const name = member.label.trim() || `Person ${String(index + 1)}`;
          return (
            <li key={member.id} className="rounded-lg border border-border p-4">
              <fieldset className="space-y-4">
                <legend className="text-lg font-semibold">{name}</legend>
                <TextField
                  id={id(`${key}-label`)}
                  label="Name or nickname"
                  hint={`Shown only to you and in the plan. Up to ${String(MAX_LABEL_LENGTH)} characters.`}
                  maxLength={MAX_LABEL_LENGTH + 10}
                  value={member.label}
                  error={errors[`${key}-label`]}
                  onChange={(label) => {
                    updateMember(index, { label });
                  }}
                />
                <SelectField
                  id={id(`${key}-ageBand`)}
                  label="Age group"
                  options={AGE_BAND_OPTIONS}
                  value={member.ageBand}
                  error={errors[`${key}-ageBand`]}
                  onChange={(ageBand) => {
                    updateMember(index, { ageBand });
                  }}
                />
                <CheckboxGroup
                  id={id(`${key}-conditions`)}
                  legend="Health conditions"
                  hint="Optional. Leave all unticked for none."
                  options={CONDITION_OPTIONS}
                  values={member.conditions}
                  onChange={(conditions) => {
                    updateMember(index, { conditions });
                  }}
                />
                <Checkbox
                  id={id(`${key}-hasActivity`)}
                  label="Has a regular outdoor activity"
                  checked={member.hasActivity}
                  onChange={(hasActivity) => {
                    updateMember(index, { hasActivity });
                  }}
                />
                {member.hasActivity && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <SelectField
                      id={id(`${key}-activityKind`)}
                      label="Activity"
                      options={ACTIVITY_OPTIONS}
                      value={member.activityKind}
                      error={errors[`${key}-activityKind`]}
                      onChange={(activityKind) => {
                        updateMember(index, { activityKind });
                      }}
                    />
                    <TextField
                      id={id(`${key}-activityStart`)}
                      label="Usual start time"
                      type="time"
                      value={member.activityStart}
                      error={errors[`${key}-activityStart`]}
                      onChange={(activityStart) => {
                        updateMember(index, { activityStart });
                      }}
                    />
                    <TextField
                      id={id(`${key}-activityDuration`)}
                      label="Duration (minutes)"
                      inputMode="numeric"
                      value={member.activityDurationMin}
                      error={errors[`${key}-activityDuration`]}
                      onChange={(activityDurationMin) => {
                        updateMember(index, { activityDurationMin });
                      }}
                    />
                  </div>
                )}
                {draft.members.length > 1 && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      onChange({ ...draft, members: draft.members.filter((_, i) => i !== index) });
                    }}
                  >
                    Remove {name}
                  </Button>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      <Button
        variant="secondary"
        onClick={() => {
          onChange(addMember(draft));
        }}
      >
        Add person
      </Button>
    </div>
  );
}
