import type { FactsSnapshot } from '@shared/types';
import { lazy, Suspense, useId, useState } from 'react';
import { Button } from '@/components/ui/Button';

// Lazy-loaded: the chat panel is not part of the initial bundle (ARCHITECTURE.md §7).
const ChatPanel = lazy(() => import('./ChatPanel'));

/** "Ask Breathwise" disclosure that loads the chat panel on first open. */
export function AskBreathwise({ snapshot }: { snapshot: FactsSnapshot }) {
  const headingId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-xl font-semibold">
          Ask Breathwise
        </h2>
        <Button
          variant={open ? 'secondary' : 'primary'}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {open ? 'Hide chat' : 'Ask a question'}
        </Button>
      </div>
      <div id={panelId} hidden={!open} className="mt-3">
        {open && (
          <Suspense fallback={<p role="status">Loading chat…</p>}>
            <ChatPanel snapshot={snapshot} />
          </Suspense>
        )}
      </div>
    </section>
  );
}
