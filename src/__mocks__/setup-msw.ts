import { setupServer } from 'msw/node';
import { mspHandlers } from './handlers/msp-handlers';

/**
 * Global MSW server for integration tests.
 * Started once per test file via setupFiles in vitest.config.ts.
 */
export const server = setupServer(...mspHandlers);
