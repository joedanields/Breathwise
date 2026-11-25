import { useEffect, type ReactNode } from 'react';
import { applyTheme } from './theme';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * App-wide providers. Phase 1 only applies the theme; TanStack Query (Phase 2)
 * and the profile/settings stores (Phase 4) are added here as they arrive.
 */
export function AppProviders({ children }: AppProvidersProps) {
  // Follows the OS theme for now; the Settings sheet (Phase 4) supplies a user preference.
  useEffect(() => applyTheme('system'), []);

  return children;
}
