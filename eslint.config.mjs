// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architecture rules (see CLAUDE.md "Layering"): resolver -> service -> repository.
 * The Weatherstack client is built once in src/container.ts and injected into the create-property
 * service; the GraphQL context only carries services, so resolvers can't reach the client.
 */
const layer = (files, patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

// A raw fetch would bypass the import rules (e.g. calling Weatherstack from a resolver), so only
// the Weatherstack client may use it.
const onlyWeatherstackFetches = {
  files: ['apps/api/src/**/*.ts'],
  ignores: ['apps/api/src/weatherstack/client.ts', '**/*.test.ts'],
  rules: {
    'no-restricted-globals': [
      'error',
      {
        name: 'fetch',
        message: 'Outbound HTTP belongs in an injected client (src/weatherstack/).',
      },
    ],
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/__generated__/**',
      '**/src/gql/**',
      'playwright-report/**',
      'test-results/**',
      '.playwright-mcp/**',
      'ai/sessions/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  onlyWeatherstackFetches,
  layer(
    ['apps/api/src/resolvers/**'],
    [
      {
        group: ['@prisma/client', '**/__generated__/prisma/**', '**/repositories/**'],
        message: 'Resolvers call services only (resolver -> service -> repository).',
      },
      {
        group: ['**/weatherstack/**'],
        message:
          'Resolvers must not use the Weatherstack client; src/container.ts injects it into the create-property service.',
      },
    ],
  ),
  layer(
    ['apps/api/src/services/**'],
    [
      {
        group: ['graphql', 'graphql-yoga', '**/resolvers/**'],
        message: 'Services are transport-agnostic: no GraphQL imports.',
      },
      {
        group: ['@prisma/client', '**/__generated__/prisma/**'],
        message: 'Services access data through repositories, not Prisma directly.',
      },
    ],
  ),
  layer(
    ['apps/api/src/repositories/**'],
    [
      {
        group: [
          '**/services/**',
          '**/resolvers/**',
          '**/weatherstack/**',
          'graphql',
          'graphql-yoga',
        ],
        message: 'Repositories only talk to the database.',
      },
    ],
  ),
);
