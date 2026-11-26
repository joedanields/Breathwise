import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { toHaveNoViolations } from './a11y/axe';
import { server } from './msw/server';

expect.extend({ toHaveNoViolations });

// Any request without an explicit handler fails the test, so tests can never
// silently reach a live API.
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// Searches wait for a 300 ms debounce, and the first test in a file pays for a cold start.
configure({ asyncUtilTimeout: 3000 });
