import { QueryClient } from '@tanstack/react-query';
import { FetchFailure } from '@/lib/http';

/** Retry once, and only for failures that might succeed on a second try. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1 || !(error instanceof FetchFailure)) return false;
  const { detail } = error;
  return (
    detail.kind === 'network' ||
    detail.kind === 'timeout' ||
    (detail.kind === 'http' && detail.status >= 500)
  );
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: true },
    },
  });
}
