import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode, useSyncExternalStore } from 'react';
import { type AppStores, createAppStores, StoresContext } from '@/features/profile/stores';
import { createQueryClient } from './queryClient';
import { applyTheme } from './theme';

interface AppProvidersProps {
  children: ReactNode;
  /** Tests pass their own client (no retries, isolated cache). */
  queryClient?: QueryClient | undefined;
  /** Tests pass stores over their own storage. */
  stores?: AppStores | undefined;
}

/** App-wide providers: TanStack Query, the profile/settings/location stores and the theme. */
export function AppProviders({ children, queryClient, stores }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  const [appStores] = useState(() => stores ?? createAppStores());
  const settings = useSyncExternalStore(
    appStores.settings.subscribe,
    appStores.settings.get,
    appStores.settings.get,
  );

  useEffect(() => applyTheme(settings.theme), [settings.theme]);

  return (
    <StoresContext.Provider value={appStores}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StoresContext.Provider>
  );
}
