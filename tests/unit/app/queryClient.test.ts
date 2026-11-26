import { describe, expect, it } from 'vitest';
import { createQueryClient, shouldRetry } from '@/app/queryClient';
import { FetchFailure } from '@/lib/http';

describe('shouldRetry', () => {
  it.each([
    [{ kind: 'network', message: 'offline' }, true],
    [{ kind: 'timeout' }, true],
    [{ kind: 'http', status: 503 }, true],
    [{ kind: 'http', status: 400 }, false],
    [{ kind: 'parse', message: 'bad' }, false],
    [{ kind: 'aborted' }, false],
  ] as const)('first failure %o -> %s', (detail, expected) => {
    expect(shouldRetry(0, new FetchFailure(detail))).toBe(expected);
  });

  it('retries at most once', () => {
    expect(shouldRetry(1, new FetchFailure({ kind: 'timeout' }))).toBe(false);
  });

  it('does not retry unknown errors', () => {
    expect(shouldRetry(0, new Error('boom'))).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('uses the retry policy and refetches on focus', () => {
    const options = createQueryClient().getDefaultOptions().queries;
    expect(options?.retry).toBe(shouldRetry);
    expect(options?.refetchOnWindowFocus).toBe(true);
  });
});
