import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react';
import { log } from '@shared/log';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Catches render errors so one broken component never blanks the whole app. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Never swallow errors silently (CLAUDE.md). No third-party error reporting by design.
    log.error('Breathwise UI error', error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.hasError ? <ErrorFallback /> : this.props.children;
  }
}

function ErrorFallback() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the message so keyboard and screen-reader users learn what happened.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="app-error-title"
      className="rounded-lg border border-border bg-surface p-6"
    >
      <h1
        ref={headingRef}
        id="app-error-title"
        tabIndex={-1}
        className="text-xl font-semibold focus:outline-none"
      >
        Something went wrong
      </h1>
      <p className="mt-2 text-muted">
        Breathwise hit an unexpected problem. Reloading the page usually fixes it.
      </p>
      <button
        type="button"
        onClick={() => {
          window.location.reload();
        }}
        className="mt-4 inline-flex min-h-11 items-center rounded-md bg-accent px-4 font-medium text-on-accent"
      >
        Reload Breathwise
      </button>
    </section>
  );
}
