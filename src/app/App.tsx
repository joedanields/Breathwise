import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { SkipLink } from '@/components/layout/SkipLink';
import { ErrorBoundary } from './ErrorBoundary';
import { AppProviders } from './providers';

const MAIN_ID = 'main';

export function App() {
  return (
    <AppProviders>
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
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </AppProviders>
  );
}
