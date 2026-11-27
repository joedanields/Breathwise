import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { clearAppStorage, createLocalStore, STORAGE_PREFIX } from '@/lib/localStore';

const Schema = z.object({ count: z.number().int() });
const KEY = `${STORAGE_PREFIX}test.v1`;

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function store(options: { persist?: () => boolean } = {}) {
  return createLocalStore({
    key: KEY,
    schema: Schema,
    fallback: null,
    storage: localStorage,
    ...options,
  });
}

describe('createLocalStore', () => {
  it('returns the fallback when nothing is stored', () => {
    expect(store().get()).toBeNull();
  });

  it('persists, reads back and keeps a stable reference between changes', () => {
    const first = store();
    first.set({ count: 2 });
    expect(localStorage.getItem(KEY)).toBe('{"count":2}');
    const second = store();
    expect(second.get()).toEqual({ count: 2 });
    expect(second.get()).toBe(second.get());
  });

  it('resets corrupt or invalid data to the fallback instead of crashing', () => {
    localStorage.setItem(KEY, '{"count":"many"}');
    expect(store().get()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    localStorage.setItem(KEY, '{not json');
    expect(store().get()).toBeNull();
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const s = store();
    const listener = vi.fn();
    const unsubscribe = s.subscribe(listener);
    s.set({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    s.set({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the value in memory only when persist() is false', () => {
    const s = store({ persist: () => false });
    s.set({ count: 5 });
    expect(s.get()).toEqual({ count: 5 });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('clear() resets to the fallback and removes the key', () => {
    const s = store();
    s.set({ count: 3 });
    s.clear();
    expect(s.get()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('picks up changes from other tabs (storage events)', () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);
    localStorage.setItem(KEY, '{"count":9}');
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(s.get()).toEqual({ count: 9 });
    expect(listener).toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: 'someone-else' }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('clearAppStorage', () => {
  it('removes only Breathwise keys from both storages', () => {
    localStorage.setItem(`${STORAGE_PREFIX}profile.v1`, '1');
    localStorage.setItem('other-app', '1');
    sessionStorage.setItem(`${STORAGE_PREFIX}byok`, '1');
    clearAppStorage([localStorage, sessionStorage, undefined]);
    expect(localStorage.getItem(`${STORAGE_PREFIX}profile.v1`)).toBeNull();
    expect(localStorage.getItem('other-app')).toBe('1');
    expect(sessionStorage.length).toBe(0);
  });
});
