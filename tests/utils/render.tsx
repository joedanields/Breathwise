import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { type AppStores, createAppStores, StoresContext } from '@/features/profile/stores';

/** No retries (failures show at once) and an isolated cache per test. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

/** Renders with a test query client and app stores (over jsdom storage, cleared after each test). */
export function renderWithQuery(ui: ReactElement, stores: AppStores = createAppStores()) {
  const client = createTestQueryClient();
  return {
    client,
    stores,
    ...render(
      <StoresContext.Provider value={stores}>
        <QueryClientProvider client={client}>{ui}</QueryClientProvider>
      </StoresContext.Provider>,
    ),
  };
}
