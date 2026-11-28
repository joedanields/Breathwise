import { describe, expect, it } from 'vitest';
import { nextActiveIndex, searchStatus, type SearchState } from '@/features/location/comboboxState';

describe('nextActiveIndex', () => {
  it('returns null when there are no options', () => {
    expect(nextActiveIndex('ArrowDown', -1, 0, false)).toBeNull();
    expect(nextActiveIndex('ArrowUp', -1, 0, true)).toBeNull();
  });

  it('opens a closed list on the first (down) or last (up) option', () => {
    expect(nextActiveIndex('ArrowDown', 2, 3, false)).toBe(0);
    expect(nextActiveIndex('ArrowUp', 0, 3, false)).toBe(2);
  });

  it('moves one step and wraps at either end', () => {
    expect(nextActiveIndex('ArrowDown', 0, 3, true)).toBe(1);
    expect(nextActiveIndex('ArrowDown', 2, 3, true)).toBe(0);
    expect(nextActiveIndex('ArrowUp', 2, 3, true)).toBe(1);
    expect(nextActiveIndex('ArrowUp', 0, 3, true)).toBe(2);
  });
});

describe('searchStatus', () => {
  const idle: SearchState = {
    query: 'Pune',
    placeCount: 0,
    isSearching: false,
    isError: false,
    isEmpty: false,
  };

  it('announces searching, errors and empty results in that order of priority', () => {
    expect(searchStatus({ ...idle, isSearching: true, isError: true }, false)).toBe('Searching…');
    expect(searchStatus({ ...idle, isError: true }, false)).toMatch(/unavailable right now/);
    expect(searchStatus({ ...idle, isEmpty: true }, false)).toBe(
      'No places in India match “Pune”.',
    );
  });

  it('counts results only while the list is open', () => {
    expect(searchStatus({ ...idle, placeCount: 1 }, true)).toBe(
      '1 place found. Use the up and down arrows to choose.',
    );
    expect(searchStatus({ ...idle, placeCount: 3 }, true)).toMatch(/^3 places found/);
    expect(searchStatus({ ...idle, placeCount: 3 }, false)).toBe('');
  });
});
