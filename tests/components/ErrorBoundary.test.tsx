import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { log } from '@shared/log';
import { ErrorBoundary } from '@/app/ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows a focused, friendly fallback and logs the error', () => {
    // React reports caught render errors itself; keep that out of the test output.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logError = vi.spyOn(log, 'error');

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Something went wrong' });
    expect(heading).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Reload Breathwise' })).toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith(
      'Breathwise UI error',
      expect.objectContaining({ message: 'kaboom' }),
      expect.any(String),
    );
  });
});
