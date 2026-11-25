/**
 * Minimal axe-core integration for Vitest (replaces the unmaintained vitest-axe, ADR-009).
 *
 *   const results = await runAxe(container);
 *   expect(results).toHaveNoViolations();
 */
import axe from 'axe-core';
import type { AxeResults, Result, RunOptions } from 'axe-core';

/**
 * Runs axe on a rendered container. Colour contrast is disabled because jsdom
 * does not compute styles; contrast is covered by the Playwright + axe tests.
 */
export function runAxe(container: Element, options: RunOptions = {}): Promise<AxeResults> {
  return axe.run(container, {
    ...options,
    rules: { 'color-contrast': { enabled: false }, ...options.rules },
  });
}

function isAxeResults(value: unknown): value is AxeResults {
  return (
    typeof value === 'object' &&
    value !== null &&
    'violations' in value &&
    Array.isArray(value.violations)
  );
}

function formatViolation(violation: Result): string {
  const targets = violation.nodes.map((node) => `    - ${node.target.join(' ')}`).join('\n');
  return `[${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help}\n  ${violation.helpUrl}\n${targets}`;
}

export function toHaveNoViolations(received: unknown): { pass: boolean; message: () => string } {
  if (!isAxeResults(received)) {
    return { pass: false, message: () => 'Expected axe-core results (from runAxe).' };
  }
  const { violations } = received;
  return {
    pass: violations.length === 0,
    message: () =>
      violations.length === 0
        ? 'Expected axe violations, but found none.'
        : `Expected no axe violations, found ${String(violations.length)}:\n\n${violations
            .map(formatViolation)
            .join('\n\n')}`,
  };
}

declare module 'vitest' {
  // Declaration merging must repeat Vitest's type parameters, even unused ones.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R, T> {
    toHaveNoViolations: () => R;
  }
}
