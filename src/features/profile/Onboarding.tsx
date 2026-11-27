import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AboutPrivacy } from '@/features/about/AboutPrivacy';
import { LocationPicker } from '@/features/location/LocationPicker';
import { DayHomeFields } from './DayHomeFields';
import { HouseholdFields } from './HouseholdFields';
import { draftToProfile, emptyDraft, validateDayHome, validateHousehold } from './profileDraft';
import { ScenarioPicker } from './ScenarioPicker';
import { useAppStores, useStoredLocation } from './stores';
import { useDraftForm } from './useDraftForm';

const STEPS = ['Where are you?', "Who's at home?", 'Your day & home'] as const;

interface OnboardingProps {
  /** Move focus to the heading on first render (e.g. after "Clear all my data"). */
  focusOnMount?: boolean;
}

/** Onboarding, 3 short steps (UI_UX.md §3.1). Finishing saves the profile. */
export function Onboarding({ focusOnMount = false }: OnboardingProps) {
  const stores = useAppStores();
  const location = useStoredLocation();
  const idPrefix = useId();
  const [step, setStep] = useState(0);
  const [locationError, setLocationError] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const { draft, setDraft, errors, check, errorCount } = useDraftForm(emptyDraft, idPrefix);

  // Focus the step heading whenever the step changes (not on first load unless asked).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      if (!focusOnMount) return;
    }
    headingRef.current?.focus();
  }, [step, focusOnMount]);

  const finish = (includeDayHome: boolean) => {
    if (includeDayHome && !check(validateHousehold, validateDayHome)) return;
    stores.profile.set(draftToProfile(draft, { includeDayHome }));
  };

  const locationErrorId = `${idPrefix}-location-error`;

  return (
    <section aria-labelledby={`${idPrefix}-heading`} className="mt-8 max-w-2xl">
      <p className="text-sm font-medium text-muted" id={`${idPrefix}-progress`}>
        Step {step + 1} of {STEPS.length}
      </p>
      <ol aria-hidden="true" className="mt-2 flex gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-border'}`}
          />
        ))}
      </ol>
      <h2
        id={`${idPrefix}-heading`}
        ref={headingRef}
        tabIndex={-1}
        aria-describedby={`${idPrefix}-progress`}
        className="mt-4 text-2xl font-semibold focus:outline-none"
      >
        {STEPS[step]}
      </h2>

      {step === 0 && (
        <div className="mt-4 space-y-4">
          <LocationPicker
            onLocated={(next) => {
              stores.setLocation(next);
              setLocationError(false);
            }}
          />
          {location && (
            <p className="font-medium">
              Location: <span className="text-accent">{location.label}</span>
            </p>
          )}
          {locationError && (
            <p id={locationErrorId} role="alert" className="font-medium">
              Choose a location to continue: search above or use your location.
            </p>
          )}
          <p>
            Just looking?{' '}
            <ScenarioPicker trigger={<Button variant="link">Try a sample household</Button>} />
          </p>
          <div className="flex justify-end">
            <Button
              aria-describedby={locationError ? locationErrorId : undefined}
              onClick={() => {
                if (!location) {
                  setLocationError(true);
                  return;
                }
                setStep(1);
              }}
            >
              Next: who&apos;s at home
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <form
          noValidate
          className="mt-4 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (check(validateHousehold)) setStep(2);
          }}
        >
          <p className="text-muted">
            Your household and health details stay in this browser.{' '}
            <AboutPrivacy trigger={<Button variant="link">About &amp; privacy</Button>} />
          </p>
          <HouseholdFields idPrefix={idPrefix} draft={draft} onChange={setDraft} errors={errors} />
          <ErrorCount count={errorCount} />
          <div className="flex justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setStep(0);
              }}
            >
              Back
            </Button>
            <Button type="submit">Next: your day &amp; home</Button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form
          noValidate
          className="mt-4 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            finish(true);
          }}
        >
          <p className="text-muted">All optional. You can change these later under Household.</p>
          <DayHomeFields idPrefix={idPrefix} draft={draft} onChange={setDraft} errors={errors} />
          <ErrorCount count={errorCount} />
          <div className="flex flex-wrap justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setStep(1);
              }}
            >
              Back
            </Button>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  finish(false);
                }}
              >
                Skip for now
              </Button>
              <Button type="submit">Finish</Button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

function ErrorCount({ count }: { count: number }) {
  return (
    <p role="status" className="text-sm font-medium">
      {count > 0 && `${String(count)} ${count === 1 ? 'field needs' : 'fields need'} attention.`}
    </p>
  );
}
