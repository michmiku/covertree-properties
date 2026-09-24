import { defineConfig, devices } from '@playwright/test';

// SPEC X4. The whole stack runs on its own ports, so a `pnpm dev` session (which may point at the
// real Weatherstack) is never reused: the API only ever talks to the local stub.
const STUB_PORT = 4999;
const API_PORT = 4100;
const WEB_PORT = 5174;

// Commands call local binaries with `exec` rather than `pnpm exec`: pnpm starts its child in a new
// process group, which Playwright's teardown can't reach, so servers outlive the run and it hangs.
const shutdown = { signal: 'SIGTERM', timeout: 2000 } as const;

// Same database as the integration tests, never the dev one (CLAUDE.md "Tests"). Those tests
// truncate it, so never run the two at once; `pnpm verify` runs them one after the other.
const DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://covertree:covertree@localhost:5433/covertree_test';
if (!DATABASE_URL.includes(':5433/')) {
  throw new Error(`Refusing to run e2e against a non-test database: ${DATABASE_URL}`);
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'weatherstack-stub',
      command: 'exec node e2e/weatherstack-stub.mjs',
      url: `http://localhost:${STUB_PORT}/current`,
      env: { WEATHERSTACK_STUB_PORT: String(STUB_PORT) },
      reuseExistingServer: false,
      gracefulShutdown: shutdown,
    },
    {
      name: 'api',
      command:
        'node_modules/.bin/prisma migrate deploy && exec node_modules/.bin/tsx src/server.ts',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/graphql`,
      env: {
        DATABASE_URL,
        PORT: String(API_PORT),
        WEATHERSTACK_BASE_URL: `http://localhost:${STUB_PORT}`,
        WEATHERSTACK_ACCESS_KEY: 'e2e-fake-key',
        WEB_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
      },
      reuseExistingServer: false,
      gracefulShutdown: shutdown,
    },
    {
      name: 'web',
      // Explicit IPv4 host: Vite otherwise binds only ::1 on macOS and the readiness check hangs.
      command: `exec node_modules/.bin/vite --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      // Process env wins over the repo-root .env in Vite.
      env: { VITE_GRAPHQL_URL: `http://127.0.0.1:${API_PORT}/graphql` },
      reuseExistingServer: false,
      gracefulShutdown: shutdown,
    },
  ],
});
