import { Button } from '@/components/ui/Button';
import { Checkbox, CheckboxGroup, SelectField, TextField } from '@/components/ui/fields';
import { ACTIVITY_OPTIONS, AGE_BAND_OPTIONS, CONDITION_OPTIONS, PERSONA_OPTIONS } from './labels';
import {
  addMember,
  type DraftErrors,
  type DraftFieldsProps,
  MAX_LABEL_LENGTH,
  type MemberDraft,
} from './profileDraft';

/** "Who's at home?" (UI_UX.md §3.1 step 2): personas and members. */
export function HouseholdFields({ idPrefix, draft, onChange, errors }: DraftFieldsProps) {
  const id = (key: string) => `${idPrefix}-${key}`;
  const updateMember = (index: number, patch: Partial<MemberDraft>) => {
    onChange({
      ...draft,
      members: draft.members.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    });
  };
  const removeMember = (index: number) => {
    onChange({ ...draft, members: draft.members.filter((_, i) => i !== index) });
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
        {draft.members.map((member, index) => (
          <li key={member.id} className="rounded-lg border border-border p-4">
            <MemberFieldset
              fieldId={(field) => id(`member-${String(index)}-${field}`)}
              errorFor={(field) => errors[`member-${String(index)}-${field}`]}
              member={member}
              name={member.label.trim() || `Person ${String(index + 1)}`}
              onUpdate={(patch) => {
                updateMember(index, patch);
              }}
              onRemove={
                draft.members.length > 1
                  ? () => {
                      removeMember(index);
                    }
                  : undefined
              }
            />
          </li>
        ))}
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

interface MemberFieldsetProps {
  /** Control id for a member field, e.g. "label" → "<prefix>-member-0-label". */
  fieldId: (field: string) => string;
  /** Validation message for a member field; keys match `validateHousehold`. */
  errorFor: (field: string) => DraftErrors[string] | undefined;
  member: MemberDraft;
  name: string;
  onUpdate: (patch: Partial<MemberDraft>) => void;
  /** Absent when this is the only member (a household needs at least one). */
  onRemove: (() => void) | undefined;
}

function MemberFieldset({
  fieldId,
  errorFor,
  member,
  name,
  onUpdate,
  onRemove,
}: MemberFieldsetProps) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold">{name}</legend>
      <TextField
        id={fieldId('label')}
        label="Name or nickname"
        hint={`Shown only to you and in the plan. Up to ${String(MAX_LABEL_LENGTH)} characters.`}
        maxLength={MAX_LABEL_LENGTH + 10}
        value={member.label}
        error={errorFor('label')}
        onChange={(label) => {
          onUpdate({ label });
        }}
      />
      <SelectField
        id={fieldId('ageBand')}
        label="Age group"
        options={AGE_BAND_OPTIONS}
        value={member.ageBand}
        error={errorFor('ageBand')}
        onChange={(ageBand) => {
          onUpdate({ ageBand });
        }}
      />
      <CheckboxGroup
        id={fieldId('conditions')}
        legend="Health conditions"
        hint="Optional. Leave all unticked for none."
        options={CONDITION_OPTIONS}
        values={member.conditions}
        onChange={(conditions) => {
          onUpdate({ conditions });
        }}
      />
      <Checkbox
        id={fieldId('hasActivity')}
        label="Has a regular outdoor activity"
        checked={member.hasActivity}
        onChange={(hasActivity) => {
          onUpdate({ hasActivity });
        }}
      />
      {member.hasActivity && (
        <ActivityFields fieldId={fieldId} errorFor={errorFor} member={member} onUpdate={onUpdate} />
      )}
      {onRemove && (
        <Button variant="secondary" onClick={onRemove}>
          Remove {name}
        </Button>
      )}
    </fieldset>
  );
}

function ActivityFields({
  fieldId,
  errorFor,
  member,
  onUpdate,
}: Pick<MemberFieldsetProps, 'fieldId' | 'errorFor' | 'member' | 'onUpdate'>) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SelectField
        id={fieldId('activityKind')}
        label="Activity"
        options={ACTIVITY_OPTIONS}
        value={member.activityKind}
        error={errorFor('activityKind')}
        onChange={(activityKind) => {
          onUpdate({ activityKind });
        }}
      />
      <TextField
        id={fieldId('activityStart')}
        label="Usual start time"
        type="time"
        value={member.activityStart}
        error={errorFor('activityStart')}
        onChange={(activityStart) => {
          onUpdate({ activityStart });
        }}
      />
      <TextField
        id={fieldId('activityDuration')}
        label="Duration (minutes)"
        inputMode="numeric"
        value={member.activityDurationMin}
        error={errorFor('activityDuration')}
        onChange={(activityDurationMin) => {
          onUpdate({ activityDurationMin });
        }}
      />
    </div>
  );
}
