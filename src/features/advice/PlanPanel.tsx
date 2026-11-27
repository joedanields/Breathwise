import * as Tabs from '@radix-ui/react-tabs';
import type { AdviceAction, AdvicePlan } from '@shared/advice/planSchema';
import type { FactsSnapshot } from '@shared/types';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { adviceCacheKey, loadPlan, type PlanResult, useAdvice } from './useAdvice';

// AI output is rendered as plain text nodes only (CLAUDE.md rule 5): no HTML, no markdown.

const PRIORITY_LABEL: Readonly<Record<AdviceAction['priority'], string>> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

function memberNames(ids: readonly string[], snapshot: FactsSnapshot): string {
  if (ids.includes('all') || ids.length === 0) return 'Everyone';
  return ids.map((id) => snapshot.profile.members.find((m) => m.id === id)?.label ?? id).join(', ');
}

function ActionCard({ action, snapshot }: { action: AdviceAction; snapshot: FactsSnapshot }) {
  const titleId = useId();
  return (
    <article aria-labelledby={titleId} className="rounded-md border border-border p-3">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        {PRIORITY_LABEL[action.priority]}
      </p>
      <h4 id={titleId} className="mt-1 font-semibold">
        {action.title}
      </h4>
      <p className="mt-1 text-sm text-muted">
        {action.when ? `${action.when} · ` : ''}For: {memberNames(action.forMembers, snapshot)}
      </p>
      <p className="mt-2">
        <span className="font-medium">Why: </span>
        {action.why}
      </p>
      <p className="mt-1">
        <span className="font-medium">Impact: </span>
        {action.impact}
      </p>
    </article>
  );
}

function PlanBody({ plan, snapshot }: { plan: AdvicePlan; snapshot: FactsSnapshot }) {
  return (
    <>
      <h3 className="text-lg font-semibold">{plan.headline}</h3>
      <p className="mt-1">{plan.summary}</p>
      <Tabs.Root defaultValue="routine" className="mt-4">
        <Tabs.List
          aria-label="Plan sections"
          className="flex flex-wrap gap-2 border-b border-border"
        >
          {[
            ['routine', "Today's routine"],
            ['indoor', 'Indoor air'],
            ['impact', 'Impact & why'],
          ].map(([value, label]) => (
            <Tabs.Trigger
              key={value}
              value={value ?? ''}
              className="-mb-px min-h-11 border-b-2 border-transparent px-3 font-medium text-muted data-[state=active]:border-accent data-[state=active]:text-text"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="routine" className="mt-3 space-y-3">
          {plan.routine.map((a) => (
            <ActionCard key={a.id} action={a} snapshot={snapshot} />
          ))}
        </Tabs.Content>
        <Tabs.Content value="indoor" className="mt-3 space-y-3">
          {plan.indoor.map((a) => (
            <ActionCard key={a.id} action={a} snapshot={snapshot} />
          ))}
        </Tabs.Content>
        <Tabs.Content value="impact" className="mt-3 space-y-3">
          {plan.impact.map((item) => (
            <div key={item.title} className="rounded-md border border-border p-3">
              <h4 className="font-semibold">{item.title}</h4>
              <p className="mt-1">
                <span className="font-medium">Health: </span>
                {item.health}
              </p>
              {item.emissions && (
                <p className="mt-1">
                  <span className="font-medium">Emissions: </span>
                  {item.emissions}
                </p>
              )}
            </div>
          ))}
        </Tabs.Content>
      </Tabs.Root>

      {plan.memberNotes.length > 0 && (
        <>
          <h4 className="mt-4 font-semibold">For each person</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {plan.memberNotes.map((n) => (
              <li key={n.memberId}>
                <span className="font-medium">{memberNames([n.memberId], snapshot)}: </span>
                {n.note}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-4 rounded-md border-2 border-aqi-poor p-3">
        <h4 className="font-semibold">Seek medical care if</h4>
        <p className="mt-1">{plan.seekCareIf}</p>
      </div>
    </>
  );
}

/** AI plan with tabs (UI_UX.md §3.2), or the rules-based fallback with a notice. */
export function PlanPanel({ snapshot }: { snapshot: FactsSnapshot }) {
  const headingId = useId();
  const advice = useAdvice(snapshot);
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const result: PlanResult | undefined = advice.data;
  const busy = advice.isPending || regenerating;

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const next = await loadPlan(snapshot, { bypassCache: true });
      queryClient.setQueryData(['advice', adviceCacheKey(snapshot)], next);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-xl font-semibold">
          Your plan for today
        </h2>
        <Button variant="secondary" disabled={busy} onClick={() => void regenerate()}>
          Regenerate
        </Button>
      </div>
      <p role="status" className="mt-2 text-sm text-muted">
        {busy
          ? 'Preparing your plan…'
          : result?.source === 'ai'
            ? 'Plan ready. Written by AI from today’s live data and the rules below. General guidance, not medical advice.'
            : ''}
      </p>
      {result?.source === 'fallback' && result.notice && (
        <p className="mt-2 rounded-md border border-border bg-bg p-3 font-medium">
          {result.notice}
        </p>
      )}
      {busy && !result && (
        <div
          aria-hidden="true"
          className="mt-3 h-48 animate-pulse rounded-md bg-border motion-reduce:animate-none"
        />
      )}
      {result && (
        <div className="mt-3" lang={result.source === 'ai' ? snapshot.profile.language : 'en'}>
          <PlanBody plan={result.plan} snapshot={snapshot} />
        </div>
      )}
    </section>
  );
}
