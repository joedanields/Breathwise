import { useQuery } from '@tanstack/react-query';
import { unwrapOrThrow } from '@/lib/http';
import { searchPlaces } from './api';
import { useDebouncedValue } from './useDebouncedValue';

export const SEARCH_DEBOUNCE_MS = 300;
export const MIN_QUERY_LENGTH = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Debounced place search (ARCHITECTURE.md §5: 300 ms, at least 2 characters, cached 24 h). */
export function usePlaceSearch(rawQuery: string) {
  const trimmed = rawQuery.trim();
  const query = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const enabled = query.length >= MIN_QUERY_LENGTH;

  const result = useQuery({
    // The API ignores case, so "pune" and "Pune" share a cache entry.
    queryKey: ['place-search', query.toLocaleLowerCase('en-IN')],
    queryFn: async ({ signal }) => unwrapOrThrow(await searchPlaces(query, signal)),
    enabled,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });

  const settled = enabled && trimmed === query;
  return {
    query,
    places: settled ? (result.data ?? []) : [],
    isSearching: trimmed.length >= MIN_QUERY_LENGTH && (trimmed !== query || result.isFetching),
    isError: settled && result.isError && !result.isFetching,
    isEmpty: settled && result.isSuccess && result.data.length === 0,
    retry: () => void result.refetch(),
  };
}
