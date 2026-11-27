import { describe, expect, it } from 'vitest';
import { fnv1a32, stableHash, stableStringify } from '@/lib/hash';

describe('stableStringify', () => {
  it('sorts object keys at every level and keeps array order', () => {
    expect(stableStringify({ b: 1, a: { d: [3, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,1]},"b":1}',
    );
  });

  it('drops undefined properties like JSON.stringify', () => {
    expect(stableStringify({ a: undefined, b: 2 })).toBe('{"b":2}');
    expect(stableStringify([undefined])).toBe('[null]');
  });

  it('handles primitives', () => {
    expect(stableStringify('x')).toBe('"x"');
    expect(stableStringify(1.5)).toBe('1.5');
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify(null)).toBe('null');
  });
});

describe('fnv1a32 / stableHash', () => {
  it('matches the FNV-1a 32-bit reference values', () => {
    expect(fnv1a32('')).toBe('811c9dc5');
    expect(fnv1a32('a')).toBe('e40c292c');
    expect(fnv1a32('foobar')).toBe('bf9cf968');
  });

  it('is the same for equal values regardless of key order', () => {
    expect(stableHash({ a: 1, b: [1, 2] })).toBe(stableHash({ b: [1, 2], a: 1 }));
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
    expect(stableHash({ a: 1 })).toMatch(/^[0-9a-f]{8}$/);
  });
});
