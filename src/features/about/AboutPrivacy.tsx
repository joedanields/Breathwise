import type { ReactNode } from 'react';
import { Sheet } from '@/components/ui/Sheet';

/** Privacy statement (SECURITY.md §6). The full "About data" sheet extends this in Phase 5. */
export const PRIVACY_STATEMENT =
  "Breathwise has no accounts and no tracking. Your household details stay in this browser. When you generate a plan, a summary of today's air data and your household details (without exact location) is sent to Google's Gemini API through our server, or directly if you use your own key. Clear everything anytime in Settings.";

export function AboutPrivacy({ trigger }: { trigger: ReactNode }) {
  return (
    <Sheet trigger={trigger} title="About & privacy">
      <section aria-labelledby="privacy-heading" className="space-y-3">
        <h3 id="privacy-heading" className="text-lg font-semibold">
          Your privacy
        </h3>
        <p>{PRIVACY_STATEMENT}</p>
        <p className="text-muted">
          Locations are stored rounded to about 1 km. Nothing is sent anywhere until you ask for a
          plan.
        </p>
      </section>
    </Sheet>
  );
}
