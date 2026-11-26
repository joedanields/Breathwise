import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from '@/features/location/useDebouncedValue';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('returns the initial value straight away', () => {
    const { result } = renderHook(() => useDebouncedValue('Pu', 300));
    expect(result.current).toBe('Pu');
  });

  it('only updates after the value has been still for the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'P' },
    });

    rerender({ value: 'Pu' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'Pun' });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('P');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('Pun');
  });

  it('cancels the pending update on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'ab' });

    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
