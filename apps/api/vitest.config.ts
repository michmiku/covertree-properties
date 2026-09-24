import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/test-database-url.ts';

// Tests never use the dev database or the real Weatherstack (CLAUDE.md "Tests").

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      TEST_DATABASE_URL,
      WEATHERSTACK_BASE_URL: 'http://weatherstack.test',
      WEATHERSTACK_ACCESS_KEY: 'test-key',
    },
    setupFiles: ['test/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
          exclude: ['**/*.int.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.int.test.ts', 'test/**/*.int.test.ts'],
          globalSetup: ['test/global-setup.int.ts'],
          // One shared database: run integration files one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
