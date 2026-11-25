import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** MSW server for Vitest (TEST ONLY; runtime code is lint-blocked from importing tests/). */
export const server = setupServer(...handlers);
