import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw.ts';

// Any request without a handler fails the test, so nothing can reach the real Weatherstack.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
