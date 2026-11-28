// Pure combobox logic for LocationSearch (UI_UX.md §4). No React.

/** The search state the status message depends on. */
export interface SearchState {
  query: string;
  placeCount: number;
  isSearching: boolean;
  isError: boolean;
  isEmpty: boolean;
}

/**
 * The option an arrow key moves to, wrapping at either end. A closed list opens on the
 * first (down) or last (up) option. Null when there are no options.
 */
export function nextActiveIndex(
  key: 'ArrowDown' | 'ArrowUp',
  activeIndex: number,
  count: number,
  expanded: boolean,
): number | null {
  if (count === 0) return null;
  if (key === 'ArrowDown') return !expanded || activeIndex >= count - 1 ? 0 : activeIndex + 1;
  return !expanded || activeIndex <= 0 ? count - 1 : activeIndex - 1;
}

/** The text announced in the search's live status region. */
export function searchStatus(search: SearchState, expanded: boolean): string {
  if (search.isSearching) return 'Searching…';
  if (search.isError) {
    return 'Search is unavailable right now. Check your connection and try again.';
  }
  if (search.isEmpty) return `No places in India match “${search.query}”.`;
  if (!expanded) return '';
  const noun = search.placeCount === 1 ? 'place' : 'places';
  return `${String(search.placeCount)} ${noun} found. Use the up and down arrows to choose.`;
}
