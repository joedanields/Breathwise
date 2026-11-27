import { type ReactNode, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { type Scenario, SCENARIOS } from './scenarios';
import { useAppStores } from './stores';

interface ScenarioPickerProps {
  trigger: ReactNode;
  onLoaded?: (scenario: Scenario) => void;
}

/**
 * "Try a sample household" (PRD US-7): loads a profile and a location only.
 * Air quality is always fetched live for the chosen place.
 */
export function ScenarioPicker({ trigger, onLoaded }: ScenarioPickerProps) {
  const stores = useAppStores();
  const [open, setOpen] = useState(false);

  return (
    <Sheet
      trigger={trigger}
      title="Try a sample household"
      description="Each sample sets a household and a place. Air quality is always fetched live, so the numbers change with the day."
      open={open}
      onOpenChange={setOpen}
    >
      <ul className="space-y-3">
        {SCENARIOS.map((scenario) => (
          <li key={scenario.id}>
            <button
              type="button"
              className="w-full rounded-lg border border-border p-4 text-left hover:border-accent"
              onClick={() => {
                stores.profile.set(scenario.profile);
                stores.setLocation(scenario.location);
                setOpen(false);
                onLoaded?.(scenario);
              }}
            >
              <span className="block font-semibold">
                {scenario.id} · {scenario.title}
              </span>
              <span className="mt-1 block text-sm text-muted">Try asking: “{scenario.ask}”</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
