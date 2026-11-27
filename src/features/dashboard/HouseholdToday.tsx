import type { FactsSnapshot, RiskLevel } from '@shared/types';
import { useId } from 'react';
import { formatWindow } from './formatWindow';

const RISK_LABELS: Readonly<Record<RiskLevel, string>> = {
  low: 'Low risk',
  caution: 'Take care',
  high: 'High risk',
  very_high: 'Very high risk',
};

/**
 * Rules-only summary for the household (works without AI): each member's risk
 * level and outdoor guidance, plus the computed best and ventilation windows.
 */
export function HouseholdToday({ snapshot }: { snapshot: FactsSnapshot }) {
  const headingId = useId();
  const { memberRisk, windows, profile, location } = snapshot;
  const label = (id: string) => profile.members.find((m) => m.id === id)?.label ?? id;

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-surface p-4">
      <h3 id={headingId} className="text-lg font-semibold">
        Today for your household
      </h3>
      {memberRisk.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {memberRisk.map((risk) => (
            <li key={risk.memberId}>
              <p className="font-medium">
                {label(risk.memberId)}:{' '}
                <span className="font-semibold">{RISK_LABELS[risk.level]}</span>
              </p>
              <p className="text-sm text-muted">{risk.outdoorGuidance}.</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-muted">Risk levels need current PM2.5 data.</p>
      )}

      <h4 className="mt-4 font-semibold">Best times</h4>
      {windows.bestOutdoor.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {windows.bestOutdoor.map((w) => (
            <li key={w.label}>
              <strong>{w.label}</strong> {formatWindow(w, location.timezone)} · PM2.5{' '}
              {w.avgPm25Ugm3} µg/m³
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No outdoor window in waking hours in the next 24 hours.</p>
      )}

      <h4 className="mt-4 font-semibold">Airing the house</h4>
      {windows.ventilate.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {windows.ventilate.map((w) => (
            <li key={w.label}>
              <strong>{w.label}</strong> {formatWindow(w, location.timezone)}: open windows for
              15–30 minutes.
            </li>
          ))}
        </ul>
      ) : (
        <p>
          Keep windows closed today; rely on a purifier if you have one, and run the kitchen exhaust
          only while cooking.
        </p>
      )}
      <p className="mt-4 text-sm text-muted">General guidance, not medical advice.</p>
    </section>
  );
}
