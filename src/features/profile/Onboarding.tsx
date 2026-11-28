import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AboutPrivacy } from '@/features/about/AboutPrivacy';
import { LocationPicker } from '@/features/location/LocationPicker';
import { DayHomeFields } from './DayHomeFields';
import { HouseholdFields } from './HouseholdFields';
import {
  type DraftFieldsProps,
  draftToProfile,
  emptyDraft,
  validateDayHome,
  validateHousehold,
} from './profileDraft';
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
  const idPrefix = useId();
  const [step, setStep] = useState(0);
  const headingRef = useStepHeadingFocus(step, focusOnMount);
  const { draft, setDraft, errors, check, errorCount } = useDraftForm(emptyDraft, idPrefix);
  const fields = { idPrefix, draft, onChange: setDraft, errors };

  const finish = (includeDayHome: boolean) => {
    if (includeDayHome && !check(validateHousehold, validateDayHome)) return;
    stores.profile.set(draftToProfile(draft, { includeDayHome }));
  };

  return (
    <section aria-labelledby={`${idPrefix}-heading`} className="mt-8 max-w-2xl">
      <StepHeading idPrefix={idPrefix} step={step} headingRef={headingRef} />
      {step === 0 && (
        <LocationStep
          idPrefix={idPrefix}
          onNext={() => {
            setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <HouseholdStep
          fields={fields}
          errorCount={errorCount}
          onBack={() => {
            setStep(0);
          }}
          onNext={() => {
            if (check(validateHousehold)) setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <DayHomeStep
          fields={fields}
          errorCount={errorCount}
          onBack={() => {
            setStep(1);
          }}
          onFinish={finish}
        />
      )}
    </section>
  );
}

/** Focuses the step heading whenever the step changes (not on first load unless asked). */
function useStepHeadingFocus(step: number, focusOnMount: boolean) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      if (!focusOnMount) return;
    }
    headingRef.current?.focus();
  }, [step, focusOnMount]);
  return headingRef;
}

function StepHeading({
  idPrefix,
  step,
  headingRef,
}: {
  idPrefix: string;
  step: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <>
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
    </>
  );
}

/** Step 1: pick a location (search or GPS), or try a sample household. */
function LocationStep({ idPrefix, onNext }: { idPrefix: string; onNext: () => void }) {
  const stores = useAppStores();
  const location = useStoredLocation();
  const [locationError, setLocationError] = useState(false);
  const locationErrorId = `${idPrefix}-location-error`;

  return (
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
            if (location) onNext();
            else setLocationError(true);
          }}
        >
          Next: who&apos;s at home
        </Button>
      </div>
    </div>
  );
}

interface StepFormProps {
  fields: DraftFieldsProps;
  errorCount: number;
  onBack: () => void;
}

/** Step 2: who lives at home. */
function HouseholdStep({
  fields,
  errorCount,
  onBack,
  onNext,
}: StepFormProps & { onNext: () => void }) {
  return (
    <StepForm onSubmit={onNext}>
      <p className="text-muted">
        Your household and health details stay in this browser.{' '}
        <AboutPrivacy trigger={<Button variant="link">About &amp; privacy</Button>} />
      </p>
      <HouseholdFields {...fields} />
      <ErrorCount count={errorCount} />
      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Next: your day &amp; home</Button>
      </div>
    </StepForm>
  );
}

/** Step 3: commute and home, all optional. */
function DayHomeStep({
  fields,
  errorCount,
  onBack,
  onFinish,
}: StepFormProps & { onFinish: (includeDayHome: boolean) => void }) {
  return (
    <StepForm
      onSubmit={() => {
        onFinish(true);
      }}
    >
      <p className="text-muted">All optional. You can change these later under Household.</p>
      <DayHomeFields {...fields} />
      <ErrorCount count={errorCount} />
      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              onFinish(false);
            }}
          >
            Skip for now
          </Button>
          <Button type="submit">Finish</Button>
        </div>
      </div>
    </StepForm>
  );
}

function StepForm({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      noValidate
      className="mt-4 space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

function ErrorCount({ count }: { count: number }) {
  return (
    <p role="status" className="text-sm font-medium">
      {count > 0 && `${String(count)} ${count === 1 ? 'field needs' : 'fields need'} attention.`}
    </p>
  );
}
