import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { applyTheme } from './theme';

interface AppProvidersProps {
  children: ReactNode;
  /** Tests pass their own client (no retries, isolated cache). */
  queryClient?: QueryClient;
}

/**
 * App-wide providers: TanStack Query and the theme. The profile/settings stores
 * (Phase 4) are added here when they arrive.
 */
export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());

  // Follows the OS theme for now; the Settings sheet (Phase 4) supplies a user preference.
  useEffect(() => applyTheme('system'), []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
