import type { HouseholdProfile } from '@shared/types';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { DayHomeFields } from './DayHomeFields';
import { HouseholdFields } from './HouseholdFields';
import { draftToProfile, profileToDraft, validateDayHome, validateHousehold } from './profileDraft';
import { useAppStores } from './stores';
import { useDraftForm } from './useDraftForm';

function HouseholdForm({ profile, onSaved }: { profile: HouseholdProfile; onSaved: () => void }) {
  const stores = useAppStores();
  const idPrefix = useId();
  const { draft, setDraft, errors, check, errorCount } = useDraftForm(
    () => profileToDraft(profile),
    idPrefix,
  );

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (!check(validateHousehold, validateDayHome)) return;
        stores.profile.set(draftToProfile(draft, { includeDayHome: true }));
        onSaved();
      }}
    >
      <HouseholdFields idPrefix={idPrefix} draft={draft} onChange={setDraft} errors={errors} />
      <DayHomeFields idPrefix={idPrefix} draft={draft} onChange={setDraft} errors={errors} />
      <p role="status" className="text-sm font-medium">
        {errorCount > 0 &&
          `${String(errorCount)} ${errorCount === 1 ? 'field needs' : 'fields need'} attention.`}
      </p>
      <Button type="submit">Save household</Button>
    </form>
  );
}

/** Household sheet (UI_UX.md §3.3): edit everything collected in onboarding. */
export function HouseholdSheet({ profile }: { profile: HouseholdProfile }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      trigger={<Button variant="secondary">Household</Button>}
      title="Your household"
      open={open}
      onOpenChange={setOpen}
    >
      {open && (
        <HouseholdForm
          profile={profile}
          onSaved={() => {
            setOpen(false);
          }}
        />
      )}
    </Sheet>
  );
}
