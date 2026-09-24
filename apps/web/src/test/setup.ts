import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw';

// Any GraphQL request without a handler fails the test.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  // Sonner keeps toasts in a module-level store and replays active ones to the next <Toaster>,
  // so without this a toast from one test shows up in the next.
  toast.dismiss();
});
afterAll(() => server.close());
