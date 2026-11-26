import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

/** No retries (failures show at once) and an isolated cache per test. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

export function renderWithQuery(ui: ReactElement) {
  const client = createTestQueryClient();
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}
