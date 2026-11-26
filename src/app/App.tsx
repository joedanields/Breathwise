import type { QueryClient } from '@tanstack/react-query';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { SkipLink } from '@/components/layout/SkipLink';
import { DataPreview } from '@/features/preview/DataPreview';
import { ErrorBoundary } from './ErrorBoundary';
import { AppProviders } from './providers';

const MAIN_ID = 'main';

interface AppProps {
  /** For tests: an isolated query client. */
  queryClient?: QueryClient;
}

export function App({ queryClient }: AppProps = {}) {
  return (
    <AppProviders queryClient={queryClient}>
      <div className="flex min-h-dvh flex-col">
        <SkipLink targetId={MAIN_ID} />
        <Header />
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
            <DataPreview />
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </AppProviders>
  );
}
