// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architecture rules (see CLAUDE.md "Layering"): resolver -> service -> repository.
 * The Weatherstack client reaches services only through the GraphQL context.
 */
const layer = (files, patterns) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns }],
    // A raw fetch would bypass the import rules above (e.g. calling Weatherstack from a resolver).
    'no-restricted-globals': [
      'error',
      {
        name: 'fetch',
        message: 'Outbound HTTP belongs in an injected client (src/weatherstack/).',
      },
    ],
  },
});

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
          'Resolvers must not use the Weatherstack client; it is injected into services via context.',
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
