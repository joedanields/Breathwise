import type { AnyHandler } from 'msw';

/**
 * Default request handlers (TEST ONLY). Empty on purpose: each test adds the
 * handlers it needs with `server.use(...)`, built from captured real responses
 * in tests/fixtures/ (Phase 2).
 */
export const handlers: AnyHandler[] = [];
