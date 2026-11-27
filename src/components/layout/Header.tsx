import type { ReactNode } from 'react';

/** Site header; `actions` holds the Household and Settings buttons once onboarded. */
export function Header({ actions }: { actions?: ReactNode }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 32 32"
          className="size-8 shrink-0 text-accent"
          fill="none"
        >
          <circle cx="16" cy="16" r="15" fill="currentColor" />
          <path
            d="M7 13h12a3 3 0 1 0-3-3M7 18h15a3 3 0 1 1-3 3M7 23h7"
            className="stroke-on-accent"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-lg font-semibold tracking-tight">Breathwise</span>
        {actions && <div className="ml-auto flex gap-2">{actions}</div>}
      </div>
    </header>
  );
}
