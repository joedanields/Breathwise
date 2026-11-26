import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  getLocalStorage,
  getSessionStorage,
  readStored,
  removeStored,
  writeStored,
} from '@/lib/storage';

const Schema = z.object({ name: z.string(), count: z.number().int() });

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('readStored', () => {
  it('returns parsed data when it matches the schema', () => {
    localStorage.setItem('k', JSON.stringify({ name: 'a', count: 2 }));
    expect(readStored(localStorage, 'k', Schema)).toEqual({ name: 'a', count: 2 });
  });

  it('returns null when nothing is stored', () => {
    expect(readStored(localStorage, 'missing', Schema)).toBeNull();
  });

  it('removes and ignores data that fails the schema', () => {
    localStorage.setItem('k', JSON.stringify({ name: 'a', count: 'two' }));
    expect(readStored(localStorage, 'k', Schema)).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('removes and ignores data that is not JSON', () => {
    localStorage.setItem('k', '{oops');
    expect(readStored(localStorage, 'k', Schema)).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('returns null when storage is unavailable or throws', () => {
    expect(readStored(undefined, 'k', Schema)).toBeNull();
    const throwing = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    } as unknown as Storage;
    expect(readStored(throwing, 'k', Schema)).toBeNull();
  });
});

describe('writeStored', () => {
  it('stores JSON and reports success', () => {
    expect(writeStored(sessionStorage, 'k', { name: 'b', count: 1 })).toBe(true);
    expect(sessionStorage.getItem('k')).toBe('{"name":"b","count":1}');
  });

  it('reports failure instead of throwing (quota, private mode)', () => {
    const full = {
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    } as unknown as Storage;
    expect(writeStored(full, 'k', 1)).toBe(false);
    expect(writeStored(undefined, 'k', 1)).toBe(false);
  });
});

describe('removeStored', () => {
  it('removes the key and tolerates unavailable storage', () => {
    localStorage.setItem('k', '1');
    removeStored(localStorage, 'k');
    expect(localStorage.getItem('k')).toBeNull();
    expect(() => {
      removeStored(undefined, 'k');
    }).not.toThrow();
  });
});

describe('storage getters', () => {
  it('return the browser storages', () => {
    expect(getLocalStorage()).toBe(window.localStorage);
    expect(getSessionStorage()).toBe(window.sessionStorage);
  });

  it('return undefined when access throws', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    const local = vi.spyOn(window, 'localStorage', 'get').mockImplementation(blocked);
    const session = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(blocked);
    try {
      expect(getLocalStorage()).toBeUndefined();
      expect(getSessionStorage()).toBeUndefined();
    } finally {
      // Restore before the file's afterEach clears storage.
      local.mockRestore();
      session.mockRestore();
    }
  });
});
