import type { QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { SkipLink } from '@/components/layout/SkipLink';
import { DataPreview } from '@/features/preview/DataPreview';
import { HouseholdSheet } from '@/features/profile/HouseholdSheet';
import { Onboarding } from '@/features/profile/Onboarding';
import { type AppStores, useProfile } from '@/features/profile/stores';
import { SettingsSheet } from '@/features/settings/SettingsSheet';
import { ErrorBoundary } from './ErrorBoundary';
import { AppProviders } from './providers';

const MAIN_ID = 'main';

interface AppProps {
  /** For tests: an isolated query client. */
  queryClient?: QueryClient;
  /** For tests: stores over a controlled storage. */
  stores?: AppStores;
}

function AppContent() {
  const profile = useProfile();
  // After "Clear all my data", focus moves to the onboarding heading.
  const [cleared, setCleared] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink targetId={MAIN_ID} />
      <Header
        actions={
          profile && (
            <>
              <HouseholdSheet profile={profile} />
              <SettingsSheet
                onCleared={() => {
                  setCleared(true);
                }}
              />
            </>
          )
        }
      />
      <main
        id={MAIN_ID}
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 focus:outline-none"
      >
        <ErrorBoundary>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Breathe smarter through smog season
          </h1>
          <p className="mt-3 max-w-prose text-lg text-muted">
            Live air quality for anywhere in India, turned into a calm, practical plan for your
            household.
          </p>
          {profile ? <DataPreview /> : <Onboarding focusOnMount={cleared} />}
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

export function App({ queryClient, stores }: AppProps = {}) {
  return (
    <AppProviders queryClient={queryClient} stores={stores}>
      <AppContent />
    </AppProviders>
  );
}
