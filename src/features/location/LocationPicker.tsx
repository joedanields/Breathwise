import { useEffect, useId, useRef } from 'react';
import { describeGeolocationFailure } from './geolocation';
import { LocationSearch } from './LocationSearch';
import { formatPlaceLabel, type Place } from './schemas';
import type { SelectedLocation } from './types';
import { type LocateState, useCurrentPosition } from './useCurrentPosition';

interface LocationPickerProps {
  onLocated: (location: SelectedLocation) => void;
}

function describeLocateState(state: LocateState): string {
  switch (state.status) {
    case 'idle':
      return '';
    case 'locating':
      return 'Finding your location…';
    case 'located':
      return state.location.nameAvailable
        ? `Showing ${state.location.label}.`
        : `Showing ${state.location.label}. You can also search for your town or city.`;
    case 'failed':
      return describeGeolocationFailure(state.reason);
    case 'outside-india': {
      const where = state.countryName
        ? ` Your location appears to be in ${state.countryName}.`
        : '';
      return `Breathwise covers India only.${where} Search for a town or city in India.`;
    }
  }
}

/** Search plus "Use my location". The default location is always "ask the user". */
export function LocationPicker({ onLocated }: LocationPickerProps) {
  const headingId = useId();
  const messageId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const { state, locate } = useCurrentPosition(onLocated);

  // ARCHITECTURE.md §6: when GPS can't be used, move focus to search.
  const shouldFocusSearch = state.status === 'failed' || state.status === 'outside-india';
  useEffect(() => {
    if (shouldFocusSearch) searchRef.current?.focus();
  }, [shouldFocusSearch, state]);

  const message = describeLocateState(state);
  const isProblem = shouldFocusSearch;

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-surface p-4">
      <h2 id={headingId} className="text-lg font-semibold">
        Choose a location
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <LocationSearch
          inputRef={searchRef}
          describedBy={isProblem ? messageId : undefined}
          onSelect={(place: Place) => {
            onLocated({
              latitude: place.latitude,
              longitude: place.longitude,
              label: formatPlaceLabel(place),
              nameAvailable: true,
              source: 'search',
              ...(place.state ? { state: place.state } : {}),
            });
          }}
        />
        <div className="sm:pt-14">
          <button
            type="button"
            onClick={() => void locate()}
            className="min-h-11 w-full rounded-md bg-accent px-4 font-medium text-on-accent sm:w-auto"
          >
            Use my location
          </button>
        </div>
      </div>
      <p
        id={messageId}
        role="status"
        className={`mt-2 min-h-6 text-sm ${isProblem ? 'font-medium text-text' : 'text-muted'}`}
      >
        {message}
      </p>
    </section>
  );
}
